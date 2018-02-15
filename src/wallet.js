const EC = require("elliptic").ec,
  fs = require("fs");

const ec = new EC("secp256k1");
const privateKeyLocation = "./privateKey";

// Generate a private key
const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

const initWallet = () => {
  // Check if there is already a private Key
  if (fs.existsSync(privateKeyLocation)) {
    return;
  }
  // If not then we create a new key
  const newPrivateKey = generatePrivateKey();
  // And save it into a file
  fs.writeFileSync(privateKeyLocation, newPrivateKey);
};

initWallet();
