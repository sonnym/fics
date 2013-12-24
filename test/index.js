var net = require("net");
var path = require("path");

var sinon = require("sinon");

var FICSClient = require(path.join(__filename, "..", ".."));

var MockSocket = require("./mock_socket");

exports.test_client_can_be_created = function(test) {
  var mockConnection = sinon.mock(net);
  mockConnection.expects("connect")
                .withExactArgs({ host: "freechess.org", port: 5000 })
                .returns({ on: function() { } });

  new FICSClient();

  mockConnection.verify();
  mockConnection.restore();

  test.done();
}

exports.test_user_login = function(test) {
  var mockSocket = new MockSocket();
  mockSocket.registerFixture("login_screen");

  mockSocket.run();

  var fics = new FICSClient();
  var loginPromise = fics.login({ login: "foo", password: "bar" });

  mockSocket.close();
  test.done();
}
