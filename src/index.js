// # FICS
//
// A promise-based library for interacting with the Free Internet Chess Server

var net = require("net");
var stream = require("stream");
var util = require("util");

var EventEmitter = require("events").EventEmitter;

var Q = require("q");
var _ = require("underscore");

var parser = require("./parser").getMatch;

var ficsHost = "freechess.org";
var ficsPort = 5000;
var ficsPrompt = "fics%";

// ## FICSClient
//
// The main object for interacting with the FICS server. Creates a new
// connection and handles all command processing. The client is an instance
// of EventEmitter that will forward all events from the raw socket, less the
// data event. This is useful for reconnecting in the event of a socket
// timeout.
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
  this.deferredData = this.wrapSocket();
};
util.inherits(FICSClient, EventEmitter);

// ## constants
//
// Constants from the FICS server. Channels, user status codes, and user
// handle codes
FICSClient.constants = require("./constants");

// ## on
//
// An overridden on function that attaches handlers to the internal socket,
// except in the case of the data event.
//
// @public
// @return {FICSClient} Returns `this` for chaining.
FICSClient.prototype.on = function(event) {
  if (event === "data") {
    return;
  }

  this.socket.on.apply(this.socket, arguments);

  return this;
};

// ### end
//
// Clears keep alive timeout, then removes all listeners from and ends the
// connection to the FICS server.
//
// @public
FICSClient.prototype.end = function() {
  clearTimeout(this.keepAliveTimeoutId);

  this.socket.removeAllListeners().end();
};

// ### getStream
//
// A readable stream of all data from the socket connection to the FICS server.
// This should only be used for debugging and logging.
//
// @public
// @return {stream.Readable} A stream of the raw data from socket
FICSClient.prototype.getStream = function() {
  if (!this.stream) {
    this.stream = new stream.Readable().wrap(this.socket);
  }

  return this.stream;
};

// ### login
//
// Logs in a user based on the provided data. Empty data will log the user in
// as a guest.
//
// The returned promise will fail if there is a failure logging in.
//
// @public
// @param {object} userData Hash with login and password keys
// @return {Promise} promise that will resolve with the user login information
FICSClient.prototype.login = function(userData) {
  if (userData && userData.login) {
    var username = userData.login;
    var password = userData.password;
  } else {
    var username = "guest";
  }

  var match = null;
  var serverUsername;

  var self = this;
  var deferredLogin = this.lines(function(data) {
    if (parser(data, "loginPrompt")) {
      self.sendMessage(username);
    }

    if (parser(data, "passwordPrompt")) {
      self.sendMessage(password);
    }

    if (parser(data, "returnPrompt")) {
      self.sendMessage("");
    }

    if (match = parser(data, "invalidPassword")) {
      deferredLogin.reject(new Error("Invalid Password"));
    }

    if (match = parser(data, "sessionStarting")) {
      serverUsername = match[1];

      self.keepAlive();
    }

    if (parser(data, "prompt")) {
      self.issueCommand("set prompt");
      self.issueCommand("set seek 0");
      self.issueCommand("set style 12");
      deferredLogin.resolve({ username: serverUsername });
    }
  }, false);

  return deferredLogin.promise;
};

// ### chat
//
// Returns a promise that will notify with any shouts or tells that are
// received. This promise does not resolve automatically; the caller is
// expected to discard it.
//
// Notifications appear in the following format:
// ```
// { type: {string} [it|shout|tell]
// , user: {string} usernameOfSender
// , message: {string} messageBody
// , channel: {string} [channelIfTellToChannel] }
// ```
//
// @public
// @returns {Promise} Will notify as new messages are received.
FICSClient.prototype.chat = function() {
  var match = null;

  var deferredChat = Q.defer();

  this.lines(function(line) {
    if (match = parser(line, "it")) {
      deferredChat.notify({ type: "it", user: match[1], message: match[2] });
    }

    if (match = parser(line, "shout")) {
      deferredChat.notify({ type: "shout", user: match[1], message: match[2] });
    }

    if (match = parser(line, "userTell")) {
      deferredChat.notify({ type: "tell", user: match[1], message: match[2] });
    }

    if (match = parser(line, "channelTell")) {
      deferredChat.notify({ type: "tell", user: match[1]
                          , channel: match[2]
                          , message: match[3]
                          });
    }
  });

  return deferredChat.promise;
};

// ### channels
//
// Retrieve a list of channels to which the logged in user is currently
// subscribed, returned as an array of strings representing the channel numbers
//
// ```
// [ {string} channelNumber, ... ]
// ```
//
// @public
// @return {Promise} A promise to be resolved
FICSClient.prototype.channels = function() {
  var channels = [];
  var match = null;

  var deferredChannels = this.issueCommand("=channel", function(data) {
    if (match = parser(data, "channels")) {
      deferredChannels.resolve(match[0].split(/\s+/));
    }
  });

  return deferredChannels.promise;
};

// ### joinChannel
//
// Adds the channel to the user's channel list.
//
// @public
// @param {number|string} The channel to join.
// @return {Promise} A promise that will be resolved with `true` if the channel
//                   was successfully added or `false` if it was already in the
//                   user's channel list
FICSClient.prototype.joinChannel = function(channelNumber) {
  var channel = channelNumber.toString();
  var match = null;

  var deferredJoinChannel = this.issueCommand("+channel " + channel, function(data) {
    if (match = parser(data, "joinChannelSuccess", channel)) {
      deferredJoinChannel.resolve(true);
    }

    if (match = parser(data, "joinChannelFailure", channel)) {
      deferredJoinChannel.resolve(false);
    }
  });

  return deferredJoinChannel.promise;
};

// ### leaveChannel
//
// Removes the channel from the user's channel list.
//
// @public
// @param {number|string} The channel to leave.
// @return {Promise} A promise that will be resolved with `true` if the channel
//                   was successfully removed or `false` if it was not in the
//                   user's channel list
FICSClient.prototype.leaveChannel = function(channelNumber) {
  var channel = channelNumber.toString();
  var match = null;

  var deferredLeaveChannel = this.issueCommand("-channel " + channel, function(data) {
    if (match = parser(data, "leaveChannelSuccess", channel)) {
      deferredLeaveChannel.resolve(true);
    }

    if (match = parser(data, "leaveChannelFailure", channel)) {
      deferredLeaveChannel.resolve(false);
    }
  });

  return deferredLeaveChannel.promise;
};

// ### tell
//
// Broadcast a message to a user or a channel.
//
// @public
// @param {number|string} recipient The channel number or username
// @param {string} message The message to send
// @return {Promise} A promise that will be resolved with `true` if the message
//                   is successfully sent and `false` otherwise.
FICSClient.prototype.tell = function(recipient, message) {
  recipient = recipient.toString();

  var deferredTell = this.issueCommand(["tell", recipient, message].join(" "), function(data) {
    if (data.match(/^The range of channels is 0 to 255\.$/) ||
        data.match(/^Only registered users may send tells to channels other than 4, 7 and 53\.$/) ||
        data.match(new RegExp("^Only .* may send tells to channel " + recipient + "\\.$")) ||
        data.match(new RegExp("^'" + recipient + "' is not a valid handle\\.$"))) {
      deferredTell.resolve(false);
    }

    if (data.match(new RegExp("^\\(told " + recipient + "\\).*$")) ||
        data.match(new RegExp("^\\(told \\d+ players in channel " + recipient + "(?:\\s+\".*\")?\\).*$"))) {
      deferredTell.resolve(true);
    }
  });

  return deferredTell.promise;
};

// ### shout
//
// Broadcast a message globally to all users listening to shouts.
//
// @public
// @param {string} message The message to send
// @param {boolean} [it] Whether to broadcast as an `it` message, a special
//                       kind of shout. Defaults to `false`.
// @return {Promise} A promise that will be resolved with `true` if the message
//                   is successfully sent and `false` otherwise.
FICSClient.prototype.shout = function(message, it) {
  var command = it ? "it" : "shout";

  var deferredShout = this.issueCommand([command, message].join(" "), function(data) {
    if (parser(data, "unregisteredShout")) {
      deferredShout.resolve(false);
    }

    if (parser(data, "shoutSuccess")) {
      deferredShout.resolve(true);
    }
  });

  return deferredShout.promise;
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
  var deferredUsers = this.issueBlockingCommand("who", function(data) {
    _.each(data.split(/\s{2,}/), function(datum) {
      if (match = parser(datum, "handle")) {
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

    if (parser(data, "whoComplete")) {
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

  var deferredGames = this.issueBlockingCommand("games", function(data) {
    if (match = parser(data, "game")) {
      games.push({ number: match[1]
                 , white: { name: match[3], rating: match[2], time: match[6] }
                 , black: { name: match[5], rating: match[4], time: match[7] }
                 , move: { color: match[8], number: match[9] }
                 });
    }

    if (parser(data, "gamesComplete")) {
      deferredGames.resolve(games);
    }
  });

  return deferredGames.promise;
};

// ### observe
//
// Observe a game currently in progress. The promise is notified of three
// events: the initial data for the game, updates as the game progresses, and
// any messages that are sent during the game.
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
// #### game updates
// ```
// { position: {string} fenPosition
// , current: { color: {string} currentMoveColor
//            , move: {string} currentMoveNumber
//            }
// , time: { white: {string} whiteTimeInSeconds
//         , black: {string} blackTimeInSeconds
//         }
// , move: { verbose: {string} verboseLastMove
//         , algebraic: {string} algebraicLastMove
//         } }
// ```
//
// #### messages
// ```
// { user: {string} userName
// , message: {string} messageText
// , type: {string} kibitzOrWhisper }
// ```
//
// #### result
// ```
// { result: {string} gameResult }
// ```
//
// The promise will resolve after the game has been removed from the user's
// oberservation list, either by being closed or by manually `unobserve`ing it.
//
// @public
// @param {number|string} gameNumber Number of game to observe
// @return {Promise} A promise that will notify with game updates
FICSClient.prototype.observe = function(gameNumber) {
  var game = gameNumber.toString();
  var match = null;

  var deferredObservation =  this.issueCommand("observe " + game, function(data) {
    if (match = parser(data, "observationStart", game)) {
      deferredObservation.notify({ white: { name: match[1], rating: match[2] }
                                 , black: { name: match[3], rating: match[4] }
                                 , rated: match[5] === "rated"
                                 , type: match[6]
                                 , time: { initial: match[7], increment: match[8] }
                                 });
    }

    if (match = parser(data, "observationUpdate", game)) {
      deferredObservation.notify({ position: ranks2fen(match[1])
                                 , current: { color: match[2], move: match[5] }
                                 , time: { white: match[3], black: match[4] }
                                 , move: { verbose: match[6], algebraic: match[7] }
                                 });
    }

    if (match = parser(data, "observationChat", game)) {
      deferredObservation.notify({ user: match[1]
                                 , message: match[3]
                                 , type: (match[2] === "kibitzes") ? "kibitz" : "whisper"
                                 });
    }

    if (match = parser(data, "observationResult", game)) {
      deferredObservation.notify({ result: match[1] });
    }

    if (parser(data, "observationRemove", game)) {
      deferredObservation.resolve();
    }
  });

  return deferredObservation.promise;
};

// ### moves
//
// Returns a promise to be resolved with the moves for a given game. The
// structure of the moves is an array of tuple arrays, e.g.
//
// ```
// [ [{string} whiteMove, {string} blackMove]
// , ...
// , [{string} whitheMove]
// ]
// ```
//
// @public
// @param {number|string} gameNumber Number of the game
// @return {Promise} A promise that will return with the moves of the game
FICSClient.prototype.moves = function(gameNumber) {
  var game = gameNumber.toString();

  var moves = [];
  var match = null;

  var deferredMoves = this.issueCommand("moves " + game, function(data) {
    if (match = parser(data, "moves")) {
      if (match[2]) {
        moves.push([match[1], match[2]]);
      } else {
        moves.push([match[1]]);
      }
    }

    if (parser(data, "movesComplete")) {
      deferredMoves.resolve(moves);
    }
  });

  return deferredMoves.promise;
};

// ### observers
//
// Get a list of all the observers currently watching a game.
//
// @public
// @param {number|string} gameNumber Number of the game
// @return {Promise} A promise that will return with the current observers
FICSClient.prototype.observers = function(gameNumber) {
  var game = gameNumber.toString();

  var deferredObservers = this.issueCommand("allobservers " + game, function(data) {
    var match = parser(data, "observers", game);

    if (match) {
      deferredObservers.resolve(match[1].trim().split(/\s+/));
    }
  });

  return deferredObservers.promise;
};

// ### kibitz
//
// Send a message to all observers and players of a game.
//
// @public
// @param {string|number} gameNumber Number of the game
// @param {string} message The message to be broadcast
// @return {Promise} Resolved after message is sent.
FICSClient.prototype.kibitz = function(gameNumber, message) {
  var game = gameNumber.toString();

  var deferredKibitz = this.issueCommand(["xkibitz", game, message].join(" "), function(data) {
    if (parser(data, "kibitzSuccess")) {
      deferredKibitz.resolve(true);
    }
  });

  return deferredKibitz.promise;
};

// ### whisper
//
// Send a message to all observers of a game.
//
// @public
// @param {string|number} gameNumber Number of the game
// @param {string} message The message to be broadcast
// @return {Promise} Resolved after message is sent.
FICSClient.prototype.whisper = function(gameNumber, message) {
  var game = gameNumber.toString();

  var deferredWhisper = this.issueCommand(["xwhisper", game, message].join(" "), function(data) {
    if (parser(data, "whisperSuccess")) {
      deferredWhisper.resolve(true);
    }
  });

  return deferredWhisper.promise;
};

// ### unobserve
//
// Stop observing a game.
//
// @public
// @param {number|string} gameNumber Number of the game
// @return {Promise} A promise that will resolve with `true` if the game was
//                   removed from the observation list or `false` if it was not
//                   in the observation list
FICSClient.prototype.unobserve = function(gameNumber) {
  var game = gameNumber.toString();

  var deferredUnobserve = this.issueCommand("unobserve " + game, function(data) {
    if (parser(data, "observationRemove", game)) {
      deferredUnobserve.resolve(true);
    }

    if (data.match(/^You are not observing any games\.$/) || data.match(new RegExp("^You are not observing game " + game + "\\."))) {
      deferredUnobserve.resolve(false);
    }
  });

  return deferredUnobserve.promise;
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
    if (match = parser(data, "sought")) {
      games.push({ game: match[1]
                 , user: { name: match[3], rating: match[2] }
                 , time: { initial: match[4], increment: match[5] }
                 , rated: match[6] === "rated"
                 , type: match[7]
                 , range: match[8]
                 });
    }

    if (parser(data, "soughtComplete")) {
      deferredSought.resolve(games);
    };
  });

  return deferredSought.promise;
};

// ### eco
//
// Get data about the ECO for a particular game.
//
// ```
// { eco: { halfMoves: {string} halfMoveCount
//        , value: {string} code
//        }
// , nic: { halfMoves: {string} halfMoveCount
//        , value: {string} code
//        }
// , long: { halfMoves: {string} halfMoveCount
//         , value: {string} description
//         }
// }
// ```
//
// @public
// @param {number|string} gameNumber Number of the game
// @return {Promise} A promise that will resolve with the ECO data.
FICSClient.prototype.eco = function(gameNumber) {
  var game = gameNumber.toString();
  var eco = { };

  var deferredEco = this.issueBlockingCommand("eco " + game, function(data) {
    if (match = parser(data, "eco")) {
      eco[match[1].toLowerCase()] = { halfMoves: match[2], value: match[3] };

      if (match[1] === "LONG") {
        deferredEco.resolve(eco);
      }
    }
  });

  return deferredEco.promise;
};

// ### keepAlive
//
// Call the `uptime` command every 59 minutes to keep the connection to the
// server alive and prevent being kicked due to inactivity (espeically useful
// when observing games)
//
// @private
FICSClient.prototype.keepAlive = function() {
  var self = this;

  this.keepAliveTimeoutId = setTimeout(function() {
    var deferredUptime = self.issueCommand("uptime", function() {
      deferredUptime.resolve();
    });

    self.keepAlive();
  }, 59 * 60 * 1000);
};

// ### wrapSocket
//
// Creates a deffered object that processes raw data from the socket
// and notifies any promises created therefrom with each line of data.
//
// This function also handles the joining of lines into logical lines before
// notifying the promise, i.e. combining output that spans over multiple lines.
//
// @private
// @return {Deferred} A deferred object wrapping socket data output
FICSClient.prototype.wrapSocket = function() {
  var bufferedData = "";
  var deferredData = Q.defer();

  this.socket.on("data", function(data) {
    var data = data.toString();
    var lines = logicalLines((bufferedData + data).split("\n"));

    if (data[data.length - 1] !== "\n" && data.substr(-2, 2) !== ": ") {
      bufferedData = lines.pop();
    }

    _.each(lines, function(line) {
      deferredData.notify(line.trim());
    });
  });

  return deferredData;

  function logicalLines(lines) {
    return _.reduce(lines, joinContinuationLines(lines), []);
  }

  function joinContinuationLines(rawLines) {
    return function(memo, line, i) {
      if (isContinuation(line.trim())) {
        return memo;
      };

      var continueAppend = true;
      var combined = _.reduce(_.rest(rawLines, i + 1), function(memo, line) {
        var trimmedLine = line.trim();

        if (continueAppend && isContinuation(trimmedLine)) {
          memo.push(trimmedLine.substr(1).trim());
        } else {
          continueAppend = false;
        }

        return memo;
      }, [line.trim()]);

      memo.push(combined.join(" "));

      return memo;
    };
  }

  function isContinuation(line) {
    return line.substr(0, 1) === "\\";
  }
};

// ### lines
//
// Creates a new promise and then feeds each line of input to the provided
// callback. This allows a command to process the stream line-by-line until it
// determines that the promise can be discarded.
//
// @private
// @param {function} callback A callback that will be attached to the promise
// @param {boolean} [doRemovePrompt] Whether or not to remove the FICS prompt
//                                   when found at the beginning of a line
// @return {Deferred} The promise with attached callback
FICSClient.prototype.lines = function(callback, doRemovePrompt) {
  if (arguments.length === 1) {
    doRemovePrompt = true;
  }

  var deferredLines = Q.defer();
  var lineNotifier = _.compose(deferredLines.notify, removePrompt)

  deferredLines.promise.progress(callback);

  this.deferredData.promise.progress(lineNotifier);

  return deferredLines;

  function removePrompt(line) {
    if (doRemovePrompt) {
      return line.replace(new RegExp("^" + ficsPrompt + "\\s*"), "");
    } else {
      return line;
    }
  }
};

// ### issueCommand
//
// Sends a commands to the FICS server and receive output line by line. If no
// callback is provided, the command will execute and the returned promise will
// be resolved immediately.
//
// @private
// @param {string} command The text of the command
// @param {function} [callback] An optional callback function to process lines
// @return {Deferred} The deferred object to be resolved
FICSClient.prototype.issueCommand = function(command, callback) {
  var deferred = Q.defer();
  var deferredLines = this.lines(callback || function() {
    deferred.resolve();
  });

  this.sendMessage(command);

  deferred.promise.then(deferredLines.resolve, deferredLines.resolve);

  return deferred;
};

// ### issueBlockingCommand
//
// Issues a command, but enqueues it if another blocking command is already
// running, thus preventing issues with collisions in regular expressions.
// Other commands will continue to run uninterrupted.
//
// @private
// @param {string} command The text of the command
// @param {function} A callback function to process lines
// @return {Deferred} The deferred object that needs to be resolved before the
//                    next command will be run.
FICSClient.prototype.issueBlockingCommand = function(command, callback) {
  var deferred = Q.defer();

  var self = this;
  this.commandQueue.push(function() {
    var deferredCommand = self.issueCommand(command, callback);

    deferred.promise.then(function(data) {
      deferredCommand.resolve();

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
  this.socket.write(message + "\r\n", "utf8");
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
