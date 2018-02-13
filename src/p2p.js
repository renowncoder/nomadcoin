const Blockchain = require("./blockchain"),
  WebSocket = require("ws");

const {
  getNewestBlock,
  isBlockStructureValid,
  addBlockToChain,
  replaceChain
} = Blockchain;

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
    switch (message.type) {
      case GET_LATEST:
        sendMessage(ws, returnLatest());
        break;
      case BLOCKCHAIN_RESPONSE:
        const receivedBlocks = message.data;
        // If the blockchain answers with no blocks break
        if (receivedBlocks === null) {
          break;
        }
        handleBlockchainResponse(receivedBlocks);
        break;
    }
  });
};

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const returnLatest = () => blockchainResponse([getNewestBlock()]);

const handleBlockchainResponse = receivedBlocks => {
  // Check if the blockchain size is bigger than zero
  if (receivedBlocks.length === 0) {
    return;
  }
  const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
  // Validate the latest block structure on the chain
  if (!isBlockStructureValid(latestBlockReceived)) {
    return;
  }
  // Get the newest block from the blockchain
  const newestBlock = getNewestBlock();
  /*
    Check if the index of the block we received is greater than the newest block in our blockchain
    This means that our blockchain is behind
   */
  if (latestBlockReceived.index > newestBlock.index) {
    /* 
      Check if the received block has the hash of hour newest block in his 'previousHash'.
      This will mean that our blockchain is only one block behind
    */
    if (newestBlock.hash === latestBlockReceived.previousHash) {
      // If we are only one block behind all we have to do is add it to our chain
      addBlockToChain(latestBlockReceived);
      // If we only got one block that is not only one block behind we have to get the whole blockchain
    } else if (receivedBlocks.length === 1) {
      // TODO: Get all blocks
    } else {
      /* 
        If we get more than one block and our blockchain is behind,
        we will just replace our blockchain with the longer one that we just received
      */
      replaceChain(receivedBlocks);
    }
  }
};

module.exports = {
  startP2PServer,
  connectToPeers
};
