var moment = require('moment');

var pathMapper = {
    'post': function (fields) {
        return `/blog/${moment(fields.date).format('YYYY/MM')}/${fields.slug}`;
    },
    'project': function (fields) {
        return `/portfolio/${fields.slug}`;
    }
}

module.exports = {
    path: function (contentType, fields) {
        if (contentType in pathMapper) {
            return pathMapper[contentType](fields);
        }
        else {
            console.log(`unknown contentType: ${contentType}`);
        }
    }
}
