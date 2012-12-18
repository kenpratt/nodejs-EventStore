var EventStore = require("../lib/event_store");

var es = EventStore.connect("127.0.0.1");

var num = 10000;
var start = new Date();

es.readStream("bm", function(err, events) {
  if (err) {
    console.log("Read failed:", err);
    return;
  }
  console.log("took:", (new Date()) - start);
});
