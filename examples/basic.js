var EventStore = require("../lib/event_store");

var es = EventStore.connect("127.0.0.1");
var next = 1;

es.createStream("test", function(err) {
  if (err) {
    console.log("Stream creation failed:", err);
    return;
  }
  console.log("Stream created");


  // this a convenience method that reads all the events in the stream and
  // subscribes to new ones, calling the callback once for each event, in order.
  es.readAndSubscribeToStream("test", function(err, event) {
    if (err) {
      console.log("Error in stream subscription:", err);
    } else {
      console.log("Got event:", event.eventNumber, event.data.toString());
    }
  });

  setInterval((function() {
    // create an event
    es.createEvent("test", "Hello", "Hello, World! #" + (next++), function(err, eventNumber) {
      if (err) {
        console.log("Event creation failed:", err);
      } else {
        console.log("Event created with event number = " + eventNumber);
      }
    });
  }), 3000);
});
