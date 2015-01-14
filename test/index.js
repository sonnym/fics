var path = require("path");

var FICSClient = require(path.join(__filename, "..", ".."));
var MockSocket = require("./lib/mock_socket");

process.on("uncaughtException", function(err) {
  console.log("\nEXCEPTION:");
  console.log(err);
  console.log(err.stack);
});

exports.coreFunctionality = require("./lib/core_functionality");
exports.login = require("./lib/login");
exports.talking = require("./lib/talking");
exports.channels = require("./lib/channels");
exports.observation = require("./lib/observation");

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
