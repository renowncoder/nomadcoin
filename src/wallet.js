const EC = require("elliptic").ec,
  fs = require("fs"),
  _ = require("lodash"),
  Transactions = require("./transactions");

const ec = new EC("secp256k1");
const privateKeyLocation = "./privateKey";

const {
  TxOut,
  getPublicKey,
  TxIn,
  Transaction,
  getTxId,
  signTxIn
} = Transactions;

// Generate a private key
const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

// Get the private key from the file
const getPrivateFromWallet = () => {
  const buffer = fs.readFileSync(privateKeyLocation, "utf8");
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
    all we have to do is to get all the uTxOuts that match
    the public key (address) and add them up with the power of
    lodash
*/
const getBalance = (address, uTxOuts) => {
  return _(findUTxOuts(address, uTxOuts))
    .filter(uTxO => {
      return uTxO.address === address;
    })
    .map(uTxO => uTxO.amount)
    .sum();
};

// Get uTxOuts by address
const findUTxOuts = (address, uTxOuts) =>
  _.filter(uTxOuts, uTxOut => uTxOut.address === address);

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

/*
    When we want to send a transaction we first have to
    check if the user has money and how much money is going to be left over
    so we can give it back to the user
*/
const findAmountOnTxOuts = (amountNeeded, myUTxOuts) => {
  let currentAmount = 0;
  const includedUTxOuts = [];
  for (const myUTxOut of myUTxOuts) {
    includedUTxOuts.push(myUTxOut);
    currentAmount = currentAmount + myUTxOut.amount;
    if (currentAmount >= amountNeeded) {
      const leftOverAmount = currentAmount - amountNeeded;
      return { includedUTxOuts, leftOverAmount };
    }
  }
  throw Error("Not enough founds");
};

/*
    We need to create two TxOuts per transaction, one for the user who is receiving the coins
    and one for the user that sent the coins but didn't spend them all, this means that we are
    just giving him the coins back
*/
const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
  // First we create the TxOut for the receiver address
  const receiverTxOut = new TxOut(receiverAddress, amount);
  // If there are no leftover coins we just return an array with only one TxOut
  if (leftOverAmount === 0) {
    return [receiverTxOut];
  } else {
    // If there are enough coins we just create a second (returning) TxOut
    const leftOverTxOut = new TxOut(myAddress, leftOverAmount);
    return [receiverTxOut, leftOverTxOut];
  }
};

// Functiont to filter the txOuts from the mempool
const filterTxOutsfromMemPool = (uTxOuts, memPool) => {
  // First we get all the txIns from the memPool
  const txIns = _(memPool)
    .map(tx => tx.txIns)
    .flatten()
    .value();
  // Then we get an array ready to add the txIns that we are gonna remove
  const removables = [];
  for (const uTxOut of uTxOuts) {
    const txIn = _.find(txIns, aTxIn => {
      return (
        aTxIn.txOutIndex === uTxOut.txOutIndex &&
        aTxIn.txOutId === uTxOut.txOutId
      );
    });
    if (txIn !== undefined) {
      removables.push(uTxOut);
    }
  }
  return _.without(uTxOuts, ...removables);
};

// At last, we create a transaction.
const createTransaction = (
  receiverAddress,
  amount,
  privateKey,
  uTxOuts,
  memPool
) => {
  // First we get the public key from the private (address)
  const myAddress = getPublicKey(privateKey);
  // Then we get all of our UTxOuts
  const myUTxOuts = uTxOuts.filter(uTxO => uTxO.address === myAddress);
  /*
    I need to check if my uTxOuts are not inside of the mempool
    as a TxIn because I'm about to count them
  */
  const filteredUTxOuts = filterTxOutsfromMemPool(myUTxOuts, memPool);
  // Now we check if we actually have the money to spend
  const { includedUTxOuts, leftOverAmount } = findAmountOnTxOuts(
    amount,
    filteredUTxOuts
  );
  // We need to create a function that create an unsigned TxIn based on a uTxOut
  const toUnsignedTxIn = uTxOut => {
    const txIn = new TxIn();
    txIn.txOutId = uTxOut.txOutId;
    txIn.txOutIndex = uTxOut.txOutIndex;
    return txIn;
  };
  // And here we create all the TxIn we need based on the TxOuts we created above
  const unsignedTxIns = includedUTxOuts.map(toUnsignedTxIn);
  /*
    And here we create the transaction. Remember that the structure
    of a transaction is:
        ID
        txIns []
        txOuts []
  */
  const tx = new Transaction();
  // Assign the unsignedTxIns to the txIns of the Tx;
  tx.txIns = unsignedTxIns;
  // Assign the created txOuts to the txOuts of the Tx;
  tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
  // Get the Id of the Tx (by hashing the txIns and txOuts)
  tx.id = getTxId(tx);
  // Sign each one of the txIn
  tx.txIns = tx.txIns.map((txIn, index) => {
    txIn.signature = signTxIn(tx, index, privateKey, uTxOuts);
    return txIn;
  });
  tx.amount = amount;
  tx.from = myAddress;
  tx.to = receiverAddress;
  return tx;
};

module.exports = {
  getPublicFromWallet,
  createTransaction,
  getPrivateFromWallet,
  initWallet,
  getBalance,
  findUTxOuts
};
