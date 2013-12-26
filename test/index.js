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

exports.test_guest_login = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixtures(["login_screen", "login_guest_intermezzo", "login_guest_success"]);
  mockSocket.registerMessage("guest");

  var fics = new FICSClient();

  mockSocket.run();

  var loginPromise = fics.login({});
  loginPromise.then(function(data) {
    test.equal(data.username, "GuestTXCW(U)");

    mockSocket.close();
    test.done();
  });
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

exports.test_channel_list = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerMessage("help channel_list");
  mockSocket.registerFixtures(["channel_list_page1", "channel_list_page2", "channel_list_page3",
                               "channel_list_page4", "channel_list_page5"]);

  var fics = new FICSClient();

  var channelListPromise = fics.channelList();
  channelListPromise.then(function(channels) {
    test.equal(72, channels.length);

    mockSocket.close();
    test.done();
  });
}

exports.test_games = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerMessage("games");
  mockSocket.registerFixture("games");

  var fics = new FICSClient();
  fics.games().then(function(games) {
    test.equal(318, games.length);

    mockSocket.close();
    test.done();
  });
}
