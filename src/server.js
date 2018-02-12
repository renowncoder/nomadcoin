const express = require("express"),
  bodyParser = require("body-parser"),
  morgan = require("morgan"),
  Blockchain = require("./blockchain");

const getBlockchain = Blockchain.getBlockchain;
const createNewBlock = Blockchain.createNewBlock;
const PORT = 3000;

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

app.listen(3000, () => {
  console.log(`Nomad Coin Node Running on port ${PORT} ✅`);
});
