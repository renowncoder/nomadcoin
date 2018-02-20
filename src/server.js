const express = require("express"),
  bodyParser = require("body-parser"),
  morgan = require("morgan"),
  Blockchain = require("./blockchain"),
  P2P = require("./p2p"),
  Wallet = require("./wallet"),
  MemPool = require("./mempool");

const {
  getBlockchain,
  createNewBlock,
  createNewBlockWithTx,
  getAccountBalance,
  sendTransaction,
  getUTxOutsList,
  myUTxOuts
} = Blockchain;
const { connectToPeers, startP2PServer } = P2P;
const { initWallet, getPublicFromWallet } = Wallet;
const { getMemPool } = MemPool;
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const P2P_PORT = process.env.P2P_PORT || 4000;

const app = express();

app.use(bodyParser.json());

app.use(morgan("combined"));

app.get("/blocks", (req, res) => {
  res.send(getBlockchain());
});

app.post("/mineBlock", (req, res) => {
  const newBlock = createNewBlock(req.body.data);
  res.send(newBlock);
});

app.post("/addPeer", (req, res) => {
  connectToPeers(req.body.peer);
  res.send();
});

app.post("/mineTransaction", (req, res) => {
  const address = req.body.address;
  const amount = req.body.amount;
  try {
    const response = createNewBlockWithTx(address, amount);
    res.send(response);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

app.get("/balance", (req, res) => {
  const balance = getAccountBalance();
  res.send({ balance: balance });
});

app.get("/address", (req, res) => {
  const address = getPublicFromWallet();
  res.send({ address });
});

app.post("/sendTransaction", (req, res) => {
  try {
    const address = req.body.address;
    const amount = req.body.amount;
    if (address === undefined || amount === undefined) {
      throw Error("Please specify address and amount");
    } else {
      const resp = sendTransaction(address, amount);
      res.send(resp);
    }
  } catch (e) {
    res.status(400).send(e.message);
  }
});

app.get("/uTxOuts", (req, res) => {
  res.send(getUTxOutsList());
});

app.get("/myUTxOuts", (req, res) => {
  res.send(myUTxOuts());
});

app.get("/memPool", (req, res) => {
  res.send(getMemPool());
});

// export HTTP_PORT=
app.listen(HTTP_PORT, () => {
  // eslint-disable-next-line
  console.log(`Nomad Coin Node Running on port ${HTTP_PORT} ✅`);
});

startP2PServer(P2P_PORT);
initWallet();
