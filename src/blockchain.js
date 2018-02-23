const CryptoJS = require("crypto-js"),
  _ = require("lodash"),
  Transactions = require("./transactions"),
  MemPool = require("./mempool"),
  Wallet = require("./wallet"),
  hexToBinary = require("hex-to-binary");

const {
  isAddressValid,
  createCoinbaseTransaction,
  processTransactions
} = Transactions;
const {
  getPublicFromWallet,
  createTransaction,
  getPrivateFromWallet,
  getBalance,
  findUTxOuts
} = Wallet;

const { addToMemPool, getMemPool, updateMemPool } = MemPool;

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
    this.amount = _(data)
      .map(tx => tx.amount)
      .reduce((a, b) => a + b);
  }
}

// Genesis Tx
const genesisTx = {
  txIns: [{ signature: "", txOutId: "", txOutIndex: 0 }],
  txOuts: [
    {
      address:
        "04aaeab6dcf3d725db209d58eb7d25f94579dcc55d9773f457cc77517edec0a3ec2fe10ca03e9981c7f628c6118ab2b3c4a69f87038c8ffeb18708169ecaaeec9d",
      amount: 50
    }
  ],
  amount: 50,
  timestamp: 1518512316,
  to:
    "04aaeab6dcf3d725db209d58eb7d25f94579dcc55d9773f457cc77517edec0a3ec2fe10ca03e9981c7f628c6118ab2b3c4a69f87038c8ffeb18708169ecaaeec9d",
  from: "COINBASE",
  id: "468774e6e93580a79d0dd8eb3c790734a749a9dda22e31a27aef44311e9a1145"
};

// Hardcode the genesisBlock

const genesisBlock = new Block(
  0,
  "3DF6EF422472827B1E77AD3E7A194108BBB4D8B925176AFCABE7BEDA9E561071",
  "",
  1518512316,
  [genesisTx],
  0,
  0
);

// Create the blockchain with the Genesis Block hardcoded into it.

let blockchain = [genesisBlock];

// Put the uTxOuts on a list
let uTxOutsList = processTransactions(blockchain[0].data, [], 0);

// Function to replace the uTxOutsList
const updateUTxOutsList = newUTxOuts => {
  uTxOutsList = newUTxOuts;
};

// Find a block
const findBlock = (index, previousHash, timestamp, data, difficulty) => {
  let nonce = 0;
  // eslint-disable-next-line
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
  const requiredZeros = "0".repeat(difficulty || 0);
  // Check if the hash in binary starts with that amount of zeros
  return hashInBinary.startsWith(requiredZeros);
};

// Create the hash of the block

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
  ).toString();

// Get the last block from the blockchain
const getNewestBlock = () => blockchain[blockchain.length - 1];

// Get blockchain
const getBlockchain = () => blockchain;

// Difficulty constants

const BLOCK_GENERATION_INTERVAL = 10;

const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;

// Here we get the difficulty of our PoW
const getDifficulty = blockchain => {
  // Get the last block of our chain
  const newestBlock = blockchain[blockchain.length - 1];
  // We use reminder (%) to check if it's divisible by 10 this means is a 10th block
  if (
    newestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
    newestBlock.index !== 0
  ) {
    // We will adjust the difficulty
    return calculateNewDifficulty(newestBlock, blockchain);
  } else {
    // Return the same difficulty
    return newestBlock.difficulty;
  }
};

// Adjust the difficulty
const calculateNewDifficulty = (newestBlock, blockchain) => {
  // Get the last calculated block
  const lastCalculated =
    blockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  // Get the time that we expected a block to be mined in
  const timeExpected =
    BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  // Calculate the time taken based on timestamps
  const timeTaken = newestBlock.timestamp - lastCalculated.timestamp;
  if (timeTaken < timeExpected / 2) {
    // If the time taken to mine the block is less than the time expected by two(100/2=50) increase the difficutly
    return lastCalculated.difficulty + 1;
  } else if (timeTaken > timeExpected * 2 && lastCalculated.difficulty !== 0) {
    // If the time taken is more than the time expected times two (100*2=200) decrease the difficulty
    return lastCalculated.difficulty - 1;
  } else {
    // If the time taken is more than 50 and less than 200 then stay the same
    return lastCalculated.difficulty;
  }
};

// Timestamp

const getTimeStamp = () => Math.round(new Date().getTime() / 1000);

// Create a new block with a transaction on it
const createNewBlockWithTx = (receiverAddress, amount) => {
  if (!isAddressValid(receiverAddress)) {
    // Checking if the intended address is invalid and we throw an error
    // so we can catch it on the server
    throw Error("Address is invalid");
  } else if (typeof amount !== "number") {
    // Checking if the amount is not a number and here we also throw an error
    throw Error("Amount is invalid");
  }
  // We need to create a new coinbase transaction for the miner (right now it's also the sender)
  const coinbaseTx = createCoinbaseTransaction(
    getPublicFromWallet(),
    getNewestBlock().index + 1
  );
  // Now we actually create the transaction to the sender
  const tx = createTransaction(
    receiverAddress,
    amount,
    getPrivateFromWallet(),
    uTxOutsList,
    getMemPool()
  );
  const blockData = [coinbaseTx, tx];
  return createNewRawBlock(blockData);
};

// Create a new raw block.

const createNewRawBlock = data => {
  const previousBlock = getNewestBlock();
  const newBlockIndex = previousBlock.index + 1;
  const newtimestamp = getTimeStamp();
  const difficulty = getDifficulty(getBlockchain());
  const newBlock = findBlock(
    newBlockIndex,
    previousBlock.hash,
    newtimestamp,
    data,
    difficulty
  );
  if (addBlockToChain(newBlock)) {
    // We do this to avoid circular requirements

    require("./p2p").broadcastNewBlock();
    return newBlock;
  } else {
    return null;
  }
};

/*
  Create a new block, which means, reward the miner
*/
const createNewBlock = () => {
  // We create the coinbase transaction
  const coinbaseTx = createCoinbaseTransaction(
    getPublicFromWallet(),
    getNewestBlock().index + 1
  );
  // Include it on the block data
  const blockData = [coinbaseTx].concat(getMemPool());
  return createNewRawBlock(blockData);
};

// Get any block's hash
const getBlockHash = block =>
  createHash(
    block.index,
    block.previousHash,
    block.timestamp,
    block.data,
    block.difficulty,
    block.nonce
  );

// Check if the structure of the Block and it's types are what they should be
const isBlockStructureValid = block => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
  );
};

const isTimestampValid = (newBlock, oldBlock) => {
  return (
    oldBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < getTimeStamp()
  );
};

// Valiate new blocks
const isBlockValid = (newBlock, oldBlock) => {
  // Check if the structure of the new block is correct

  if (!isBlockStructureValid(newBlock)) {
    return false;
  } else if (oldBlock.index + 1 !== newBlock.index) {
    // Check if the index of the new block is greater than the old block's index
    return false;
    // Check if the new block's previous hash is the same as the old block's hash
  } else if (oldBlock.hash !== newBlock.previousHash) {
    return false;
    // Check if the new block's hash is the same as the hash taht we calculate
  } else if (getBlockHash(newBlock) !== newBlock.hash) {
    return false;
    // Check if the timestamp is valid
  } else if (!isTimestampValid(newBlock, oldBlock)) {
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
    return null;
  }
  // Here we loop and validate each block + its tx's
  let foreignUTxOuts = [];
  for (let i = 0; i < foreignChain.length; i++) {
    const currentBlock = foreignChain[i];
    if (i !== 0 && !isBlockValid(currentBlock, foreignChain[i - 1])) {
      return null;
    }
    /*
      When we validate a chain we also have to
      validate all the uTxOuts
    */
    foreignUTxOuts = processTransactions(
      currentBlock.data,
      foreignUTxOuts,
      currentBlock.index
    );
    if (foreignUTxOuts === null) {
      return null;
    }
  }
  return foreignUTxOuts;
};

// Calculate the difficulty of the chain by summing all the difficulties

const sumDifficulty = someBlockchain => {
  return someBlockchain
    .map(block => block.difficulty)
    .map(difficulty => Math.pow(2, difficulty))
    .reduce((a, b) => a + b);
};

// Replace Chain
const replaceChain = newChain => {
  /*
    To replace a chain, the new chain must be:
      1) Valid
      2) Be more 'difficult' than our current blockchain
      3) Have valid uTxOuts

  */
  const foreignUTxOuts = isChainValid(newChain);
  const validChain = foreignUTxOuts !== null;
  if (validChain && sumDifficulty(newChain) > sumDifficulty(getBlockchain())) {
    blockchain = newChain;
    updateUTxOutsList(foreignUTxOuts);
    updateMemPool(getUTxOutsList());
    require("./p2p").broadcastNewBlock();
    return true;
  }
  return false;
};

// Add block to chain
const addBlockToChain = newBlock => {
  if (isBlockValid(newBlock, getNewestBlock())) {
    // Validate the Txs and update the uTxOutsList
    const processedTxs = processTransactions(
      newBlock.data,
      uTxOutsList,
      newBlock.index
    );
    if (processedTxs === null) {
      // If the Txs have not been validated

      return false;
    } else {
      // Add the block to the chain and update the uTxOutsList
      blockchain.push(newBlock);
      updateUTxOutsList(processedTxs);
      updateMemPool(uTxOutsList);
      return true;
    }
  } else {
    return false;
  }
};

// Get the account balance
const getAccountBalance = () => {
  return getBalance(getPublicFromWallet(), uTxOutsList);
};

// Deep Clone the uTxOutsList
const getUTxOutsList = () => _.cloneDeep(uTxOutsList);

// Send Transaction (that means just adding it to the memPool)
const sendTransaction = (address, amount) => {
  const tx = createTransaction(
    address,
    amount,
    getPrivateFromWallet(),
    getUTxOutsList(),
    getMemPool()
  );
  addToMemPool(tx, getUTxOutsList());
  require("./p2p").broadcastMempool();
  return tx;
};

// Getting myUTxOuts
const myUTxOuts = () => findUTxOuts(getPublicFromWallet(), getUTxOutsList());

// Handle a Tx when it's received from another peer
const handleIncomingTx = tx => {
  addToMemPool(tx, getUTxOutsList());
};

module.exports = {
  getBlockchain,
  createNewBlock,
  getNewestBlock,
  isBlockStructureValid,
  addBlockToChain,
  replaceChain,
  createNewBlockWithTx,
  getAccountBalance,
  sendTransaction,
  getUTxOutsList,
  myUTxOuts,
  handleIncomingTx
};
