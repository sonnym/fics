var net = require("net");
var path = require("path");

var sinon = require("sinon");

var fics = require(path.join(__filename, "..", ".."));

exports.test_client_can_be_created = function(test) {
  var mockConnection = sinon.mock(net)
                            .expects("connect")
                            .withExactArgs({ host: "freechess.org", port: 5000 })
                            .returns({ on: function() { } });

  new fics();

  mockConnection.verify();
  test.done();
}

exports.test_login = function(test) {

}
