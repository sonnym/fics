var net = require("net");
var path = require("path");

var sinon = require("sinon");

var Q = require("q");

var FICSClient = require(path.join(__filename, "..", ".."));

var MockSocket = require("./mock_socket");

exports.testClientCanBeCreated = function(test) {
  var mockConnection = sinon.mock(net);
  mockConnection.expects("connect")
                .withExactArgs({ host: "freechess.org", port: 5000 })
                .returns({ on: function() { } });

  new FICSClient();

  mockConnection.verify();
  mockConnection.restore();

  test.done();
};

exports.testClose = function(test) {
  var mockStream = sinon.mock({ on: function() { }, removeAllListeners: function() { }, end: function() { } });
  mockStream.expects("removeAllListeners").once().returns(mockStream.object);
  mockStream.expects("end").once()

  var mockConnection = sinon.mock(net);
  mockConnection.expects("connect").returns(mockStream.object);

  (new FICSClient()).end();

  mockStream.verify();
  mockConnection.restore();

  test.done();
};

exports.testguestLogin = function(test) {
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

exports.testUserLogin = function(test) {
  var username = "foo";
  var password = "bar";

  var mockSocket = new MockSocket(test);
  mockSocket.registerFixtures(["login_screen", "login_intermezzo", "login_success"]);
  mockSocket.registerMessages([username, password, "set seek 0", "set style 12"]);

  var fics = new FICSClient();

  mockSocket.run();

  var loginPromise = fics.login({ login: username, password: password });
  loginPromise.then(function(data) {
    test.equal(data.username, username);

    mockSocket.close();
    test.done();
  });
};

exports.testChannelList = function(test) {
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

exports.testChannels = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerMessage("=channel");
  mockSocket.registerFixture("channel");

  var fics = new FICSClient();

  fics.channels().then(function(channels) {
    test.equal(14, channels.length);

    mockSocket.close();
    test.done();
  });
};

exports.testJoinChannelSuccess = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("channel_add_success");
  mockSocket.registerMessage("+channel 31");

  var fics = new FICSClient();

  fics.joinChannel("31").then(function(success) {
    test.ok(success);

    mockSocket.close();
    test.done();
  });
};

exports.testJoinChannelFailure = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("channel_add_failure");
  mockSocket.registerMessage("+channel 31");

  var fics = new FICSClient();

  fics.joinChannel("31").then(function(success) {
    test.ok(!success);

    mockSocket.close();
    test.done();
  });
};

exports.testLeaveChannelSuccess = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("channel_leave_success");
  mockSocket.registerMessage("-channel 31");

  var fics = new FICSClient();

  fics.leaveChannel("31").then(function(success) {
    test.ok(success);

    mockSocket.close();
    test.done();
  });
};

exports.testLeaveChannelFailure = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("channel_leave_failure");
  mockSocket.registerMessage("-channel 31");

  var fics = new FICSClient();

  fics.leaveChannel("31").then(function(success) {
    test.ok(!success);

    mockSocket.close();
    test.done();
  });
};

exports.testWho = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("who");
  mockSocket.registerMessage("who");

  var fics = new FICSClient();

  fics.who().then(function(users) {
    test.equal(1831, users.length);

    mockSocket.close();
    test.done();
  });
};

exports.testGames = function(test) {
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

exports.testObserve = function(test) {
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
    , { position: "8/1p1Q1pkp/pq1p2p1/5r2/P1p2P2/1P5P/6P1/1R5K"
      , current: { color: "W", move: "35" }
      , time: { white: "158", black: "296" }
      , move: { verbose: "R/e5-f5", algebraic: "Rf5" } }
    , { position: "8/1p1Q1pkp/pq1p2p1/5r2/P1p2P2/1P5P/6P1/3R3K"
      , current: { color: "B", move: "35" }
      , time: { white: "153", black: "296" }
      , move: { verbose: "R/b1-d1", algebraic: "Rd1" } }
    , { position: "8/1p1Q1pkp/p2p2p1/5r2/P1p2P2/1q5P/6P1/3R3K"
      , current: { color: "W", move: "36" }
      , time: { white: "153", black: "296" }
      , move: { verbose: "Q/b6-b3", algebraic: "Qxb3" } }
    , { user: "GriffySr(C)(2094)"
      , message: "ply=4; eval=-3.74; nps=14K; time=0.12; egtb=0"
      , type: "whisper" }
    , { position: "8/1p1Q1pkp/p2R2p1/5r2/P1p2P2/1q5P/6P1/7K"
      , current: { color: "B", move: "36" }
      , time: { white: "151", black: "296" }
      , move: { verbose: "R/d1-d6", algebraic: "Rxd6" } }
    , { position: "8/1p1Q1pkp/p2R2p1/8/P1p2r2/1q5P/6P1/7K"
      , current: { color: "W", move: "37" }
      , time: { white: "151", black: "296" }
      , move: { verbose: "R/f5-f4", algebraic: "Rxf4" } }
    , { user: "GriffySr(C)(2094)"
      , message: "ply=4; eval=-4.19; nps=15K; time=0.14; egtb=0"
      , type: "whisper" }
    , { position: "4Q3/1p3pkp/p2R2p1/8/P1p2r2/1q5P/6P1/7K"
      , current: { color: "B", move: "37" }
      , time: { white: "133", black: "296" }
      , move: { verbose: "Q/d7-e8", algebraic: "Qe8" } }
    , { position: "4Q3/1p3pkp/p2R2p1/8/P1p2r2/7P/6P1/1q5K"
      , current: { color: "W", move: "38" }
      , time: { white: "133", black: "296" }
      , move: { verbose: "Q/b3-b1", algebraic: "Qb1+" } }
    , { user: "GriffySr(C)(2094)"
      , message: "ply=4; eval=-4.22; nps=43K; time=0.07; egtb=0"
      , type: "whisper" }
    , { position: "4Q3/1p3pkp/p2R2p1/8/P1p2r2/7P/6PK/1q6"
      , current: { color: "B", move: "38" }
      , time: { white: "132", black: "296" }
      , move: { verbose: "K/h1-h2", algebraic: "Kh2" } }
    , { position: "4Q3/1p3pkp/p2R2p1/8/P1p1qr2/7P/6PK/8"
      , current: { color: "W", move: "39" }
      , time: { white: "132", black: "295" }
      , move: { verbose: "Q/b1-e4", algebraic: "Qe4" } }
    , { user: "GriffySr(C)(2094)"
      , message: "ply=4; eval=-4.33; nps=26K; time=0.06; egtb=0"
      , type: "whisper" }
    , { position: "2Q5/1p3pkp/p2R2p1/8/P1p1qr2/7P/6PK/8"
      , current: { color: "B", move: "39" }
      , time: { white: "117", black: "295" }
      , move: { verbose: "Q/e8-c8", algebraic: "Qc8" } }
    , { position: "2Q5/1p3pkp/p2R2p1/4q3/P1p2r2/7P/6PK/8"
      , current: { color: "W", move: "40" }
      , time: { white: "117", black: "295" }
      , move: { verbose: "Q/e4-e5", algebraic: "Qe5" } }
    , { user: "GriffySr(C)(2094)"
      , message: "ply=4; eval=-10.05; nps=33K; time=0.15; egtb=0"
      , type: "whisper" }
    , { position: "2Q5/1p3pkp/p5p1/4q3/P1p2r2/7P/3R2PK/8"
      , current: { color: "B", move: "40" }
      , time: { white: "102", black: "295" }
      , move: { verbose: "R/d6-d2", algebraic: "Rd2" } }
    , { position: "2Q5/1p3pkp/p5p1/4q3/P1p5/5r1P/3R2PK/8"
      , current: { color: "W", move: "41" }
      , time: { white: "102", black: "295" }
      , move: { verbose: "R/f4-f3", algebraic: "Rf3+" } }
    , { user: "GriffySr(C)(2094)"
      , message: "ply=4; eval=-11.31; nps=53K; time=0.08; egtb=0"
      , type: "whisper" }
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

exports.testObservingMultipleGames = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerMessages(["observe 47", "observe 8"]);

  var fics = new FICSClient();

  Q.all([fics.observe("47"), fics.observe("8")]).then(function(results) {
    test.equal(2, results.length);

    mockSocket.close();
    test.done();
  });

  mockSocket.registerFixture("observation");
  mockSocket.run();
};

exports.testMoves = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("moves");
  mockSocket.registerMessage("moves 93");

  var fics = new FICSClient();

  fics.moves("93").then(function(moves) {
    test.equal(16, moves.length);
    test.equal(2, moves[14].length);
    test.equal(1, moves[15].length);

    mockSocket.close();
    test.done();
  });
};

exports.testObservers = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("observers");
  mockSocket.registerMessage("allobservers 93");

  var fics = new FICSClient();

  fics.observers("93").then(function(observers) {
    test.equal(6, observers.length);

    test.done();
    mockSocket.close();
  });
};

exports.testUnobserveSuccess = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("unobserve_success");
  mockSocket.registerMessage("unobserve 433");

  var fics = new FICSClient();

  fics.unobserve("433").then(function(success) {
    test.ok(success);

    mockSocket.close();
    test.done();
  });
};

exports.testUnobserveFailure = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("unobserve_failure");
  mockSocket.registerMessage("unobserve 433");

  var fics = new FICSClient();

  fics.unobserve("433").then(function(success) {
    test.ok(!success);

    mockSocket.close();
    test.done();
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
    test.done();
  });
};

exports.testGetSocket = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("login_screen");

  var fics = new FICSClient();
  fics.getSocket().on("data", function() {
    mockSocket.close();
    test.done();
  });

  mockSocket.run();
};
