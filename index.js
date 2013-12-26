// # FICS
//
// A promise-based library for interacting with the Free Internet Chess Server

var net = require("net");

var Q = require("q");
var _ = require("underscore");

var ficsHost = "freechess.org";
var ficsPort = 5000;

// ## FICSClient
//
// The main object for interacting with the FICS server. Creates a new
// connection and handles all command processing.
//
// ```
// var FICSClient = require("fics");
// var fics = new FICSClient();
// ```
//
// @constructor
var FICSClient = function() {
  this.socket = net.connect({ port: ficsPort, host: ficsHost });
  this.commandQueue = [];

  this.awaitNext();
};

// ### getSocket
//
// Provides access to the raw data received from the FICS server, but is not to
// be written to
//
// @public
// @return {EventEmitter} The socket itself
FICSClient.prototype.getSocket = function() {
  return this.socket;
};

// ### login
//
// logs in a user based on the provided data
//
// @public
// @param {object} userData Hash with login and password keys
// @return {Promise} promise that will resolve with the user login information
FICSClient.prototype.login = function(userData) {
  if (userData.login) {
    var username = userData.login;
    var password = userData.password;
  } else {
    var username = "guest";
  }

  var match = null;
  var serverUsername;

  var self = this;
  var deferredLogin = this.lines(function(data) {
    if (data.match(/login:/)) {
      self.sendMessage(username);
    }

    if (data.match(/password:/)) {
      self.sendMessage(password);
    }

    if (data.match(/Press return/)) {
      self.sendMessage("");
    }

    if (match = data.match(/\*{4} Starting FICS session as (.*) \*{4}/)) {
      serverUsername = match[1];
    }

    if (data.match(/fics%/)) {
      self.issueCommand("set seek 0");
      deferredLogin.resolve({ username: serverUsername });
    }
  });

  return deferredLogin.promise;
};

// ### channelList
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
// ```
//
// @public
// @return {Promise} The promise to be resolved with channel data
FICSClient.prototype.channelList = function() {
  var deferredChannels = Q.defer();

  var channels = [];
  var match = null;
  var stopMatching = false;

  this.sendMessage("help channel_list");

  this.issueCommand("help channel_list", deferredChannels.promise, function(data) {
    if (data.match(/Last Modified/)) {
      deferredChannels.resolve(channels);
    }

    if (data.match(/SPECIAL NOTE/)) {
      stopMatching = true;
    }

    if (match = data.match(/\d+(?:,\d+)*\s.*/g)) {
      if (stopMatching) {
        return;
      }

      var channelData = match[0].split(/\s+/);
      var channelNumbers = channelData.shift().split(",");

      _.each(channelNumbers, function(channelNumber) {
        channels.push({ number: channelNumber, name: channelData.join(" ") });
      });
    }
  });

  return deferredChannels.promise;
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
// Currently does not capture games being examined and, e.g. lectures by
// LectureBot, so the length of the list is shorter than the length returned
// by the server.
//
// @public
// @return {Promise} The promise to be resolved with game data
FICSClient.prototype.games = function() {
  var deferredGames = Q.defer();

  var games = [];
  var match = null;

  this.issueCommand("games", deferredGames.promise, function(data) {
    if (match = data.match(/(\d+)\s+(\d+|\+{4})\s+(\w+)\s+(\d+|\+{4})\s+(\w+)\s+\[.*\]\s+((?:\d+:)?\d+:\d+)\s+-\s+((?:\d+:)?\d+:\d+)\s+\(.*\)\s+(W|B):\s+(\d+)/)) {
      games.push({ number: match[1]
                 , white: { name: match[3], rating: match[2], time: match[6] }
                 , black: { name: match[5], rating: match[4], time: match[7] }
                 , move: { color: match[8], number: match[9] }
                 });
    }

    if (data.match(/\d+ games displayed./)) {
      deferredGames.resolve(games);
    }
  });

  return deferredGames.promise;
};

// ### awaitNext
//
// Creates a promise that monitors the text stream for next page prompts, sends
// a next command, then starts the process all over again before discarding
// the promise
//
// @private
FICSClient.prototype.awaitNext = function() {
  var self = this;

  var pagingPromise = this.lines(function(data) {
    if (data.match(/Type \[next\] to see next page\./)) {
      pagingPromise.resolve();

      self.awaitNext();
      self.sendMessage("next");
    }
  });
};

// ### lines
//
// Creates a new promise and then feeds each line of input to the provided
// callback. This allows a command to process the stream line-by-line until it
// determines that the promise can be discarded.
//
// @private
// @param {function} callback A callback that will be attached to the promise
// @return {Promise} The promise with attached callback
FICSClient.prototype.lines = function(callback) {
  var self = this;

  var deferredData = Q.defer();
  var bufferedData = "";

  this.socket.on("data", lineFn);

  deferredData.promise.then(removeFn, removeFn, callback);

  return deferredData;

  function lineFn(data) {
    var data = data.toString();
    var lines = (bufferedData + data).split("\n");

    if (data[data.length - 1] !== "\n" && data.substr(-2, 2) !== ": ") {
      bufferedData = lines.pop();
    }

    _.each(lines, function(line) {
      deferredData.notify(line);
    });
  }

  function removeFn() {
    self.socket.removeListener("data", lineFn);
  }
};

// ### issueCommand
//
// Sends a commands to the FICS server. Internally manaages a queue of commands
// that run synchronously to prevent interference with each other, then
// automatically calls the next command if any are remaining.
//
// @private
// @param {string} command The text of the command
// @param {Promise} [promise] An optional promise that will be resolved when
//                            the command is complete
// @param {function} [callback] An optional callback function to process lines
FICSClient.prototype.issueCommand = function(command, promise, callback) {
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
  this.commandQueue.push(function() {
    var deferredLines = self.lines(callback);

    self.sendMessage(command);

    promise.then(function() {
      deferredLines.resolve();

      self.commandQueue.shift();

      if (self.commandQueue.length > 0) {
        self.commandQueue[0]();
      }
    });
  });

  if (this.commandQueue.length === 1) {
    this.commandQueue[0]();
  }
};

// ### sendMessage
//
// sends a message with the approriate encoding and termination character
//
// @private
// @param {string} message a Message to send to the FICS server
FICSClient.prototype.sendMessage = function(message) {
  this.socket.write(message + "\n", "utf8");
};

// export the class
module.exports = FICSClient;
