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
