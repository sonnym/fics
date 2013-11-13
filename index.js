var net = require("net");

var Q = require("q");
var _ = require("underscore");

var fics_host = "freechess.org";
var fics_port = 5000;

var FICSClient = function() {
  this.socket = net.connect({ port: fics_port, host: fics_host });
  this.deferred = Q.defer();

  var self = this;
  this.socket.on("data", function(data) {
    self.deferred.notify(data.toString());
  });

  this.promise.then(null, null, function(data) {
    if (data.match(/Type \[next\] to see next page\./)) {
      self.send_message("next");
    }
  });

  this.command_queue = [];
};

FICSClient.prototype.__defineGetter__("promise", function() {
  return this.deferred.promise;
});

FICSClient.prototype.lines = function(callback) {
  var deferred_data = Q.defer();
  var buffered_data = "";

  this.promise.then(null, null, function(data) {
    var lines = (buffered_data + data).split("\n");

    if (data[data.length - 1] !== "\n" && data.substr(-2, 2) !== ": ") {
      buffered_data = lines.pop();
    }

    _.each(lines, function(line) {
      deferred_data.notify(line);
    });
  });

  deferred_data.promise.then(null, null, callback);

  return deferred_data;
};

FICSClient.prototype.issue_command = function(command, promise, callback) {
  if (arguments.length === 1) {
    var deferred = Q.defer();
    promise = deferred.promise;

    callback = function(data) {
      if (data.match(/fics%/)) {
        deferred.resolve();
      }
    }
  }

  var self = this;
  this.command_queue.push(function() {
    var deferred_lines = self.lines(callback);

    self.send_message(command);

    promise.then(function() {
      deferred_lines.resolve();

      self.command_queue.shift();

      if (self.command_queue.length > 0) {
        self.command_queue[0]();
      }
    });
  });

  if (this.command_queue.length === 1) {
    this.command_queue[0]();
  }
}

FICSClient.prototype.send_message = function(message) {
  this.socket.write(message + "\n", "utf8");
}

FICSClient.prototype.login = function(user_data) {
  if (user_data.login) {
    var username = user_data.login;
    var password = user_data.password;
  } else {
    var username = "guest";
  }

  var match = null;
  var server_username;

  var self = this;
  var deferred_login = this.lines(function(data) {
    if (data.match(/login:/)) {
      self.send_message(username);
    }

    if (data.match(/password:/)) {
      self.send_message(password);
    }

    if (data.match(/Press return/)) {
      self.send_message("");
    }

    if (match = data.match(/\*{4} Starting FICS session as (.*) \*{4}/)) {
      var server_username = match[1];
    }

    if (data.match(/fics%/)) {
      self.issue_command("set seek 0");
      deferred_login.resolve({ username: server_username });
    }
  });

  return deferred_login.promise;
};

FICSClient.prototype.channel_list = function() {
  var deferred_channels = Q.defer();

  var channels = [];
  var match = null;
  var stop_matching = false;

  this.send_message("help channel_list");

  this.issue_command("help channel_list", deferred_channels.promise, function(data) {
    if (data.match(/Last Modified/)) {
      deferred_channels.resolve(channels);
    }

    if (data.match(/SPECIAL NOTE/)) {
      stop_matching = true;
    }

    if (match = data.match(/\d+(?:,\d+)*\s.*/g)) {
      if (stop_matching) {
        return;
      }

      var channel_data = match[0].split(/\s+/);
      var channel_numbers = channel_data.shift().split(",");

      _.each(channel_numbers, function(channel_number) {
        channels.push({ number: channel_number, name: channel_data.join(" ") });
      });
    }
  });

  return deferred_channels.promise;
};

FICSClient.prototype.games = function() {
  var deferred_games = Q.defer();

  var games = [];
  var match = null;

  this.issue_command("games", deferred_games.promise, function(data) {
    if (match = data.match(/(\d+)\s+(\d+|\+{4})\s+(\w+)\s+(\d+|\+{4})\s+(\w+)\s+\[.*\]\s+((?:\d+:)?\d+:\d+)\s+-\s+((?:\d+:)?\d+:\d+)\s+\(.*\)\s+(W|B):\s+(\d+)/)) {
      games.push({ number: match[1]
                 , white: { name: match[3], rating: match[2], time: match[6] }
                 , black: { name: match[5], rating: match[4], time: match[7] }
                 , move: { color: match[8], number: match[9] }
                 });
    }

    if (data.match(/\d+ games displayed./)) {
      deferred_games.resolve(games);
    }
  });

  return deferred_games.promise;
};

module.exports = FICSClient;
