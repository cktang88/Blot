var normalize = require("./normalize");
var get = require("./_get");

// This is the method exposed publicly
// It checks a few variants of the tag
// until it finds one that works. 
// It first tries the normalized tag,
// then the tag as it was entered,
// then the tag as it was entered but decoded, e.g.
// "Hello%20World" -> "Hello World" 
module.exports = function (blogID, tag, callback) {
  get(blogID, normalize(tag), function (err, entryIDs, prettyTag) {
    if (entryIDs && entryIDs.length) {
      return callback(null, entryIDs, prettyTag);
    }

    get(blogID, tag, function (err, entryIDs, prettyTag) {
      if (entryIDs && entryIDs.length) {
        return callback(null, entryIDs, prettyTag);
      }

      get(blogID, decodeURIComponent(tag), callback);
    });
  });
};
