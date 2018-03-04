const CryptoJS = require("crypto-js"),
  EC = require("elliptic").ec,
  _ = require("lodash"),
  utils = require("./utils");

// Initialize ECDSA context
const ec = new EC("secp256k1");

// COINBASE constant (the reward)

const COINBASE_AMOUNT = 50;

// Where are the coins going?
class TxOut {
  // How many coins and to where
  constructor(address, amount) {
    this.address = address;
    this.amount = amount;
  }
}

// Where do the coins come from?
class TxIn {
  // txOutId (=Earlier Output)
  // txOutIndex
  // signature
}
// A transaction is made up of Transaction Input (txIns) and Transaction Outputs (txOuts)
class Transaction {
  // ID
  // txIns []
  // txOuts []
  constructor() {
    this.timestamp = Math.round(new Date().getTime() / 1000);
  }
}

// Unspent Transaction Output
class UnspentTxOut {
  constructor(txOutId, txOutIndex, address, amount) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.address = address;
    this.amount = amount;
  }
}

// Create the Transaction ID
const getTxId = tx => {
  // Add up all the content of the transactions Ins
  const txInContent = tx.txIns
    .map(txIn => txIn.txOutId + txIn.txOutIndex)
    .reduce((a, b) => a + b, "");
  // Add up all the content of the transactions Out
  const txOutContent = tx.txOuts
    .map(txOut => txOut.address + txOut.amount)
    .reduce((a, b) => a + b, "");

  // Return the hash
  return CryptoJS.SHA256(txInContent + txOutContent + tx.timestamp).toString();
};

// Sign the transaction input
const signTxIn = (tx, txInIndex, privateKey, unspentTxOuts) => {
  const txIn = tx.txIns[txInIndex];
  const dataToSign = tx.id;
  const referencedUnspentTxOut = findUnspentTxOut(
    txIn.txOutId,
    txIn.txOutIndex,
    unspentTxOuts
  );
  if (referencedUnspentTxOut === null) {
    // Before we sign anything it's cool to check if this txIn comes from an uTxOut
    return;
  }
  const referencedAddress = referencedUnspentTxOut.address;
  if (getPublicKey(privateKey) !== referencedAddress) {
    /*
        Here we are checking if somebody is trying to send coins from an address
        that does not exist.
    */
    return false;
  }
  // Sign the ID with our private key
  const key = ec.keyFromPrivate(privateKey, "hex");
  // Black magic shit
  const signature = utils.toHexString(key.sign(dataToSign).toDER());
  return signature;
};

// Find the unspent amount that we are looking for
const findUnspentTxOut = (txId, txIndex, unspentTxOuts) => {
  return unspentTxOuts.find(
    // Unspent Transaction Output
    uTxO => uTxO.txOutId === txId && uTxO.txOutIndex === txIndex
  );
};

// Create a Coinbase transaction to reward the miner
const createCoinbaseTransaction = (address, blockIndex) => {
  const tx = new Transaction();
  // Empty txIn because is coins out of nowhere
  const txIn = new TxIn();
  txIn.signature = "";
  txIn.txOutId = "";
  // We give the index of the block as the txOutIndex
  txIn.txOutIndex = blockIndex;
  // Only one txIn
  tx.txIns = [txIn];
  tx.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
  tx.id = getTxId(tx);
  tx.amount = 50;
  tx.to = address;
  tx.from = "COINBASE";
  return tx;
};

// Update the transaction outputs
const updateUnspentTxOuts = (newTxs, uTxOuts) => {
  // We need to get all the new TxOuts from a transaction
  const newUTxOuts = newTxs
    .map(tx => {
      return tx.txOuts.map(
        (txOut, index) =>
          new UnspentTxOut(tx.id, index, txOut.address, txOut.amount)
      );
    })
    .reduce((a, b) => a.concat(b), []);
  // We also need to find all the TxOuts that were used as TxIns and Empty them
  const spentTxOuts = newTxs
    .map(tx => tx.txIns)
    .reduce((a, b) => a.concat(b), [])
    .map(txIn => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

  /* 
        We need to remove all the UTxO that have been spent from our 
        UTxOuts [] and we need to add the newUTxOuts
    */
  const resultingUTxOuts = uTxOuts
    .filter(
      uTxO => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, spentTxOuts)
    )
    .concat(newUTxOuts);

  return resultingUTxOuts;
};

// Check for the validity of and address

const isAddressValid = address => {
  if (address.length !== 130) {
    // Is not as long as a public key should be
    return false;
  } else if (address.match("^[a-fA-F0-9]+$") === null) {
    // Contains other characters that are not hex
    return false;
  } else if (!address.startsWith("04")) {
    // If the address doesn't start with a 04 it means is not
    // a public key
    return false;
  } else {
    return true;
  }
};

// Validating the TxIn structure
const isTxInStructureValid = txIn => {
  if (txIn == null) {
    // Check if the TxIn is null
    return false;
  } else if (typeof txIn.signature !== "string") {
    // Check if the signature is not a string
    return false;
  } else if (typeof txIn.txOutId !== "string") {
    // Check if the txOutId is not a string
    return false;
  } else if (typeof txIn.txOutIndex !== "number") {
    // Check if the txOutIndex is not a number
    return false;
  } else {
    // If none of the above it means the structure is valid
    return true;
  }
};

const isTxOutStructureValid = txOut => {
  if (txOut == null) {
    // Check if the TxOut is null
    return false;
  } else if (typeof txOut.address !== "string") {
    // Check if the address of the txOut is not a string
    return false;
  } else if (!isAddressValid(txOut.address)) {
    // Check if the structure of the address is not valid
    return false;
  } else if (typeof txOut.amount !== "number") {
    // Check if the amount is not a number
    return false;
  } else {
    return true;
  }
};

// Just validating the Tx's structure just like we validate blocks
const isTxStructureValid = tx => {
  if (typeof tx.id !== "string") {
    // Check if the ID is not a string
    return false;
  } else if (!(tx.txIns instanceof Array)) {
    // Check if the txIns are not an array
    return false;
  } else if (
    !tx.txIns.map(isTxInStructureValid).reduce((a, b) => a && b, true)
  ) {
    /*
        This one is actually pretty cool.
        We apply the function isTxInStructureValid to all the TxIns, 
        what we are gonna get in return is an array with a bunch of trues and falses
        like [true, true, false, true] and then we reduce this array to one value by
        comparing a and b for example until we get one value. If we get even one invalid TxIn
        this will evaluate to false
      */
    return false;
  } else if (!(tx.txOuts instanceof Array)) {
    //Check if the txOuts are not an array
    return false;
  } else if (
    !tx.txOuts.map(isTxOutStructureValid).reduce((a, b) => a && b, true)
  ) {
    // We do the same as before
    return false;
  } else {
    return true;
  }
};

// We need to find the txIn and validate it
const validateTxIn = (txIn, tx, uTxOuts) => {
  // So we start by finding a uTxO that is the input of a transaction
  const wantedTxOut = uTxOuts.find(uTxO => {
    return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
  });
  if (wantedTxOut === null || wantedTxOut === undefined) {
    return false;
  } else {
    // Get the address of the foudn uTxOut
    const address = wantedTxOut.address;
    const key = ec.keyFromPublic(address, "hex");
    // With the address(public key) we can verify the signature of the txIn
    return key.verify(tx.id, txIn.signature);
  }
};

// We will need to be able to get the TxIn Amount
const getAmountInTxIn = (txIn, uTxOuts) =>
  findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, uTxOuts).amount;

const validateTx = (tx, uTxOuts) => {
  if (!isTxStructureValid(tx)) {
    return null;
  } else if (getTxId(tx) !== tx.id) {
    // We check if the tx has the same id
    // as the ID that we check by ourselves
    return false;
  }
  // We also check if the TxIns are valid
  // by appliying the function and then reducing to a true value
  const hasValidTxIns = tx.txIns
    .map(txIn => validateTxIn(txIn, tx, uTxOuts))
    .reduce((a, b) => a && b, true);

  if (!hasValidTxIns) {
    return false;
  }

  /*
     Now we need to check if the amount of coins in the TxIns are the same
     amount of coins inside of the TxOuts
    */

  // First we get the amount in the TxIns
  const amountInTxIns = tx.txIns
    .map(txIn => getAmountInTxIn(txIn, uTxOuts))
    .reduce((a, b) => a + b, 0);

  // Then we get the amount in the TxOuts
  const amountInTxOuts = tx.txOuts
    .map(txOut => txOut.amount)
    .reduce((a, b) => a + b, 0);

  // And finally we check if they have the same amount (they should)
  if (amountInTxIns !== amountInTxOuts) {
    return false;
  }

  return true;
};

/*
Validate the coinbase transaction.
This basically means validating that the transaction only has
50 coins, no TxIns.
This is where we reward miners for their hard work

*/

const validateCoinBaseTx = (tx, blockIndex) => {
  if (getTxId(tx) !== tx.id) {
    // Check if our calculation of the tx is not the same
    // as the tx's original id
    console.log(getTxId(tx));
    return false;
  } else if (tx.txIns.length !== 1) {
    // There should only be one TxIn on this Coinbase Tx
    return false;
  } else if (tx.txIns[0].txOutIndex !== blockIndex) {
    // The first TxIn of the tx should be the same as the blockIndex
    return false;
  } else if (tx.txOuts.length !== 1) {
    // Coinbase Tx has only one output, which is the miner
    return false;
  } else if (tx.txOuts[0].amount !== COINBASE_AMOUNT) {
    // A Coinbase Tx should only contain the reward
    return false;
  } else {
    return true;
  }
};

// Getting the public key from private
const getPublicKey = privateKey => {
  return ec
    .keyFromPrivate(privateKey, "hex")
    .getPublic()
    .encode("hex");
};

// Checkin if there are any duplicated
const hasDuplicates = txIns => {
  /*
    Here we intend to make groups of txIn.txOutId + txIn.txOutIndex
    (we should one find one of this)
  */
  const groups = _.countBy(txIns, txIn => txIn.txOutId + txIn.txOutIndex);
  // Then we map all the groups and we check if they have more than one
  return _(groups)
    .map(value => {
      if (value > 1) {
        // Found a duplicate
        return true;
      } else {
        return false;
      }
    })
    .includes(true);
};

/*
  Validating the Block transactions is different,
  in this case we validate the coinbase transaction separately
*/
const validateBlockTransactions = (tx, uTxOuts, blockIndex) => {
  // The first is the coinbase tx
  const coinbaseTx = tx[0];
  if (!validateCoinBaseTx(coinbaseTx, blockIndex)) {
    // Couldn't validate the coinabase tx
    return false;
  }

  // Getting all the txIns
  const txIns = _(tx)
    .map(tx => tx.txIns)
    .flatten()
    .value();

  // We need to check for duplicates of txIns since they should only be there once
  if (hasDuplicates(txIns)) {
    return false;
  }

  // We split the Transactions in two so we don't include the coinbase tx
  const nonCoinbaseTx = tx.slice(1);
  return nonCoinbaseTx
    .map(tx => validateTx(tx, uTxOuts))
    .reduce((a, b) => a && b, true);
};

// Process the transactions, this means validate them and then return the updated uTxOuts
const processTransactions = (txs, uTxOuts, blockIndex) => {
  // First we validate the structure of the Tx
  if (!validateBlockTransactions(txs, uTxOuts, blockIndex)) {
    // We also validate the block transactions
    return null;
  }
  return updateUnspentTxOuts(txs, uTxOuts);
};

module.exports = {
  TxOut,
  TxIn,
  Transaction,
  getPublicKey,
  getTxId,
  signTxIn,
  isAddressValid,
  createCoinbaseTransaction,
  processTransactions,
  validateTx
};
