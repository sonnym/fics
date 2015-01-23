var path = require("path");

var FICSClient = require(path.join(__filename, "..", "..", ".."));
var MockSocket = require("./mock_socket");

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
