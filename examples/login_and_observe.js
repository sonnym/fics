/**
 * An example of:
 *  1. logging in as a guest,
 *  2. getting a list of games,
 *  3. observing the first game
 */
var inspect = require("util").inspect;

var FicsClient = require("./../");
var client = new FicsClient();

client.login().then(function(userData) {
  console.log("Successfully logged in as: " + userData.username);

  var games = client.games().then(function(games) {
    console.log("\nNumber of games current in progress: " + games.length);

    var gameNumber = games[0].number;

    console.log("\nBeginning to observe game: " + gameNumber);

    client.observe(gameNumber)
      .progress(function(gameData) {
        console.log("\nGame update: " + inspect(gameData));
      })
      .then(function(gameResult) {
        console.log("\nGame result: " + inspect(gameResult));
      });
  });
});

process.on("signal", function() {
  client.end();
});
