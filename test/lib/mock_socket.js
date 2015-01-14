var fs = require("fs");
var path = require("path");

var events = require("events");
var net = require("net");

var util = require("util");

var sinon = require("sinon");

var MockSocket = function(test) {
  events.EventEmitter.call(this);

  this.test = test;

  this.fixtures = [];
  this.expectedMessages = [];

  this.mockConnection = sinon.mock(net)
  this.mockConnection.expects("connect").returns(this);
};

util.inherits(MockSocket, events.EventEmitter);

MockSocket.prototype.registerFixtures = function(fixtures) {
  for (var i = 0, l = fixtures.length; i < l; i++) {
    this.registerFixture(fixtures[i]);
  }
};

MockSocket.prototype.registerFixture = function(fixtureName) {
  this.fixtures.push(fixtureName);
};

MockSocket.prototype.registerMessages = function(messages) {
  for (var i = 0, l = messages.length; i < l; i++) {
    this.registerMessage(messages[i]);
  }
};

MockSocket.prototype.registerMessage = function(message) {
  this.expectedMessages.push(message);
};

MockSocket.prototype.write = function(chunk, encoding) {
  this.test.equal("utf8", encoding);
  this.test.equal("\r\n", chunk.substr(chunk.length - 2));

  if (this.expectedMessages.length > 0) {
    var message = this.expectedMessages.shift();
    this.test.equal(chunk.substr(0, message.length), message);
  }

  this.processNextFixture();
};

MockSocket.prototype.run = function() {
  this.processNextFixture();
};

MockSocket.prototype.processNextFixture = function() {
  if (this.fixtures.length === 0) {
    return;
  }

  var self = this;
  loadFixture(this.fixtures.shift(), function(err, data) {
    self.test.ifError(err);
    self.emit("data", data);
  });
};

MockSocket.prototype.close = function() {
  this.mockConnection.restore();

  if (this.fixtures.length > 0) {
    this.test.ok(false, "unused fixtures: " + this.fixtures.join(", "));
  }

  if (this.expectedMessages.length > 0) {
    this.test.ok(false, "expected messages unmet: " + this.expectedMessages.join(", "));
  }

  this.test.done();
};

module.exports = MockSocket;

function loadFixture(fixtureName, cb) {
  fs.readFile(path.join(__dirname, "..", "fixtures", fixtureName), cb);
}
