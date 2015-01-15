var net = require("net");
var path = require("path");

var _ = require("underscore");
var sinon = require("sinon");

var FICSClient = require(path.join(__filename, "..", "..", ".."));
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

exports.testGetSocket = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("login_screen");

  var fics = new FICSClient();
  fics.getSocket().on("data", function() {
    mockSocket.close();
  });

  mockSocket.run();
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

exports.testLinesFunction = function(test) {
  var client = new FICSClient();
  var socket = client.getSocket();

  var listenerCount = 25;

  var deffereds = _.map(Array(listenerCount), function(n) {
    return _.tap(client.lines(_.noop), function() {
      test.equal(1, socket.listeners("data").length);
    });
  });

  _.invoke(deffereds, "resolve");

  client.end();

  test.done();
};
