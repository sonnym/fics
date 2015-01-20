/**
 * A very simple example that provides a connection to the FICS server as a
 * REPL interface. This pipes stdin from the process into the socket and
 * the socket into stdout.
 */
var FicsClient = require("./../");
var socket = (new FicsClient()).socket; // accessing this private attribute is not recommended

process.stdin.pipe(socket);
socket.pipe(process.stdout);

socket.on("close", process.exit);
