var net = require("net");
var path = require("path");

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
