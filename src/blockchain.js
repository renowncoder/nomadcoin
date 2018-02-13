const CryptoJS = require("crypto-js");
const hexToBinary = require("hex-to-binary");
// Block Structure

class Block {
    constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

// Hardcode the genesisBlock

const genesisBlock = new Block(
    0,
    "3DF6EF422472827B1E77AD3E7A194108BBB4D8B925176AFCABE7BEDA9E561071",
    null,
    1518512316,
    "Genesis block MF",
    0,
    0
);

// Create the blockchain with the Genesis Block hardcoded into it.

let blockchain = [genesisBlock];

// Find a block
const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    // eslint-disable-next-line
  console.log("difficulty is ", difficulty);
    while (true) {
    // We create a hash with the contents of our candidate block
        const hash = createHash(
            index,
            previousHash,
            timestamp,
            data,
            difficulty,
            nonce
        );
        // If the hash binary has the desired zeros then we will create the block
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(
                index,
                hash,
                previousHash,
                timestamp,
                data,
                difficulty,
                nonce
            );
        }
        // If it doesn't we will just increase the nonce
        nonce++;
    }
};

// Check if the hash matches the dificulty

const hashMatchesDifficulty = (hash, difficulty) => {
    // First we need to convert the hex hash into binary
    const hashInBinary = hexToBinary(hash);
    // Second we will get the difficulty of the block in zeros
    const requiredZeros = "0".repeat(difficulty);
    // Check if the hash in binary starts with that amount of zeros
    console.log("Trying hash: ", hashInBinary, " with: ", requiredZeros);
    return hashInBinary.startsWith(requiredZeros);
};

// Create the hash of the block

const createHash = (index, previousHash, timestamp, data) =>
    CryptoJS.SHA256(
        index + previousHash + timestamp + JSON.stringify(data)
    ).toString();

// Get the last block from the blockchain
const getNewestBlock = () => blockchain[blockchain.length - 1];

// Get blockchain
const getBlockchain = () => blockchain;

// Create a new block

const createNewBlock = data => {
    const previousBlock = getNewestBlock();
    const newBlockIndex = previousBlock.index + 1;
    const newtimestamp = new Date().getTime() / 1000;
    const newHash = createHash(
        newBlockIndex,
        previousBlock.hash,
        newtimestamp,
        data
    );
    const newBlock = findBlock(
        newBlockIndex,
        previousBlock.hash,
        newtimestamp,
        data,
        5
    );
    addBlockToChain(newBlock);
    // We do this to avoid circular requirements
    require("./p2p").broadcastNewBlock();
    return newBlock;
};

// Get any block's hash
const getBlockHash = block =>
    createHash(block.index, block.previousHash, block.timestamp, block.data);

// Check if the structure of the Block and it's types are what they should be
const isBlockStructureValid = block => {
    return (
        typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "string"
    );
};

// Valiate new blocks
const isBlockValid = (newBlock, oldBlock) => {
    // Check if the structure of the new block is correct
    if (!isBlockStructureValid(newBlock)) {
        return false;
    }
    // Check if the index of the new block is greater than the old block's index
    if (oldBlock.index + 1 !== newBlock.index) {
        return false;
    // Check if the new block's previous hash is the same as the old block's hash
    } else if (oldBlock.hash !== newBlock.previousHash) {
        return false;
    // Check if the new block's hash is the same as the hash taht we calculate
    } else if (getBlockHash(newBlock) !== newBlock.hash) {
        return false;
    }
    return true;
};

// Check if the chain is valid
const isChainValid = foreignChain => {
    const isGenesisValid = block => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    // Check if the genesis block is the same in our chain and theirs
    if (!isGenesisValid(foreignChain[0])) {
        return false;
    }
    // Validate each block from the other blockchain
    for (let i = 1; i < foreignChain.length; i++) {
        if (!isBlockValid(foreignChain[i], foreignChain[i - 1])) {
            return false;
        }
    }
    return true;
};

// Replace Chain
const replaceChain = newChain => {
    if (isChainValid(newChain) && newChain.length > getBlockchain().length) {
        blockchain = newChain;
        return true;
    }
    return false;
};

// Add block to chain
const addBlockToChain = newBlock => {
    if (isBlockValid(newBlock, getNewestBlock())) {
        blockchain.push(newBlock);
        return true;
    } else {
        return false;
    }
};

module.exports = {
    getBlockchain,
    createNewBlock,
    getNewestBlock,
    isBlockStructureValid,
    addBlockToChain,
    replaceChain
};
