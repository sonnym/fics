var path = require("path");

var FICSClient = require(path.join(__filename, "..", "..", ".."));
var MockSocket = require("./mock_socket");

exports.testSought = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("sought");
  mockSocket.registerMessage("sought");

  var fics = new FICSClient();
  var deferredSought = fics.sought().then(function(games) {
    test.equal(41, games.length)

    mockSocket.close();
  });
};
