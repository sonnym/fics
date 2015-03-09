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

exports.testAdmins = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("showadmins");
  mockSocket.registerMessage("showadmins");

  var fics = new FICSClient();

  fics.admins().then(function(admins) {
    test.equal(7, admins.length);
    test.equal("9 mins", admins[0].idle);

    mockSocket.close();
  });
};
