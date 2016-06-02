var actions = require('./actions');

module.exports = {
  handler: function (event, context, callback) {
    var topic = event.topic.split('.');
    if (topic.length === 3
      && topic[0] === 'ContentManagement'
      && topic[1] == 'Entry') {
      actions[topic[2]](event, context, callback);
    }
  }
}
