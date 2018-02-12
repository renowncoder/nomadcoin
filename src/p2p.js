const Blockchain = require("./blockchain"),
  WebSocket = require("ws");

const getNewestBlock = Blockchain.getNewestBlock;

// We need to save the sockets somewhere
const sockets = [];

// Message Types

const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";

// Message Creators

const getLatest = () => {
  return {
    type: GET_LATEST,
    data: null
  };
};

const getAll = () => {
  return {
    type: GET_ALL,
    data: null
  };
};

const blockchainResponse = data => {
  return {
    type: BLOCKCHAIN_RESPONSE,
    data
  };
};

// Start the P2P Server
const startP2PServer = port => {
  const server = new WebSocket.Server({ port });
  server.on("connection", ws => {
    initConnection(ws);
  });
  console.log(`Nomad Coin P2P Server Running on port ${port} ✅`);
};

// Getting the sockets
const getSockets = () => sockets;

// This fires everytime we add a new socket
const initConnection = socket => {
  sockets.push(socket);
  socketMessageHandler(socket);
  sendMessage(socket, getLatest());
};

// We use this to add peers
const connectToPeers = newPeer => {
  const ws = new WebSocket(newPeer);
  ws.on("open", () => {
    initConnection(ws);
  });
};

// Parsing string to JSON
const parseMessage = data => {
  try {
    return JSON.parse(data);
  } catch (e) {
    console.log("Error parsing message");
    return null;
  }
};

// Here we are gonna handle all the messages that our sockets get
const socketMessageHandler = ws => {
  ws.on("message", data => {
    const message = parseMessage(data);
    // Check if we get an empty message
    if (message === "null") {
      return;
    }
    console.log(message);
    switch (message.type) {
      case GET_LATEST:
        sendMessage(ws, returnLatest());
        break;
      case BLOCKCHAIN_RESPONSE:
        break;
    }
  });
};

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const returnLatest = () => blockchainResponse([getNewestBlock()]);

module.exports = {
  startP2PServer,
  connectToPeers
};
