const express = require("express"),
  bodyParser = require("body-parser"),
  morgan = require("morgan"),
  Blockchain = require("./blockchain"),
  P2P = require("./p2p");

const { getBlockchain, createNewBlock } = Blockchain;
const { connectToPeers, startP2PServer } = P2P;

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

// export HTTP_PORT=
app.listen(HTTP_PORT, () => {
  // eslint-disable-next-line
  console.log(`Nomad Coin Node Running on port ${HTTP_PORT} ✅`);
});

startP2PServer(P2P_PORT);
