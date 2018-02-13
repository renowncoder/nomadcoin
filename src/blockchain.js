const CryptoJS = require("crypto-js");

// Block Structure

class Block {
    constructor(index, hash, previousHash, timestamp, data) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
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
    const newBlock = new Block(
        newBlockIndex,
        newHash,
        previousBlock.hash,
        newtimestamp,
        data
    );
    addBlockToChain(newBlock);
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
