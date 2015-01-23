var _ = require("underscore");

var rating = " \\((\\d+|\\+{4})\\) ";
var user = "(\\w+)";

var expressions = {
  prompt: /^fics%$/,

  loginPrompt: /^login:/,
  passwordPrompt: /^password:/,
  returnPrompt: /^Press return/,

  invalidPassword: /^\*{4} Invalid password! \*{4}$/,
  sessionStarting: /^\*{4} Starting FICS session as (.*) \*{4}$/,

  it: /^--> (\S+) (.*)$/,
  shout: /^(\S+) shouts: (.*)$/,
  userTell: /^(\S+) tells you: (.*)$/,
  channelTell: /^(\S+)\((\d+)\): (.*)$/,

  unregisteredShout: /^Only registered players can use the shout command\.$/,
  shoutSuccess: /^\(shouted to \d+ players\)$/,

  channels: /^((\d+)(\s+)?)+$/,

  joinChannelSuccess: function(channel) {
    return new RegExp("^\\[" + channel + "\\] added to your channel list\\.$");
  },

  joinChannelFailure: function(channel) {
    return new RegExp("^\\[" + channel + "\\] is already on your channel list\\.$");
  },

  leaveChannelSuccess: function(channel) {
    return new RegExp("^\\[" + channel + "\\] removed from your channel list\\.$");
  },

  leaveChannelFailure: function(channel) {
    return new RegExp("^\\[" + channel + "\\] is not in your channel list\\.$");
  },

  handle: /^(\d+|[+-]{4})([\^~:#'&. ])(\w+)((?:\([*A-Z]+\))*)$/,
  whoComplete: /^\d+ players displayed \(of \d+\)\. \(\*\) indicates system administrator\.$/,

  game: /^(\d+)\s+(\d+|(?:(?:\+|-){4}))\s+(\w+)\s+(\d+|(?:(?:\+|-){4}))\s+(\w+)\s+\[.*\]\s+((?:\d+:)?\d+:\d+)\s+-?\s*((?:\d+:)?\d+:\d+)\s+\(.*\)\s+(W|B):\s+(\d+)$/,
  gamesComplete: /^\d+ games displayed.$/,


  observationStart: function(game) {
    return new RegExp("^Game " + game + ": " + user + rating + user + rating + "((?:un)?rated) (\\w+) (\\d+) (\\d+)$");
  },

  observationUpdate: function(game) {
    return new RegExp("^<\\d+> ((?:[-pPrRnNbBqQkK]{8}\\s?){8}) (W|B) (?:-?\\d+ ){6}" + game + " \\w+ \\w+ " +
      "(?:\\d+ ){5}(-?\\d+) (-?\\d+) (\\d+) ([RNBQKP]\/[a-h][1-8]-[a-h][1-8]) \\(\\d+:\\d+\\) (.+)(?:\\s+\\d+){3}$");
  },

  observationChat: function(game) {
    return new RegExp("^(.*)\\[" + game + "\\] (kibitzes|whispers): (.*)$");
  },

  observationResult: function(game) {
    return new RegExp("^{Game " + game + " \\(\\w+ vs. \\w+\\) (?:\\w+\\s?)+} (.*)$");
  },

  observationRemove: function(game) {
    return new RegExp("^Removing game " + game + " from observation list\\.$");
  },

  moves: /^\d+\.\s+([RNBQKPa-h1-8Ox-]+)\s+\(\d+:\d+\)(?:\s+([RNBQKPa-h1-8Ox-]+)?\s+\(\d+:\d+\))?$/,
  movesComplete: /^{Still in progress} \*$/,

  observers: function(game) {
    return new RegExp("^Observing " + game + " \\[.*\\]:\\s+((.*\\s)+)\\(\\d+ users\\)$");
  },

  kibitzSuccess: /^\(kibitzed to \d+ players?\)$/,
  whisperSuccess: /^\(whispered to \d+ players?\)$/,

  sought: /^\s*(\d*)\s+(\d*|\+{4})\s+(\w+(?:\(C\))?)\s+(\d+)\s+(\d+) ((?:un)?rated)\s+([\w/]+)\s+(\d+-\d+)\s?\w*$/,
  soughtComplete: /^\d+ ads displayed\.$/,

  eco: /(ECO|NIC|LONG)\[\s*(\d+)\]: (.*)/
};

exports.getMatch = function(line, expressionKey) {
  var expression = expressions[expressionKey];

  if (_.isUndefined(expression)) {
    throw new Error("Invalid expression key: " + expressionKey);
  } else if (_.isFunction(expression)) {
    expression = expression.apply(null, _.drop(arguments, 2));
  }

  return line.match(expression);
};
