const express = require("express"),
  _ = require("lodash"),
  cors = require("cors"),
  bodyParser = require("body-parser"),
  morgan = require("morgan"),
  paginate = require("paginate-array"),
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

app.use(cors());

app.use(morgan("combined"));

app.get("/blocks", (req, res) => {
  const page = req.query.page || 1;
  const reversedBlockchain = _.cloneDeep(getBlockchain());
  const paginatedBlockchain = paginate(reversedBlockchain.reverse(), page, 15);
  res.send(paginatedBlockchain);
});

app.get("/blocks/latest", (req, res) => {
  const lastFive = _(getBlockchain())
    .slice(-5)
    .reverse();
  res.send(lastFive);
});

app.get("/blocks/:index", (req, res) => {
  const block = _.find(getBlockchain(), { index: Number(req.params.index) });
  if (block === undefined) {
    res.status(400).send("Block not found");
  }
  res.send(block);
});

app.post("/mine", (req, res) => {
  const newBlock = createNewBlock(req.body.data);
  res.send(newBlock);
});

app
  .route("/transactions")
  .get((req, res) => {
    const page = req.query.page || 1;
    const txs = _(getBlockchain())
      .map(blocks => blocks.data)
      .flatten()
      .reverse()
      .value();
    const paginatedTxs = paginate(txs, page, 15);
    res.send(paginatedTxs);
  })
  .post((req, res) => {
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

app.get("/transactions/latest", (req, res) => {
  const txs = _(getBlockchain())
    .map(blocks => blocks.data)
    .flatten()
    .slice(-5)
    .reverse();
  res.send(txs);
});

app.get("/transactions/:id", (req, res) => {
  const tx = _(getBlockchain())
    .map(blocks => blocks.data)
    .flatten()
    .find({ id: req.params.id });
  if (tx === undefined) {
    res.status(400).send("Transaction not found");
  }
  res.send(tx);
});

app.get("/addresses/:address", (req, res) => {
  const uTxOuts = _.filter(
    getUTxOutsList(),
    uTxO => uTxO.address === req.params.address
  );
  const sumedUp = _(uTxOuts)
    .map(uTxO => uTxO.amount)
    .reduce((a, b) => a + b, 0);

  res.status(200).send(String(sumedUp));
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

app.get("/me/balance", (req, res) => {
  const balance = getAccountBalance();
  res.send({ balance: balance });
});

app.get("/me/address", (req, res) => {
  const address = getPublicFromWallet();
  res.send({ address });
});

app.get("/uTxOuts", (req, res) => {
  res.send(getUTxOutsList());
});

app.get("/me/uTxOuts", (req, res) => {
  res.send(myUTxOuts());
});

app.get("/unconfirmed", (req, res) => {
  res.send(getMemPool());
});

// export HTTP_PORT=
app.listen(HTTP_PORT, () => {
  // eslint-disable-next-line
  console.log(`Nomad Coin Node Running on port ${HTTP_PORT} ✅`);
});
try {
  startP2PServer(P2P_PORT);
  initWallet();
} catch (e) {
  console.log(e);
}
