const _ = require("lodash"),
  Transactions = require("./transactions");

const { validateTx } = Transactions;

// Here we are gonna save all the unconfirmed Tx's
let memPool = [];
// Getter function
const getMemPool = () => {
  return _.cloneDeep(memPool);
};

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

// Here we validate the Tx that is going to be included in our memPool
const addToMemPool = (tx, uTxOuts) => {
  // Before we add the Tx to the mempool we need to validate it
  if (!validateTx(tx, uTxOuts)) {
    throw Error("This Tx is invalid, it won't be added");
  } else if (!isTxValidForPool(tx, memPool)) {
    throw Error("This Tx is invalid for the pool, it won't be added");
  }
  memPool.push(tx);
};

// Is a TxIn inside of the uTxOuts?
const hasTxIn = (txIn, uTxOuts) => {
  const foundTxIn = uTxOuts.find(uTxO => {
    return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
  });
  return foundTxIn !== undefined;
};

/*
We also need to update our mempool, this will be needed when a Tx
is included inside of a block so now it's confirmed therefore not anymore
mineable.
We will also would like to invalidate other Tx, maybe because their TxOut referenced
inside of the TxIn is already spent on a Tx that was already validated.
*/
const updateMemPool = uTxOuts => {
  // We are gonna keep a list of the invalid Txs that we find
  const invalidTxs = [];
  for (const tx of memPool) {
    for (const txIn of tx.txIns) {
      if (!hasTxIn(txIn, uTxOuts)) {
        invalidTxs.push(tx);
        break;
      }
    }
  }
  /*
    If the length of the invalidTxs list is more than 0
    we need to remove the invalid Tx's from the pool
  */
  if (invalidTxs.length > 0) {
    memPool = _.without(memPool, ...invalidTxs);
  }
};

module.exports = {
  addToMemPool,
  getMemPool,
  updateMemPool
};
