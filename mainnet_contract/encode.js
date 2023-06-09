const web3 = require("web3");
const hex2Arr = (hexString) => {
  if (hexString.length % 2 !== 0) {
    throw "Must have an even number of hex digits to convert to bytes";
  }
  var numBytes = hexString.length / 2;
  var byteArray = new Uint8Array(numBytes);
  for (var i = 0; i < numBytes; i++) {
    byteArray[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return byteArray;
};
const EncodedRLP =
  "+QLxoIUif7njoAt5j9bNqUKD8ZvdbdfiHhhfRvz+VLTVi942oB3MTejex116q4W1Z7bM1BrTEkUblIp0E/ChQv1A1JNHlFBY3+JO9rU3tbxHEWpF8EKNoYL6oMypF0PKeFFD7dOXAsq/lYCKJf83YAoyTnQ5FnyvcoeioPOowBP/P/YKeu07sOyNIlkUmIxIGG/gSDN4yzasyOLToDdncgbIXXv5BaLynZOAxlyNb3IxscWjbLYovFzMD+TQuQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEChBkIsQCCYwiEZGjaWbizAviwA/it46CFIn+546ALeY/WzalCg/Gb3W3X4h4YX0b8/lS01YveNgEB+Ia4QdIido1Sssoc+BbTBe4YYRC9ZcmIcJzCwHo9OUzonM8fUjaMmpuvIKUzHNL9bZlZdf0oGXKxtmdzGQ4uMWndwv8AuEHAfk36dZo61Sou4pyMszFBCR2C9QjSWUXlg3KwqtdE4W0LIi2+37HNyWphzx4TFQWYezhOIulrG5JZGlpcYNkRAICgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACIAAAAAAAAAAC4QY6SUiwJlwnBOOgqFez+qs/Vz4cyDIVH2U2DuU5IBalgXBL4/ANLDI9+k3hEkJKgHjS/PHlxoNW955yMhPF6ASMBwMCA";
const blockEncoded = "0x" + Buffer.from(EncodedRLP, "base64").toString("hex");

console.log(blockEncoded);
console.log("\n");
const hash = web3.utils
  .sha3(Buffer.from(hex2Arr(blockEncoded.slice(2))))
  .toString("hex");

console.log(hash);
