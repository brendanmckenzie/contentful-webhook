var AWS = require('aws-sdk');
var utils = require('./utils');
var config = require('../config');

var s3 = new AWS.S3({ region: config.region });

module.exports = function (event, context, callback) {
    var id = event.body.sys.id;

    console.log('retreiving index path');
    s3.getObject({
        Bucket: config.bucket,
        Key: `.index/${id}`
    }, function (err, res) {
        if (err) {
            return console.log('failed', err, err.stack);
        }

        var fullPath = res.Body.toString();

        console.log(`deleting at path: ${fullPath}`);

        var params = {
            Bucket: config.bucket,
            Key: fullPath
        };
        s3.deleteObject(params, function (err, callback) {
            if (err) {
                return console.log('failed', err, err.stack);
            }

            console.log('deleted');

            console.log('deleting index path');
            var params = {
                Bucket: config.bucket,
                Key: `.index/${id}`
            };
            s3.deleteObject(params, function (err, callback) {
                if (err) {
                    return console.log('failed', err, err.stack);
                }

                console.log('deleted');
            });
        });
    });
}
