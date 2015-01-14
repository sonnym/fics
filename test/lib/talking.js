var path = require("path");

var FICSClient = require(path.join(__filename, "..", "..", ".."));
var MockSocket = require("./mock_socket");

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
