var path = require("path");

var Q = require("q");

var FICSClient = require(path.join(__filename, "..", "..", ".."));
var MockSocket = require("./mock_socket");

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
