var AWS = require('aws-sdk');
var async = require('async');
var utils = require('./utils');
var config = require('../config');

var s3 = new AWS.S3({ region: config.region });

module.exports = function (event, context, callback) {
    var id = event.body.sys.id;
    var space = event.body.sys.space.sys.id;

    console.log(`unpublishing '${id}'' in space '${space}'`);
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
            console.log('retreiving index path');
            var targetS3 = new AWS.S3({
                region: req.config.target.region,
                accessKeyId: req.config.target.accessKeyId ,
                secretAccessKey: req.config.target.secretAccessKey
            });

            targetS3.getObject({
                Bucket: req.config.target.bucket,
                Key: `.index/${id}`
            }, function (err, res) {
                if (err) {
                    console.error('... failed', err, err.stack);
                }
                else {
                    var fullPath = res.Body.toString();
                    console.log(`deleting at path: ${fullPath}`);

                    targetS3.deleteObject({
                        Bucket: req.config.target.bucket,
                        Key: fullPath
                    }, function (err, callback) {
                        if (err) {
                            console.error('... failed', err, err.stack);
                        }
                        else {
                            console.log('... deleted');

                            console.log('deleting index path');
                            targetS3.deleteObject({
                                Bucket: req.config.target.bucket,
                                Key: `.index/${id}`
                            }, function (err, callback) {
                                if (err) {
                                    console.error('... failed', err, err.stack);
                                }
                                else {
                                    console.log('deleted');

                                    next(null, res);
                                }
                            });
                        }
                    });
                }
            });
        }
    ], function (err, res) {

    })
}
