var net  = require("net")
  , uuid = require("node-uuid")
  , ErrorCodes = require("./error_codes")
  , Proto = require("./proto")
  , TcpCommands = require("./tcp_commands");


/**
 * Export the Connection class
 */
module.exports = Connection;


/**
 * Create a connection to the EventStore (defaults to 127.0.0.1:1113)
 *
 * @param {String} ip
 * @param {Number} port
 */
function Connection(ip, port) {
  ip = ip || "127.0.0.1";
  port = port || 1113;
  this._responseCallbacks = {};
  this._leftoverPacketData = null;

  // open a socket to the EventStore server
  this._socket = net.createConnection(port, ip);

  // set up callbacks
  this._socket.on("connect", this._connected.bind(this));
  this._socket.on("data", this._onData.bind(this));
  this._socket.on("end", this._disconnected.bind(this));

  console.log("Connecting to EventStore at " + ip + ":" + port);
}


/**
 * Create a new event stream (idempotent, will return success if stream exists).
 *
 * @param {String} stream
 * @param {Function} cb
 */
Connection.prototype.createStream = function(stream, cb) {
  var id = uuid.v4();
  var idBuffer = new Buffer(16);
  uuid.parse(id, idBuffer);

  var payload = Proto.serialize("CreateStream", {
    eventStreamId: stream,
    createStreamId: idBuffer,
    metadata: "",
    allowForwarding: true,
    isJson: true
  });

  this._sendTcpPacket("CreateStream", payload, cb);
};

Connection.prototype._createStreamComplete = function(payload, cb) {
  var res = Proto.parse("CreateStreamCompleted", payload);
  var errorType = ErrorCodes.messageForCode[res.errorCode];
  if (errorType === "Success" || errorType === "WrongExpectedVersion") {
    cb();
  } else {
    cb(errorType + ": " + res.error);
  }
};


/**
 * Create a new event in a stream.
 *
 * @param {String} stream
 * @param {String} eventType
 * @param {String} data
 * @param {Function} cb
 */
Connection.prototype.createEvent = function(stream, eventType, data, cb) {
  var eventId = uuid.v4();
  var eventIdBuffer = new Buffer(16);
  uuid.parse(eventId, eventIdBuffer);

  var payload = Proto.serialize("WriteEvents", {
    eventStreamId: stream,
    expectedVersion: -2,
    allowForwarding: true,
    events: [{
      eventId: eventIdBuffer,
      eventType: eventType,
      isJson: true,
      data: data
    }]
  });

  this._sendTcpPacket("WriteEvents", payload, cb);
};

Connection.prototype._createEventComplete = function(payload, cb) {
  var res = Proto.parse("WriteEventsCompleted", payload);
  var errorType = ErrorCodes.messageForCode[res.errorCode];
  if (errorType === "Success") {
    cb(null, res.eventNumber);
  } else {
    cb(errorType + ": " + res.error);
  }
};


/**
 * Raw ReadStreamEventsForward.
 *
 * @param {String} stream
 * @param {Number} start
 * @param {Number} max
 * @param {Function} cb
 */
Connection.prototype.readStreamEventsForward = function(stream, start, max, cb) {
  var payload = Proto.serialize("ReadStreamEventsForward", {
    eventStreamId: stream,
    startIndex: start,
    maxCount: max,
    resolveLinkTos: false
  });

  this._sendTcpPacket("ReadStreamEventsForward", payload, cb);
};

Connection.prototype._readStreamEventsForwardComplete = function(payload, cb) {
  var res = Proto.parse("ReadStreamEventsForwardCompleted", payload);
  cb(null, res);
};


/**
 * Subscribe to a stream. Callback will be called for each new event.
 *
 * @param {String} stream
 * @param {Function} cb
 */
Connection.prototype.subscribeToStream = function(stream, cb) {
  var payload = Proto.serialize("SubscribeToStream", {
    eventStreamId: stream
  });

  this._sendTcpPacket("SubscribeToStream", payload, {multi: true}, cb);
};

Connection.prototype._streamEventAppeared = function(payload, cb) {
  var res = Proto.parse("StreamEventAppeared", payload);
  cb(null, res);
};


/**
 * Read all events in a stream. Callback will include all the events.
 *
 * @param {String} stream
 * @param {Function} cb
 */
Connection.prototype.readStream = function(stream, cb) {
  this.readStreamEventsForward(stream, 0, 10000000, function(err, data) {
    if (err) {
      cb(err);
      return;
    }

    var rawEvents = (data && data.events) || [];
    var events = [];
    for (i in rawEvents) {
      events.push(rawEvents[i].event);
    }
    cb(null, events);
  });
};

/**
 * Read all events in a stream, and additionally subscribe to new events.
 * Callback will be called once for each event.
 *
 * @param {String} stream
 * @param {Function} cb
 */
Connection.prototype.readAndSubscribeToStream = function(stream, cb) {
  var streaming = false;
  var queue = [];

  this.subscribeToStream(stream, function(err, ev) {
    if (streaming) {
      cb(err, ev);
    } else {
      queue.push([err, ev]);
    }
  });

  this.readStream(stream, function(err, events) {
    if (err) {
      cb(err)
      return;
    }

    // call callback for existing events
    for (var i in events) {
      cb(null, events[i]);
    }

    // call callback for new events, rejecting any duplication from overlap
    var lastEventNumber = (events.length > 0) ? events[events.length - 1].eventNumber : -1;
    for (var i in queue) {
      var err   = queue[i][0];
      var event = queue[i][1];
      if (event.eventNumber > lastEventNumber) {
        cb(err, event);
      }
    }

    // turn on streaming
    streaming = true;
    queue = [];
  });
};


Connection.prototype._connected = function() {
  console.log("Connected");
};


Connection.prototype._disconnected = function() {
  console.log("Disconnected");
};


Connection.prototype._createTcpPacket = function(command, correlationId, payload) {
  var payloadSize = payload ? payload.length : 0;
  var contentLength = payloadSize + 17;
  var packet = new Buffer(contentLength + 4);
  packet.writeUInt32LE(contentLength, 0);
  packet.writeUInt8(TcpCommands.codeForType[command], 4);
  uuid.parse(correlationId, packet, 5);
  if (payloadSize > 0) {
    payload.copy(packet, 21);
  }
  return packet;
};


Connection.prototype._sendTcpPacket = function(command, payload, opts, cb) {
  opts = opts || {};
  cb = cb || function() {};
  if (typeof opts === "function") {
    cb = opts;
    opts = {};
  }

  var correlationId = uuid.v4();
  this._storeResponseCallback(correlationId, opts.multi, cb);

  var packet = this._createTcpPacket(command, correlationId, payload);
  console.log("Sending " + command + " command with correlation id: " + correlationId);
  this._socket.write(packet);
};


// handle a raw TCP packet (may contain multiple ES packets, or may need to join with the next TCP packet to get a full ES packet)
Connection.prototype._onData = function(packet) {
  // if there is leftover data from the last packet, prepend it to the current packet before processing
  if (this._leftoverPacketData) {
    var newPacket = new Buffer(this._leftoverPacketData.length + packet.length);
    this._leftoverPacketData.copy(newPacket, 0);
    packet.copy(newPacket, this._leftoverPacketData.length);
    packet = newPacket;
    this._leftoverPacketData = null;
  }

  // if packet is too small to contain anything, wait for another one
  if (packet.length < 5) {
    this._leftoverPacketData = packet;
    return;
  }

  var contentLength = packet.readUInt32LE(0);
  var expectedPacketLength = contentLength + 4;
  if (packet.length === expectedPacketLength) {
    this._process(packet.slice(4));
  } else if (packet.length >= expectedPacketLength) {
    console.log("Packet too big, trying to split into multiple packets (wanted: " + expectedPacketLength + " bytes, got: " + packet.length + " bytes)");
    this._onData(packet.slice(0, expectedPacketLength));
    this._onData(packet.slice(expectedPacketLength));
  } else {
    console.log("Crap, the packet isn't big enough. Maybe there's another packet coming? (wanted: " + expectedPacketLength + " bytes, got: " + packet.length + " bytes)");
    this._leftoverPacketData = packet;
  }
};


// process an actual EventStore packet (self-contained, stripped of length header)
Connection.prototype._process = function(packet) {
  var command = TcpCommands.typeForCode[packet.readUInt8(0)];
  var correlationId = uuid.unparse(packet, 1);
  console.log("Received " + command + " command with correlation id: " + correlationId);

  var payload = null;
  if (packet.length > 17) {
    payload = packet.slice(17);
  }

  // call appropriate response handler
  var cb = this._getResponseCallback(correlationId);
  switch (command) {
    case "HeartbeatRequestCommand":
      this._sendTcpPacket("HeartbeatResponseCommand");
      cb();
      break;
    case "CreateStreamCompleted":
      this._createStreamComplete(payload, cb);
      break;
    case "WriteEventsCompleted":
      this._createEventComplete(payload, cb);
      break;
    case "ReadStreamEventsForwardCompleted":
      this._readStreamEventsForwardComplete(payload, cb);
      break;
    case "StreamEventAppeared":
      this._streamEventAppeared(payload, cb);
      break;
    default:
      console.log("Don't know how to process a " + command + " command");
      cb();
  }
};


/**
 * Store a callback with a correlation ID so it can be retrieved when the
 * response(s) come back (multi signifies N responses).
 */
Connection.prototype._storeResponseCallback = function(correlationId, multi, cb) {
  this._responseCallbacks[correlationId] = {
    multi: multi,
    cb: cb
  };
};


/**
 * Retrieve a stored response callback. Unless multi is set, delete it as well.
 */
Connection.prototype._getResponseCallback = function(correlationId) {
  var found = this._responseCallbacks[correlationId];
  if (found) {
    if (!found.multi) {
      delete this._responseCallbacks[correlationId];
    }
    return found.cb;
  } else {
    return function() {};
  }
};
