var path = require("path");

var FICSClient = require(path.join(__filename, "..", "..", ".."));
var MockSocket = require("./mock_socket");

exports.testWho = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("who");
  mockSocket.registerMessage("who");

  var fics = new FICSClient();

  fics.who().then(function(users) {
    test.equal(1831, users.length);

    mockSocket.close();
  });
};
