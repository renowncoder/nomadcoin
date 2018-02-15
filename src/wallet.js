const EC = require("elliptic").ec,
  fs = require("fs"),
  _ = require("lodash");

const ec = new EC("secp256k1");
const privateKeyLocation = "./privateKey";

// Generate a private key
const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

// Get the private key from the file
const getPrivateFromWallet = () => {
  const buffer = fs.readFileSync(privateKeyLocation, "utf-8");
  return buffer.toString();
};

// Get the public key from the private key (wallet)
const getPublicFromWallet = () => {
  const privateKey = getPrivateFromWallet();
  const key = ec.keyFromPrivate(privateKey, "hex");
  return key.getPublic().encode("hex");
};

/*
    Getting the balance of a wallet is pretty simple,
    all we have to do is to get all the uTxOuts that math
    the public key (address) and add them up with the power of
    lodash
*/
const getBalance = (address, uTxOuts) => {
  return _(uTxOuts)
    .filter(uTxO => uTxO.address === address)
    .map(uTxO => uTxO.amount)
    .sum();
};

// Initialize the wallet (aka create a private key)
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
