// # FICS
//
// A promise-based library for interacting with the Free Internet Chess Server

var net = require("net");

var Q = require("q");
var _ = require("underscore");

var fics_host = "freechess.org";
var fics_port = 5000;

// ## FICSClient
//
// The main object for interacting with the FICS server. Creates a new
// connection and handles all command processing.
//
// ```
// var FICSClient = require("fics");
// var fics = new FICSClient();
// ```
// @constructor
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

// ### promise
//
// Provides access to the raw data received from the FICS server
//
// @return {Promise}
FICSClient.prototype.__defineGetter__("promise", function() {
  return this.deferred.promise;
});

// ### lines
//
// Creates a new promise and then feeds each line of input to the provided
// callback. This allows a command to process the stream line-by-line until it
// determines that the promise can be discarded.
//
// @param {function} callback A callback that will be attached to the promise
// @return {Promise} The promise with attached callback
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

// ### issue_command
//
// Sends a commands to the FICS server. Internally manaages a queue of commands
// that run synchronously to prevent interference with each other, then
// automatically calls the next command if any are remaining.
//
// @param {string} command The text of the command
// @param {Promise} [promise] An optional promise that will be resolved when
//                            the command is complete
// @param {function} [callback] An optional callback function to process lines
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

// ### send_message
//
// sends a message with the approriate encoding and termination character
//
// @param {string} message a Message to send to the FICS server
FICSClient.prototype.send_message = function(message) {
  this.socket.write(message + "\n", "utf8");
}

// ### login
//
// logs in a user based on the provided data
//
// @param {object} user_data Hash with login and password keys
// @return {Promise} promise that will resolve with the user login information
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
      server_username = match[1];
    }

    if (data.match(/fics%/)) {
      self.issue_command("set seek 0");
      deferred_login.resolve({ username: server_username });
    }
  });

  return deferred_login.promise;
};

// ### channel_list
//
// Returns a promise that will resolve with a hash of channel data in the
// format of:
//
// ```
// [{ number: channelNumber
//  , name: channelName
//  }
// , ...
// ]
//
// @return {Promise} The promise to be resolved with channel data
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

// ### games
//
// Returns a promise that will resolved with an array of data about current
// games on the server in the format:
//
// ```
// [{ number: gameNumber
//  , white: { name: userName, rating: userRating: time: timerRemaining }
//  , black: { name: userName, rating: userRating: time: timerRemaining }
//  , move: { color: colorToMove, number: moveNumber }
//  }
// , ...
// ]
// ```
//
// @return {Promise} The promise to be resolved with game data
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

// export the class
module.exports = FICSClient;
