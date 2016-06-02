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
          "id": "olq6un8g3480"
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
