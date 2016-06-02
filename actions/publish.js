var AWS = require('aws-sdk');
var async = require('async');
var dot = require('dot');
var config = require('../config');
var contentful = require('../contentful');

var s3 = new AWS.S3();

module.exports = function (event, context, callback) {
    var id = event.body.sys.id;
    var space = event.body.sys.space.sys.id;

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
                        id: event.body.sys.id,
                        config: config
                    });
                }
                catch (ex) {
                    next(`invalid space config: ${ex}`);
                }
            });
        },

        function (req, next) {
            console.log(`retreiving content: ${id}`);
            contentful.getById({
                space: req.config.contentful.space,
                apiKey: req.config.contentful.apiKey,
                id: req.id
            }, function (err, data) {
                if (err || data.items.length === 0) {
                    next(err || 'item not found', null);
                }
                else {
                    console.log('... found');
                    req.data = data;
                    next(null, req);
                }
            });
        },

        function (req, next) {
            var item = req.data.items[0];
            var contentType = item.sys.contentType.sys.id;
            var template = `${contentType}.dot`;
            console.log(`retreiving template: ${template}`);

            var templateS3 = new AWS.S3({
                region: req.config.templates.region,
                accessKeyId: req.config.templates.accessKeyId,
                secretAccessKey: req.config.templates.secretAccessKey
            });

            var key = ((req.config.templates.keyPrefix || '') + '/' + template)
                .replace(/^\//, '')
                .replace(/\/{2,}/g, '/');

            templateS3.getObject({
                Bucket: req.config.templates.bucket,
                Key: key
            }, function (err, res) {
                if (err) {
                    next(`template not found: ${err}\n${err.stack}`);
                }
                else {
                    console.log('... found');
                    req.template = res.Body.toString();
                    next(null, req);
                }
            });
        },

        function (req, next) {
            console.log('processing template');
            var content = req.data.items[0];

            var includes = {};
            if (req.data.includes) {
                Object.keys(req.data.includes).forEach(function (incType) {
                    includes[incType] = {};
                    req.data.includes[incType].forEach(function (ent) {
                        includes[incType][ent.sys.id] = ent;
                    });
                });
            }

            var content = req.data.items[0];

            var template = dot.template(req.template);

            var it = content.fields;
            it.includes = includes;
            it.fn = {
                moment: require('moment'),
                marked: require('marked')
            };

            req.html = template(it);

            console.log('... processed');
            next(null, req);

        },

        function (req, next) {
            console.log('processing path');

            var content = req.data.items[0];
            var contentType = content.sys.contentType.sys.id;

            var template = dot.template(req.config.paths[contentType]);

            var it = content.fields;
            it.fn = {
                moment: require('moment'),
                marked: require('marked')
            };

            req.path = template(it);
            console.log(`... processed: ${req.path}`);

            next(null, req);
        },

        function (req, next) {
            console.log('writing to target');
            var targetS3 = new AWS.S3({
                region: req.config.target.region,
                accessKeyId: req.config.target.accessKeyId ,
                secretAccessKey: req.config.target.secretAccessKey
            });

            var key = ((req.config.target.keyPrefix || '') + '/' + req.path)
                .replace(/^\//, '')
                .replace(/\/{2,}/g, '/');

            targetS3.putObject({
                ACL: 'public-read',
                ContentType: 'text/html',
                Bucket: req.config.target.bucket,
                Key: key,
                Body: req.html
            }, function (err, callback) {
                if (err) {
                    next(`failed: ${err}`);
                }
                else {
                    console.log('... uploaded');

                    console.log('creating index link');
                    targetS3.putObject({
                        Bucket: req.config.target.bucket,
                        Key: `.index/${id}`,
                        Body: key
                    }, function (err, callback) {
                        if (err) {
                            next(`failed: ${err}`);
                        }
                        else {
                            console.log('... created');
                            next(null, {
                                ok: true,
                                bucket: req.config.target.bucket,
                                key: key
                            });
                        }

                    });
                }
            });
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
