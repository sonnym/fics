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

// ### end
//
// Removes all listeners from and ends the connection to the FICS server.
//
// @public
FICSClient.prototype.end = function() {
  this.socket.removeAllListeners().end();
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
    if (data.match(/^login:/)) {
      self.sendMessage(username);
    }

    if (data.match(/^password:/)) {
      self.sendMessage(password);
    }

    if (data.match(/^Press return/)) {
      self.sendMessage("");
    }

    if (match = data.match(/^\*{4} Starting FICS session as (.*) \*{4}$/)) {
      serverUsername = match[1];
    }

    if (data.match(/^fics%$/)) {
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
// [{ number: {string} channelNumber
//  , name: {string} channelName
//  }
// , ...
// ]
// ```
//
// @public
// @return {Promise} The promise to be resolved with channel data
FICSClient.prototype.channelList = function() {
  var channels = [];
  var match = null;

  this.sendMessage("help channel_list");

  var deferredChannels = this.issueCommand("help channel_list", function(data) {
    if (data.match(/^Last Modified/)) {
      deferredChannels.resolve(channels);
    }

    if (match = data.match(/^(\d+(?:,\d+)*)\s+(.*)$/)) {
      _.each(match[1].split(","), function(channelNumber) {
        channels.push({ number: channelNumber, name: match[2]});
      });
    }
  });

  return deferredChannels.promise;
};

// ### who
//
// Returns a promise that will be resolved with users in the following format.
//
// ```
// [{ name: {string} userName
//  , rating: {string} userRating
//  , status: {string} userStatus
//  , codes: {array} server
//  }
// ,...
// ]
// ```
//
// @public
// @return {Promise} To be resolved with user data.
FICSClient.prototype.who = function() {
  var users = [];

  var match = null;
  var deferredUsers = this.issueCommand("who", function(data) {
    _.each(data.split(/\s{2,}/), function(datum) {
      if (match = datum.match(/^(\d+|[+-]{4})([\^~:#'&. ])(\w+)((?:\([*A-Z]+\))*)$/)) {
        var codes = [];

        if (match[4]) {
          codes = match[4].substr(1, match[4].length - 2).split(")(");
        }

        users.push({ name: match[3]
                   , rating: match[1]
                   , status: match[2]
                   , codes: codes });
      }
    });

    if (data.match(/^\d+ players displayed \(of \d+\)\. \(\*\) indicates system administrator\.$/)) {
      deferredUsers.resolve(users);
    }
  });

  return deferredUsers.promise;
};

// ### games
//
// Returns a promise that will resolved with an array of data about current
// games on the server in the format:
//
// ```
// [{ number: {string} gameNumber
//  , white: { name: {string} userName, rating: {string} userRating: time: {string} timeRemaining }
//  , black: { name: {string} userName, rating: {string} userRating: time: {string} timeRemaining }
//  , move: { color: {string} colorToMove, number: {string} moveNumber }
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
  var games = [];
  var match = null;

  var deferredGames = this.issueCommand("games", function(data) {
    if (match = data.match(/^(\d+)\s+(\d+|\+{4})\s+(\w+)\s+(\d+|\+{4})\s+(\w+)\s+\[.*\]\s+((?:\d+:)?\d+:\d+)\s+-\s+((?:\d+:)?\d+:\d+)\s+\(.*\)\s+(W|B):\s+(\d+)$/)) {
      games.push({ number: match[1]
                 , white: { name: match[3], rating: match[2], time: match[6] }
                 , black: { name: match[5], rating: match[4], time: match[7] }
                 , move: { color: match[8], number: match[9] }
                 });
    }

    if (data.match(/^\d+ games displayed.$/)) {
      deferredGames.resolve(games);
    }
  });

  return deferredGames.promise;
};

// ### observe
//
// Observe a game currently in progress. The promise is notified of two
// events, the initial data and updates as the game progresses.
//
// #### initial data
// ```
// { white: { name: {string} userName, rating: {string} userRating }
// , black: { name: {string} userName, rating: {string} userRating }
// , rated: {boolean} isRated
// , type: {string} gameType
// , time: { initial: {string} clockInitial
//         , increment: {string} clockIncrement
//         } }
// ```
//
// #### updates
// ```
// { position: {string} fenPosition
// , color: {string} lastMoveColor
// , time: {string} lastMoveTimeRemaining }
// ```
//
// The promise will resolve with the result of the game as a string, e.g. `1-0`.
//
// @public
// @param {number|string} gameNumber Number of game to observe
// @return {Promise} A promise that will notify with game updates
FICSClient.prototype.observe = function(gameNumber) {
  var game = gameNumber.toString();

  var result = null;
  var match = null;

  var deferredObservation =  this.issueCommand("observe " + game, function(data) {
    var rating = " \\((\\d+|\\+{4})\\) ";
    var user = "(\\w+)";
    var newGame = new RegExp("^Game " + game + ": " + user + rating + user + rating + "((?:un)?rated) (\\w+) (\\d+) (\\d+)$");

    if (match = data.match(newGame)) {
      deferredObservation.notify({ white: { name: match[1], rating: match[2] }
                                 , black: { name: match[3], rating: match[4] }
                                 , rated: match[5] === "rated"
                                 , type: match[6]
                                 , time: { initial: match[7], increment: match[8] }
                                 });
    }

    var gameUpdate = new RegExp("^<\\d+> ((?:[-pPrRnNbBqQkK]{8}\\s?){8}) (W|B) (?:-?\\d+ ){6}" + game + " \\w+ \\w+ " +
                                "(?:\\d+ ){8}(?:.+) \\((\\d+:\\d+)\\)(?:.*)$");

    if (match = data.match(gameUpdate)) {
      deferredObservation.notify({ position: ranks2fen(match[1]), color: match[2], time: match[3] });
    }

    if (match = data.match(new RegExp("^{Game " + game + " \\(\\w+ vs. \\w+\\) (?:\\w+\\s?)+} (.*)$"))) {
      result = match[1];
    }

    if (data.match(new RegExp(["^Removing game", game, "from observation list\\.$"].join(' ')))) {
      deferredObservation.resolve(result);
    }
  });

  return deferredObservation.promise;
};

// ### sought
//
// Get an objecting representing all the games currently awaiting players.
//
// The games will be presented in the following format:
//
// ```
// [{ number: {string} gameNumber
//  , user: { name: {string} userName, rating: {string} userRating }
//  , time: { initial: {string} clockInitial, increment: {string} clockIncrement }
//  , rated: {boolean} isRated
//  , type: {string} gameType
//  , range: {string} allowedRatingRange
//  }
// , ...
// ]
// ```
//
// @public
// @return {Promise} A promise that will resolve with the structure of games.
FICSClient.prototype.sought = function() {
  var games = [];
  var match = null;

  var deferredSought = this.issueCommand("sought", function(data) {
    if (match = data.match(/^\s*(\d*)\s+(\d*|\+{4})\s+(\w+(?:\(C\))?)\s+(\d+)\s+(\d+) ((?:un)?rated)\s+([\w/]+)\s+(\d+-\d+)\s?\w*$/)) {
      games.push({ game: match[1]
                 , user: { name: match[2], rating: match[3] }
                 , time: { initial: match[4], increment: match[5] }
                 , rated: match[6] === "rated"
                 , type: match[7]
                 , range: match[8]
                 });
    }

    if (data.match(/^\d+ ads displayed\.$/)) {
      deferredSought.resolve(games);
    };
  });

  return deferredSought.promise;
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
    if (data.match(/^Type \[next\] to see next page\.$/)) {
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
      deferredData.notify(line.trim());
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
// @param {function} [callback] An optional callback function to process lines
// @return {Deferred} The deferred object that needs to be resolved before the
//                    next command will be run.
FICSClient.prototype.issueCommand = function(command, callback) {
  var deferred = Q.defer();

  if (arguments.length === 1) {
    callback = function(data) {
      if (data.match(/^fics%$/)) {
        deferred.resolve();
      }
    }
  }

  var self = this;
  this.commandQueue.push(function() {
    var deferredLines = self.lines(callback);

    self.sendMessage(command);

    deferred.promise.then(function() {
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

  return deferred;
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

// ### ranks2fen
//
// Takes a position string like returned by FICS and transforms it into a FEN.
//
// e.g.
// from:
//   `--Q----- -p---pkp p-----p- ----q--- P-p----- -----r-P ---R--PK --------`
// to:
//   `2Q5/1p3pkp/p5p1/4q3/P1p5/5r1P/3R2PK/8`
//
// @private
// @param {string} str A FICS position
// @return {string} A FEN string
function ranks2fen(str) {
  var ranks = str.split(/\s+/);

  return _.map(ranks, function(rank) {
    var newRank = "";

    for (var i = 0, count = 0; i < 8; i++) {
      var letter = rank[i];

      if (letter === "-") {
        count++;
        letter = (i === 7) ? count.toString() : "";

      } else if (count > 0) {
        newRank += count.toString();
        count = 0;
      }

      newRank += letter;
    }

    return newRank;
  }).join("/");
};
