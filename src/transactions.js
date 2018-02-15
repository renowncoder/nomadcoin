const CryptoJS = require("crypto-js"),
  EC = require("elliptic").ec,
  utils = require("./utils");

// Initialize ECDSA context
const ec = new EC("secp256k1");

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

// Put UTxOuts on a list
const UTxOuts = [];

// Create the Transaction ID
const getTransactionId = transaction => {
  // Add up all the content of the transactions Ins
  const txInContent = transaction.txIns
    .map(txIn => txIn.txOutId + txIn.txOutIndex)
    .reduce((a, b) => a + b, "");
  // Add up all the content of the transactions Out
  const txOutContent = transaction.txOuts
    .map(txOut => txOut.address + txOut.amount)
    .reduce((a, b) => a + b, "");

  // Return the hash
  return CryptoJS.SHA256(txInContent + txOutContent).toString();
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
    return;
  }
  // Sign the ID with our private key
  const key = ec.keyFromPrivate(privateKey, "hex");
  // Black magic shit
  const signature = utils.toHexString(key.sign(dataToSign).toEDR());
  return signature;
};

// Find the unspent amount that we are looking for
const findUnspentTxOut = (txId, txIndex, unspentTxOuts) => {
  return unspentTxOuts.find(
    // Unspent Transaction Output
    uTxO => uTxO.txOutId === txId && uTxO.txOutIndex === txIndex
  );
};

// Update the transaction outputs
const updateUnspentTxOuts = (newTxs, uTxOuts) => {
  // We need to get all the new TxOuts from a transaction
  const newUTxOuts = newTxs
    .map(tx => {
      tx.txOuts.map(
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
    .contact(newUTxOuts);

  return resultingUTxOuts;
};

// Check for the validity of and address

const isAddressValid = address => {
  if (address.length !== 300) {
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

// We need to find the txIn and falidate it
const validateTxIn = (txIn, tx, uTxOuts) => {
  // So we start by finding a uTxO that is the input of a transaction
  const wantedTxOut = uTxOuts.find(uTxO => uTxO.txOutId === txIn.txOutId);
  if (wantedTxOut === null) {
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
  if (getTransactionId(tx) !== tx.id) {
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
