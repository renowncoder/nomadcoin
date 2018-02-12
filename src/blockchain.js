const CryptoJS = require("crypto-js");

// Block Structure

class Block {
  constructor(index, hash, previousHash, timeStamp, data) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timeStamp = timeStamp;
    this.data = data;
  }
}

// Hardcode the genesisBlock

const genesisBlock = new Block(
  0,
  "3DF6EF422472827B1E77AD3E7A194108BBB4D8B925176AFCABE7BEDA9E561071",
  null,
  new Date().getTime() / 1000,
  "Genesis block MF"
);

// Create the blockchain with the Genesis Block hardcoded into it.

let blockchain = [genesisBlock];

// Create the hash of the block

const createHash = (index, previousHash, timeStamp, data) =>
  CryptoJS.SHA256(
    index + previousHash + timeStamp + JSON.stringify(data)
  ).toString();

// Get the last block from the blockchain

const getLastBlock = () => blockchain[blockchain.length - 1];

// Create a new block

const createNewBlock = data => {
  const previousBlock = getLastBlock();
  const newBlockIndex = previousBlock.index + 1;
  const newTimeStamp = new Date().getTime() / 1000;
  const newHash = createHash(
    newBlockIndex,
    previousBlock.hash,
    newTimeStamp,
    data
  );
  const newBlock = new Block(
    newBlockIndex,
    newHash,
    previousBlock.hash,
    newTimeStamp,
    data
  );
  return newBlock;
};
