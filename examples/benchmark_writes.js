var EventStore = require("../lib/event_store");

var es = EventStore.connect("127.0.0.1");

es.createStream("bm", function(err) {
  if (err) {
    console.log("Stream creation failed:", err);
    return;
  }
  console.log("Stream created");

  var num = 10000;
  var start = new Date();
  var finished = 0;

  var doneCb = function(err, eventNumber) {
    if (err) {
      console.log("Event creation failed:", err);
    } else {
      finished++;
      if (finished == num) {
        console.log("took:", (new Date()) - start);
      }
    }
  };

  for (var i=0; i<num; i++) {
    es.createEvent("bm", "Hello", "Hello", doneCb);
  }
});
