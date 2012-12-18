var Connection = require("./connection");

module.exports = {
  connect: function(ip, port) {
    return new Connection(ip, port);
  }
};
