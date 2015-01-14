var path = require("path");

var FICSClient = require(path.join(__filename, "..", "..", ".."));
var MockSocket = require("./mock_socket");

exports.testGuestLogin = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixtures(["login_screen", "login_guest_intermezzo", "login_guest_success"]);
  mockSocket.registerMessage("guest");

  var fics = new FICSClient();

  mockSocket.run();

  fics.login().then(function(data) {
    test.equal(data.username, "GuestTXCW(U)");

    mockSocket.close();
    fics.end();
  });
};

exports.testUserLogin = function(test) {
  var username = "foo";
  var password = "bar";

  var mockSocket = new MockSocket(test);
  mockSocket.registerFixtures(["login_screen", "login_intermezzo", "login_success"]);
  mockSocket.registerMessages([username, password, "set prompt", "set seek 0", "set style 12"]);

  var fics = new FICSClient();

  mockSocket.run();

  fics.login({ login: username, password: password }).then(function(data) {
    test.equal(data.username, username);

    mockSocket.close();
    fics.end();
  });
};

exports.testUserLoginFailure = function(test) {
  var username = "test";
  var password = "bar";

  var mockSocket = new MockSocket(test);
  mockSocket.registerFixtures(["login_screen", "login_intermezzo", "login_failure"]);
  mockSocket.registerMessages([username, password]);

  var fics = new FICSClient();

  mockSocket.run();

  fics.login({ login: username, password: password }).fail(function(err) {
    test.equal(err.message, "Invalid Password");

    mockSocket.close();
  });
};

