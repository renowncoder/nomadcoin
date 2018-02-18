const _ = require("lodash"),
  Transactions = require("./transactions");

const { validateTx } = Transactions;

// Here we are gonna save all the unconfirmed Tx's
let memPool = [];

// Get all the txIns inside of the mempool
const getTxInsOnPool = txPool => {
  return _(txPool)
    .map(tx => tx.txIns)
    .flatten()
    .value();
};

/*
    We have to check if the Transaction is valid to be added to our mempool
    this means that we have to know if the new Tx 
*/
const isTxValidForPool = (tx, txPool) => {
  // First we get all the TxIns from the txPool
  const txPoolIns = getTxInsOnPool(txPool);

  // Here we check if a TxIn is already inside of our memPool
  const isTxAlreadyInPool = (txIns, txIn) => {
    return _.find(txIns, txPoolIn => {
      return (
        txIn.txOutIndex === txPoolIn.txOutIndex &&
        txIn.txOutId === txPoolIn.txOutId
      );
    });
  };

  /*
    Then we check if any of the txIns is already inside
    of our mempool. If we find it then we won't add this Tx
  */
  for (const txIn of tx.txIns) {
    if (isTxAlreadyInPool(txPoolIns, txIn)) {
      return false;
    }
  }
  return true;
};

const addToMemPool = (tx, uTxOuts) => {
  // Before we add the Tx to the mempool we need to validate it
  if (!validateTx(tx, uTxOuts)) {
    throw Error("This Tx is invalid, it won't be added");
  } else if (!isTxValidForPool(tx, memPool)) {
    throw Error("This Tx is invalid, it won't be added");
  }
  memPool.push(tx);
};

module.exports = {
  addToMemPool
};
