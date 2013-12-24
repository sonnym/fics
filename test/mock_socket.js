var fs = require("fs");
var path = require("path");

var events = require("events");
var net = require("net");

var assert = require("assert");
var util = require("util");

var sinon = require("sinon");

var MockSocket = function() {
  events.EventEmitter.call(this);

  this.fixtures = [];

  this.mockConnection = sinon.mock(net)
  this.mockConnection.expects("connect").returns(this);
};

util.inherits(MockSocket, events.EventEmitter);

MockSocket.prototype.registerFixture = function(fixtureName) {
  this.fixtures.push(fixtureName);
};

MockSocket.prototype.write = function(chunk, encoding) {
  assert.equal("utf8", encoding);
  assert.equal("\n", chunk.substr(chunk.length - 1));

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
    console.log("fixture loaded");
    assert.ifError(err);

    self.emit("data", data);
  });
};

MockSocket.prototype.close = function() {
  this.mockConnection.restore();
};

module.exports = MockSocket;

function loadFixture(fixtureName, cb) {
  fs.readFile(path.join(__dirname, "fixtures", fixtureName), cb);
}
