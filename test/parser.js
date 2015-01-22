var parser = require("./../src/parser").getMatch;

exports.testNegativeTimeFormatInObservationUpdates = function(test) {
  var game = "318";
  var line = "<12> -------- --p-K--- -pBp---- -P-P-rk- -------- -------- ---N---- -------- W -1 0 0 0 0 14 318 GMGiri GMDing 0 120 0 8 8 -3283 -4347 72 R/f4-f5 (2:01) Rf5 0 1 0";

  test.ok(parser(line, "observationUpdate", game));

  test.done();
};

exports.testEmptyPaddingInGameList = function(test) {
  var line = "32 2715 GMIvanchuk  2862 GMCarlsen  [ su120   0] 1:52:33 -1:41:23 (28-28) B: 18";

  test.ok(parser(line, "game"));

  test.done();
};
