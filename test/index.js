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
};

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
};

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
};

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
};

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
};

exports.test_observe = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerMessage("observe 47");
  mockSocket.registerFixture("observation");

  var fics = new FICSClient();

  var notifications =
    [
      { white: { name: "CANABLANCA", rating: "1776" }
      , black: { name: "GriffySr", rating: "2094" }
      , rated: true
      , type: "blitz"
      , time: { initial: "5", increment: "0" }
      }
    , { position: "8/1p1Q1pkp/pq1p2p1/5r2/P1p2P2/1P5P/6P1/1R5K", color: "W", time: "0:00" }
    , { position: "8/1p1Q1pkp/pq1p2p1/5r2/P1p2P2/1P5P/6P1/3R3K", color: "B", time: "0:08" }
    , { position: "8/1p1Q1pkp/p2p2p1/5r2/P1p2P2/1q5P/6P1/3R3K", color: "W", time: "0:00" }
    , { position: "8/1p1Q1pkp/p2R2p1/5r2/P1p2P2/1q5P/6P1/7K", color: "B", time: "0:03" }
    , { position: "8/1p1Q1pkp/p2R2p1/8/P1p2r2/1q5P/6P1/7K", color: "W", time: "0:00" }
    , { position: "4Q3/1p3pkp/p2R2p1/8/P1p2r2/1q5P/6P1/7K", color: "B", time: "0:17" }
    , { position: "4Q3/1p3pkp/p2R2p1/8/P1p2r2/7P/6P1/1q5K", color: "W", time: "0:00" }
    , { position: "4Q3/1p3pkp/p2R2p1/8/P1p2r2/7P/6PK/1q6", color: "B", time: "0:02" }
    , { position: "4Q3/1p3pkp/p2R2p1/8/P1p1qr2/7P/6PK/8", color: "W", time: "0:00" }
    , { position: "2Q5/1p3pkp/p2R2p1/8/P1p1qr2/7P/6PK/8", color: "B", time: "0:15" }
    , { position: "2Q5/1p3pkp/p2R2p1/4q3/P1p2r2/7P/6PK/8", color: "W", time: "0:00" }
    , { position: "2Q5/1p3pkp/p5p1/4q3/P1p2r2/7P/3R2PK/8", color: "B", time: "0:15" }
    , { position: "2Q5/1p3pkp/p5p1/4q3/P1p5/5r1P/3R2PK/8", color: "W", time: "0:00" }
    ];

  var observationPromise = fics.observe(47);
  observationPromise.then(function(result) {
    test.equal("0-1", result);

    mockSocket.close();
    test.done();
  }, null, function(data) {
    test.deepEqual(notifications.shift(), data);
  });
};

exports.test_sought = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("sought");
  mockSocket.registerMessage("sought");

  var fics = new FICSClient();
  var deferredSought = fics.sought().then(function(games) {
    test.equal(41, games.length)

    mockSocket.close();
    test.done();
  });
};

exports.test_getSocket = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("login_screen");

  var fics = new FICSClient();
  fics.getSocket().on("data", function() {
    mockSocket.close();
    test.done();
  });

  mockSocket.run();
};
