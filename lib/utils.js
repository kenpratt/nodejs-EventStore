module.exports.reverseHash = function(hash) {
  var out = {};
  for (var key in hash) {
    if (hash.hasOwnProperty(key)) {
      out[hash[key]] = key;
    }
  }
  return out;
};
