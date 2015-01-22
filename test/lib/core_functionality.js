var net = require("net");
var path = require("path");

var EventEmitter = require("events").EventEmitter;
var Readable = require("stream").Readable;

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

exports.testClientIsAnEmitter = function(test) {
  var mockSocket = new MockSocket(test);

  var fics = new FICSClient();
  test.ok(fics instanceof EventEmitter);


  fics.on("foo", function() {
    mockSocket.close();
  });

  // force private socket to emit an event
  fics.socket.emit("foo");
};

exports.testGetStream = function(test) {
  var mockSocket = new MockSocket(test);
  mockSocket.registerFixture("login_screen");

  var fics = new FICSClient();
  var stream = fics.getStream();

  test.ok(stream instanceof Readable);

  stream.on("data", function(data) {
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

exports.lines = {
  testDoesNotCreateAdditionalListenersOnUnderlyingSocket: function(test) {
    var client = new FICSClient();
    var socket = client.socket;

    var listenerCount = 25;

    var deffereds = _.map(Array(listenerCount), function(n) {
      return _.tap(client.lines(_.noop), function() {
        test.equal(1, socket.listeners("data").length);
      });
    });

    _.invoke(deffereds, "resolve");

    client.end();
    test.done();
  },

  testCallbackDoesNotInterceptUnderlyingPromise: function(test) {
    var client = new FICSClient();

    var deferred = client.lines(function(msg) {
      test.equal(msg, "first call");

      deferred.resolve();
    });

    client.deferredData.notify("first call");

    deferred.promise.then(function() {
      test.ok(deferred.promise.isFulfilled());
    });

    process.nextTick(function() {
      client.deferredData.notify("second call");

      client.end();
      test.done();
    });
  }
}
