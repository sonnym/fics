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
  var username = "foo";
  var password = "bar";

  var mockSocket = new MockSocket(test);
  mockSocket.registerFixtures(["login_screen", "login_intermezzo", "login_success"]);
  mockSocket.registerMessages([username, password, "set seek 0"]);

  var fics = new FICSClient();

  mockSocket.run();

  var loginPromise = fics.login({ login: username, password: password });
  loginPromise.then(function(data) {
    test.equal(data.username, username);

    mockSocket.close();
    test.done();
  });
}
