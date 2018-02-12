const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const Blockchain = require("./blockchain");

const getBlockchain = Blockchain.getBlockchain;
const createNewBlock = Blockchain.createNewBlock;
const PORT = 3000;

const app = express();
app.use(bodyParser.json());
app.use(morgan("combined"));
app.listen(3000, () => {
  console.log(`Nomad Coin Node Running on port ${PORT} ✅`);
});
