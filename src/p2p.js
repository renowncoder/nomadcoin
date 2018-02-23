const WebSocket = require("ws"),
  Mempool = require("./mempool"),
  Blockchain = require("./blockchain");

const {
  getNewestBlock,
  isBlockStructureValid,
  addBlockToChain,
  replaceChain,
  getBlockchain,
  handleIncomingTx
} = Blockchain;

const { getMemPool } = Mempool;

// We need to save the sockets somewhere
const sockets = [];

// Message Types

const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";
const REQUEST_MEMPOOL = "REQUEST_MEMPOOL";
const MEMPOOL_RESPONSE = "MEMPOOL_RESPONSE";

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

const requestMempool = () => {
  return {
    type: REQUEST_MEMPOOL,
    data: null
  };
};

const mempoolResponse = data => {
  return {
    type: MEMPOOL_RESPONSE,
    data
  };
};

// Start the P2P Server
const startP2PServer = port => {
  const server = new WebSocket.Server({ port });
  server.on("connection", ws => {
    initConnection(ws);
  });
  // eslint-disable-next-line
  console.log(`Nomad Coin P2P Server Running on port ${port} ✅`);
};

// Getting the sockets
const getSockets = () => sockets;

// This fires everytime we add a new socket
const initConnection = socket => {
  sockets.push(socket);
  socketMessageHandler(socket);
  initError(socket);
  sendMessage(socket, getLatest());
  setTimeout(() => {
    sendMessageToAll(requestMempool());
  }, 500);
  setInterval(() => {
    if (sockets.includes(socket)) {
      sendMessage(socket);
    }
  }, 1000);
};

// We use this to add peers
const connectToPeers = newPeer => {
  const ws = new WebSocket(newPeer);
  ws.on("open", () => {
    initConnection(ws);
  });
  ws.on("close", () => console.log("Close"));
  ws.on("error", () => console.log("Connection failed"));
};

// Parsing string to JSON
const parseMessage = data => {
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
};

// Here we are gonna handle all the messages that our sockets get
const socketMessageHandler = ws => {
  ws.on("message", data => {
    try {
      const message = parseMessage(data);
      // Check if we get an empty message
      if (message === null) {
        return;
      }
      switch (message.type) {
        case GET_LATEST:
          sendMessage(ws, returnLatest());
          break;
        case GET_ALL:
          sendMessage(ws, returnAll());
          break;
        // eslint-disable-next-line
        case BLOCKCHAIN_RESPONSE:
          const receivedBlocks = message.data;
          // If the blockchain answers with no blocks break
          if (receivedBlocks === null) {
            break;
          }
          handleBlockchainResponse(receivedBlocks);
          break;
        case REQUEST_MEMPOOL:
          sendMessage(ws, returnAllMempool());
          break;
        // eslint-disable-next-line
        case MEMPOOL_RESPONSE:
          const receivedTxs = message.data;
          // If the mempool sends a null mempool
          if (receivedTxs === null) {
            break;
          }
          receivedTxs.forEach(tx => {
            try {
              /*
              If nothing fails and there is no error
              it means we added the Tx to the Mempool
              so we can broadcast the new mempool
            */
              handleIncomingTx(tx);
              broadcastMempool();
            } catch (e) {
              console.log(tx.id);
            }
          });
          break;
      }
    } catch (e) {
      console.log(e);
    }
  });
};

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const sendMessageToAll = message =>
  sockets.forEach(socket => sendMessage(socket, message));

const broadcastNewBlock = () => sendMessageToAll(returnLatest());

const returnLatest = () => blockchainResponse([getNewestBlock()]);

const returnAll = () => blockchainResponse(getBlockchain());

const returnAllMempool = () => mempoolResponse(getMemPool());

const broadcastMempool = () => sendMessageToAll(returnAllMempool());

const handleBlockchainResponse = receivedBlocks => {
  // Check if the blockchain size is bigger than zero
  if (receivedBlocks.length === 0) {
    console.log("Received blocks");
    return;
  }
  const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
  // Validate the latest block structure on the chain
  if (!isBlockStructureValid(latestBlockReceived)) {
    console.log("The block structure is not valid");
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
      if (addBlockToChain(latestBlockReceived)) {
        sendMessageToAll(returnLatest());
      }
      // If we only got one block that is not only one block behind we have to get the whole blockchain
    } else if (receivedBlocks.length === 1) {
      // Send message to all sockets to get our blockchain
      sendMessageToAll(getAll());
    } else {
      /* 
        If we get more than one block and our blockchain is behind,
        we will just replace our blockchain with the longer one that we just received
      */
      replaceChain(receivedBlocks);
    }
  } else {
    // If we receive a blockchain but we are not behind it, we do nothing.
    return;
  }
};

const initError = ws => {
  const closeConnection = closedWs => {
    closedWs.close();
    // Remove the closed socket from our socket array
    sockets.splice(sockets.indexOf(closedWs), 1);
  };
  ws.on("close", () => closeConnection(ws));
  ws.on("error", () => closeConnection(ws));
};

module.exports = {
  startP2PServer,
  connectToPeers,
  getSockets,
  broadcastNewBlock,
  broadcastMempool
};
