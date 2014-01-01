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
      self.issueCommand("set style 12");
      deferredLogin.resolve({ username: serverUsername });
    }
  });

  return deferredLogin.promise;
};

// ### chat
//
// Returns a promise that will notify with any shouts or tells that are
// received. This promise does not resolve automatically; the caller is
// expected to discard it.
//
// @public
// @returns {Promise} Will notify as new messages are received.
FICSClient.prototype.chat = function() {
  var match = null;

  var deferredChat = Q.defer();

  this.lines(function(line) {
    if (match = line.match(/^--> (\S+) (.*)$/)) {
      deferredChat.notify({ type: "it", user: match[1], message: match[2] });
    }

    if (match = line.match(/^(\S+) shouts: (.*)$/)) {
      deferredChat.notify({ type: "shout", user: match[1], message: match[2] });
    }

    if (match = line.match(/^(\S+) tells you: (.*)$/)) {
      deferredChat.notify({ type: "tell", user: match[1], message: match[2] });
    }

    if (match = line.match(/^(\S+)\((\d+)\): (.*)$/)) {
      deferredChat.notify({ type: "tell", user: match[1]
                          , channel: match[2]
                          , message: match[3]
                          });
    }
  });

  return deferredChat.promise;
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

  var deferredChannels = this.issueBlockingCommand("help channel_list", function(data) {
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
    if (match = data.match(/^((\d+)(\s+)?)+$/)) {
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
    if (match = data.match(new RegExp("^\\[" + channel + "\\] added to your channel list\\.$"))) {
      deferredJoinChannel.resolve(true);
    }

    if (match = data.match(new RegExp("^\\[" + channel + "\\] is already on your channel list\\.$"))) {
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
    if (match = data.match(new RegExp("^\\[" + channel + "\\] removed from your channel list\\.$"))) {
      deferredLeaveChannel.resolve(true);
    }

    if (match = data.match(new RegExp("^\\[" + channel + "\\] is not in your channel list\\.$"))) {
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
    if (data.match(/^Only registered players can use the shout command\.$/)) {
      deferredShout.resolve(false);
    }

    if (data.match(/^\(shouted to \d+ players\)$/)) {
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

  var deferredGames = this.issueBlockingCommand("games", function(data) {
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
                                "(?:\\d+ ){5}(\\d+) (\\d+) (\\d+) ([RNBQKP]\/[a-h][1-8]-[a-h][1-8]) \\(\\d+:\\d+\\) (.+)(?:\\s+\\d+){3}$");

    if (match = data.match(gameUpdate)) {
      deferredObservation.notify({ position: ranks2fen(match[1])
                                 , current: { color: match[2], move: match[5] }
                                 , time: { white: match[3], black: match[4] }
                                 , move: { verbose: match[6], algebraic: match[7] }
                                 });
    }

    if (match = data.match(new RegExp("^(.*)\\[" + game + "\\] (kibitzes|whispers): (.*)$"))) {
      deferredObservation.notify({ user: match[1]
                                 , message: match[3]
                                 , type: (match[2] === "kibitzes") ? "kibitz" : "whisper"
                                 });
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
    if (match = data.match(/^\d+\.\s+([RNBQKPa-h1-8Ox-]+)\s+\(\d+:\d+\)(?:\s+([RNBQKPa-h1-8Ox-]+)?\s+\(\d+:\d+\))?$/)) {
      if (match[2]) {
        moves.push([match[1], match[2]]);
      } else {
        moves.push([match[1]]);
      }
    }

    if (match = data.match(/^{Still in progress} \*$/)) {
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
    var match = data.match(new RegExp("^Observing " + gameNumber + " \\[.*\\]:\\s+((.*\\s)+)\\(\\d+ users\\)$"));

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
    if (data.match(/^\(kibitzed to \d+ players?\)$/)) {
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
    if (data.match(/^\(whispered to \d+ players?\)$/)) {
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
    if (data.match(new RegExp("^Removing game " + game + " from observation list\\.$"))) {
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
    if (match = data.match(/^\s*(\d*)\s+(\d*|\+{4})\s+(\w+(?:\(C\))?)\s+(\d+)\s+(\d+) ((?:un)?rated)\s+([\w/]+)\s+(\d+-\d+)\s?\w*$/)) {
      games.push({ game: match[1]
                 , user: { name: match[3], rating: match[2] }
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

      self.sendMessage("next");
      self.awaitNext();
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
// @return {Deferred} The promise with attached callback
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

    lines = _.reduce(lines, function(memo, line, i) {
      if (line.trim().substr(0, 1) === "\\") {
        return memo;
      };

      var continueAppend = true;
      var combined = _.reduce(_.rest(lines, i + 1), function(memo, line) {
        var trimmedLine = line.trim();

        if (continueAppend && trimmedLine.substr(0, 1) === "\\") {
          memo.push(trimmedLine.substr(1).trim());
        } else {
          continueAppend = false;
        }

        return memo;
      }, [line.trim()]);

      memo.push(combined.join(" "));

      return memo;
    }, []);

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
// Sends a commands to the FICS server and receive output line by line. If no
// callback is provided, the command will execute and be considered complete
// when the next FICS input prompt appears.
//
// @private
// @param {string} command The text of the command
// @param {function} [callback] An optional callback function to process lines
// @return {Deferred} The deferred object to be resolved
FICSClient.prototype.issueCommand = function(command, callback) {
  if (arguments.length === 1) {
    callback = function(data) {
      if (data.match(/^fics%$/)) {
        deferred.resolve();
      }
    }
  }

  var deferred = Q.defer();
  var deferredLines = this.lines(callback);

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
