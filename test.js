var event = {
  "body": {
    "sys": {
      "id": "6eEOFFPbMs4s4O0MQaUeym",
      "contentType": {
        "sys": {
          "id": "project"
        }
      },
      "space": {
        "sys": {
          "id": "oadra9jx0s9q"
        }
      }
    }
  },
  "topic": "ContentManagement.Entry.republish"
};

var context = {
  succeed: function (msg) { console.log(msg); },
  fail: function (msg) { console.error(msg); }
}

var handler = require('./').handler;

handler(event, context);
