var http = require('https');
var config = require('./config');

function getById(req, callback) {
    var params = {
        host: 'cdn.contentful.com',
        path: `/spaces/${req.space}/entries?access_token=${req.apiKey}&sys.id=${req.id}`
    }
    http.get(params, function (res) {
        var body = '';
        res.on('data', function(d) {
            body += d;
        });
        res.on('end', function() {
            callback(null, JSON.parse(body));
        });
    })
}

module.exports = {
    getById: getById
}
