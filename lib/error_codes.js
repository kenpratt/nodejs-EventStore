var utils = require("./utils");

module.exports = {};

module.exports.codeForMessage = {
  Success: 0,
  PrepareTimeout: 1,
  CommitTimeout: 2,
  ForwardTimeout: 3,
  WrongExpectedVersion: 4,
  StreamDeleted: 5,
  InvalidTransaction: 6
};

module.exports.messageForCode = utils.reverseHash(module.exports.codeForMessage);
