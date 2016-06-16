var AWS = require('aws-sdk');
var async = require('async');
var dot = require('dot');
var config = require('../config');
var contentful = require('../contentful');

var s3 = new AWS.S3();

module.exports = function (event, context, callback) {
    var space = event.body.sys.space.sys.id;

    console.log(`publishing all entries in space '${space}'`);
    async.waterfall([
        function (next) {
            console.log(`looking up space: ${space}`);
            s3.getObject({
                Bucket: config.bucket,
                Key: `${space}.json`
            }, function (err, res) {
                if (err) {
                    return next(`space not found: ${err}\n${err.stack}`);
                }

                try {
                    var config = JSON.parse(res.Body.toString());
                    console.log('... found');
                    next(null, {
                        config: config
                    });
                }
                catch (ex) {
                    next(`invalid space config: ${ex}`);
                }
            });
        },

        function (req, next) {
            console.log(`retreiving content`);
            contentful.getAllEntries({
                space: req.config.contentful.space,
                apiKey: req.config.contentful.apiKey
            }, function (err, data) {
                if (err || data.items.length === 0) {
                    next(err || 'item not found', null);
                }
                else {
                    console.log(`... found ${data.items.length} entries`);
                    req.data = data;
                    next(null, req);
                }
            });
        },

        function (req, next) {
            var contentTypes = req.data.items
                .map(function (ent) {
                    return ent.sys.contentType.sys.id;
                })
                .filter(function (ent, pos, arr) {
                    // unique entries
                    return arr.indexOf(ent) === pos;
                })

            var templateS3 = new AWS.S3({
                region: req.config.templates.region,
                accessKeyId: req.config.templates.accessKeyId,
                secretAccessKey: req.config.templates.secretAccessKey
            });

            async.map(contentTypes, function (ent, callback) {
                var template = `${ent}.dot`
                console.log(`retreiving template: ${template}`);
                var key = ((req.config.templates.keyPrefix || '') + '/' + template)
                    .replace(/^\//, '')
                    .replace(/\/{2,}/g, '/');

                templateS3.getObject({
                    Bucket: req.config.templates.bucket,
                    Key: key
                }, function (err, res) {
                    if (err) {
                        console.log(`... not found: ${template}`);
                        callback(null, { contentType: ent, template: null });
                    }
                    else {
                        console.log(`... found: ${template}`);
                        callback(null, { contentType: ent, template: res.Body.toString() });
                    }
                });
            }, function (err, res) {
                var templates = {};
                for (var i = 0; i < res.length; i++) {
                    if (res[i]) {
                        templates[res[i].contentType] = res[i].template;
                    }
                }
                req.templates = templates;
                next(null, req);
            })
        },

        function (req, next) {
            console.log('processing entries');

            var includes = {};
            if (req.data.includes) {
                Object.keys(req.data.includes).forEach(function (incType) {
                    includes[incType] = {};
                    req.data.includes[incType].forEach(function (ent) {
                        includes[incType][ent.sys.id] = ent;
                    });
                });
            }

            async.map(req.data.items, function (content, callback) {
                if (!req.templates[content.sys.contentType.sys.id]) {
                    callback(null, { id: content.sys.id, html: null });
                }
                else {
                    var template = dot.template(req.templates[content.sys.contentType.sys.id]);

                    var it = content.fields;
                    it.includes = includes;
                    it.fn = {
                        moment: require('moment'),
                        marked: require('marked'),
                        image: function (ent) {
                            try {
                                return includes.Asset[ent.sys.id].fields.file.url
                            }
                            catch (ex) {
                                return null
                            }
                        }
                    };

                    var html = template(it);

                    callback(null, { id: content.sys.id, html: html });
                }
            }, function (err, res) {
                req.html = res;
                console.log('... processed');
                next(null, req);
            });
        },

        function (req, next) {
            console.log('processing path');

            async.map(req.data.items, function (content, callback) {
                var contentType = content.sys.contentType.sys.id;

                if (req.config.paths[contentType]) {
                    var template = dot.template(req.config.paths[contentType]);

                    var it = content.fields;
                    it.fn = {
                        moment: require('moment'),
                        marked: require('marked')
                    };

                    callback(null, { id: content.sys.id, path: template(it) });
                }
                else {
                    callback(null, { id: content.sys.id, path: null });
                }
            }, function (err, res) {
                req.paths = res;
                next(null, req);
            });
        },

        function (req, next) {
            console.log('writing to target');
            var targetS3 = new AWS.S3({
                region: req.config.target.region,
                accessKeyId: req.config.target.accessKeyId ,
                secretAccessKey: req.config.target.secretAccessKey
            });

            var prefix = req.config.target.keyPrefix || '';
            async.each(req.data.items, function (ent, callback) {
                var path = req.paths.find(function (entA) { return entA.id === ent.sys.id });
                var html = req.html.find(function (entA) { return entA.id === ent.sys.id });

                html = html ? html.html : null;
                path = path ? path.path : null;

                if (html && path) {
                    console.log(`uploading: ${path}`)
                    path = `${prefix}/${path}/index.html`;

                    var key = path
                        .replace(/^\/+/, '')
                        .replace(/\/{2,}/g, '/');

                    targetS3.putObject({
                        ACL: 'public-read',
                        ContentType: 'text/html',
                        Bucket: req.config.target.bucket,
                        Key: key,
                        Body: html
                    }, function (err, res) {
                        if (err) {
                            callback(`${key} failed: ${err}`);
                        }
                        else {
                            console.log(`... uploaded: ${key}`);

                            console.log(`creating index link for ${key}`);
                            targetS3.putObject({
                                Bucket: req.config.target.bucket,
                                Key: `.index/${ent.sys.id}`,
                                Body: key
                            }, function (err, res) {
                                if (err) {
                                    callback(`${key} failed: ${err}`);
                                }
                                else {
                                    console.log(`... created index link for: ${key}`);
                                    callback(null, key);
                                }
                            });
                        }
                    });
                }
                else {
                    console.log(`skipped: ${ent.sys.id}`);
                    callback(null, { id: ent.sys.id });
                }
            }, function (err, res) {
                console.log('done');
                next(null, { ok: true });
            });
        },

        function (req, next) {
            if (req.config.target.cloudfront) {
                console.log('creating cloudfront invalidation');

                var cloudfront = new AWS.CloudFront({
                    region: req.config.target.region,
                    accessKeyId: req.config.target.accessKeyId ,
                    secretAccessKey: req.config.target.secretAccessKey
                });

                cloudfront.createInvalidation({
                    DistributionId: req.config.target.cloudfront.distribution,
                    InvalidationBatch: {
                        CallerReference: `contentful-webhook-${new Date().getTime()}-${parseInt(Math.random() * 10e8)}`,
                        Paths: {
                            Quantity: 1,
                            Items: [ `/*` ]
                        }
                    }
                }, function (err, data) {
                    if (err) {
                        next(`failed: ${err}`)
                    }
                    else {
                        console.log('... created');
                        next(null, {
                            ok: true,
                            bucket: req.bucket,
                            key: req.key,
                            invalidation: data.Invalidation.Id
                        })
                    }
                })
            }
            else {
                next(null, {
                    ok: true,
                    bucket: req.bucket,
                    key: req.key
                });
            }
        }
    ], function (err, res) {
        if (err) {
            console.error(err);
        }
        else {
            console.log(JSON.stringify(res, null, 2));
        }
    });
}
