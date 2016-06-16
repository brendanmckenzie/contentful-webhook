var event = {
  "body": {
    "sys": {
      "id": "6SBHVTki1GagyM2cKkm0IE",
      "contentType": {
        "sys": {
          "id": "destination"
        }
      },
      "space": {
        "sys": {
          "id": "oadra9jx0s9q"
        }
      }
    }
  },
  "topic": "ContentManagement.Entry.publish"
};

var context = {
  succeed: function (msg) { console.log(msg); },
  fail: function (msg) { console.error(msg); }
}

var handler = require('./').handler;

handler(event, context);
