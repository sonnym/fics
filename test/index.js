var net = require("net");
var path = require("path");

var sinon = require("sinon");

var Q = require("q");

var FICSClient = require(path.join(__filename, "..", ".."));

var MockSocket = require("./mock_socket");

process.on("uncaughtException", function(err) {
  console.log("\nEXCEPTION:");
  console.log(err);
  console.log(err.stack);
});

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

exports.testChat = function(test) {
  var mockSocket = new MockSocket(test);
  var messages = [
    { type: "tell", user: "foobarbaz", message: "test test" }
  , { type: "it", user: "MAd>", message: "(ics-auto-salutes 'romeo)" }
  , { type: "shout", user: "PumaGM", message: "it's cool coz u can play on fics and not feel so guilty for wasting time" }
  , { type: "tell", user: "callipygian(C)", channel: "50", message: "actually a test not real data :(" }
  ];

  var fics = new FICSClient();

  fics.chat().progress(function(message) {
    test.deepEqual(messages.shift(), message);

    if (messages.length === 0) {
      mockSocket.close();
    }
  });

  mockSocket.registerFixture("chat");
  mockSocket.run();
};

exports.testChannelList = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerMessage("help channel_list");
  mockSocket.registerFixtures(["channel_list_page1", "channel_list_page2", "channel_list_page3",
                               "channel_list_page4", "channel_list_page5"]);

  var fics = new FICSClient();

  fics.channelList().then(function(channels) {
    test.equal(72, channels.length);

    mockSocket.close();
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
  });
};

exports.testTellUserSuccess = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("tell_user_success");
  mockSocket.registerMessage("tell foobarbaz test");

  var fics = new FICSClient();

  fics.tell("foobarbaz", "test").then(function (success) {
    test.ok(success);

    mockSocket.close()
  });
};

exports.testTellUserFailure = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("tell_user_failure");
  mockSocket.registerMessage("tell foobarbaz test");

  var fics = new FICSClient();

  fics.tell("foobarbaz", "test").then(function (success) {
    test.ok(!success);

    mockSocket.close()
  });
};

exports.testTellChannelOfficialSuccess = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("tell_channel_official_success");
  mockSocket.registerMessage("tell 50 test");

  var fics = new FICSClient();

  fics.tell("50", "test").then(function (success) {
    test.ok(success);

    mockSocket.close()
  });
};

exports.testTellChannelUnofficialSuccess = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("tell_channel_unofficial_success");
  mockSocket.registerMessage("tell 128 test");

  var fics = new FICSClient();

  fics.tell("128", "test").then(function (success) {
    test.ok(success);

    mockSocket.close()
  });
};

exports.testTellChannelUnregisteredFailure = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("tell_channel_unregistered_failure");
  mockSocket.registerMessage("tell 5 test");

  var fics = new FICSClient();

  fics.tell("5", "test").then(function (success) {
    test.ok(!success);

    mockSocket.close()
  });
};

exports.testTellChannelRestrictedFailure = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("tell_channel_restricted_failure");
  mockSocket.registerMessage("tell 5 test");

  var fics = new FICSClient();

  fics.tell("5", "test").then(function (success) {
    test.ok(!success);

    mockSocket.close()
  });
};

exports.testTellChannelOutOfBoundsFailure = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("tell_channel_out_of_bounds_failure");
  mockSocket.registerMessage("tell 1024 test");

  var fics = new FICSClient();

  fics.tell("1024", "test").then(function (success) {
    test.ok(!success);

    mockSocket.close()
  });
};

exports.testShoutSuccess = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("shout_success");
  mockSocket.registerMessage("shout test");

  var fics = new FICSClient();

  fics.shout("test").then(function (success) {
    test.ok(success);

    mockSocket.close()
  });
};

exports.testShoutItSuccess = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("shout_success");
  mockSocket.registerMessage("it test");

  var fics = new FICSClient();

  fics.shout("test", true).then(function (success) {
    test.ok(success);

    mockSocket.close()
  });
};

exports.testShoutFailure = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("shout_failure");
  mockSocket.registerMessage("shout test");

  var fics = new FICSClient();

  fics.shout("test").then(function (success) {
    test.ok(!success);

    mockSocket.close()
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
    , { result: "0-1" }
    ];

  fics.observe(47).progress(function(data) {
    test.deepEqual(notifications.shift(), data);
  }).then(function(result) {
    mockSocket.close();
  });
};

exports.testObservingMultipleGames = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerMessages(["observe 47", "observe 8"]);

  var fics = new FICSClient();

  Q.all([fics.observe("47"), fics.observe("8")]).then(function(results) {
    test.equal(2, results.length);

    mockSocket.close();
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
  });
};

exports.testObservers = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("observers");
  mockSocket.registerMessage("allobservers 93");

  var fics = new FICSClient();

  fics.observers("93").then(function(observers) {
    test.equal(6, observers.length);

    mockSocket.close();
  });
};

exports.testKibitz = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("kibitz");
  mockSocket.registerMessage("xkibitz 85 test");

  var fics = new FICSClient();

  fics.kibitz("85", "test").then(function(success) {
    test.ok(success);

    mockSocket.close();
  });
};

exports.testWhisper = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("whisper");
  mockSocket.registerMessage("xwhisper 85 test");

  var fics = new FICSClient();

  fics.whisper("85", "test").then(function(success) {
    test.ok(success);

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

exports.testGetSocket = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("login_screen");

  var fics = new FICSClient();
  fics.getSocket().on("data", function() {
    mockSocket.close();
  });

  mockSocket.run();
};
