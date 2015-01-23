process.on("uncaughtException", function(err) {
  console.log("\nEXCEPTION:");
  console.log(err);
  console.log(err.stack);
});

exports.coreFunctionality = require("./lib/core_functionality");
exports.login = require("./lib/login");
exports.talking = require("./lib/talking");
exports.channels = require("./lib/channels");
exports.observation = require("./lib/observation");
exports.playing = require("./lib/playing");
exports.users = require("./lib/users");
