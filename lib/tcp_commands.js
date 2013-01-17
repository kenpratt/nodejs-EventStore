var utils = require("./utils");

module.exports = {};

module.exports.codeForType = {
  // copied from EventStore/src/EventStore/EventStore.Core/Services/Transport/Tcp/TcpCommand.cs
  // SYSTEM COMMANDS
  HeartbeatRequestCommand: 0x01,
  HeartbeatResponseCommand: 0x02,

  Ping: 0x03,
  Pong: 0x04,

  PrepareAck: 0x05,
  CommitAck: 0x06,

  SlaveAssignment: 0x07,
  CloneAssignment: 0x08,

  SubscribeReplica: 0x10,
  ReplicaLogPositionAck: 0x11,
  CreateChunk: 0x12,
  PhysicalChunkBulk: 0x13,
  LogicalChunkBulk: 0x14,

  // CLIENT COMMANDS
  CreateStream: 0x80,
  CreateStreamCompleted: 0x81,

  WriteEvents: 0x82,
  WriteEventsCompleted: 0x83,

  TransactionStart: 0x84,
  TransactionStartCompleted: 0x85,
  TransactionWrite: 0x86,
  TransactionWriteCompleted: 0x87,
  TransactionCommit: 0x88,
  TransactionCommitCompleted: 0x89,

  DeleteStream: 0x8A,
  DeleteStreamCompleted: 0x8B,

  ReadEvent: 0xB0,
  ReadEventCompleted: 0xB1,
  ReadStreamEventsForward: 0xB2,
  ReadStreamEventsForwardCompleted: 0xB3,
  ReadStreamEventsBackward: 0xB4,
  ReadStreamEventsBackwardCompleted: 0xB5,
  ReadAllEventsForward: 0xB6,
  ReadAllEventsForwardCompleted: 0xB7,
  ReadAllEventsBackward: 0xB8,
  ReadAllEventsBackwardCompleted: 0xB9,

  SubscribeToStream: 0xC0,
  SubscriptionConfirmation: 0xC1,
  StreamEventAppeared: 0xC2,
  UnsubscribeFromStream: 0xC3,
  SubscriptionDropped: 0xC4,

  ScavengeDatabase: 0xD0,

  BadRequest: 0xF0,
  DeniedToRoute: 0xF1
};

module.exports.typeForCode = utils.reverseHash(module.exports.codeForType);
