const WebSockets = require("ws");

const sockets = [];

const startP2PServer = port => {
  const server = new WebSockets.Server({ port });
  server.on("connection", ws => {
    initConnection(ws);
  });
  console.log(`Nomad Coin P2P Server Running on port ${port} ✅`);
};

const getSockets = () => sockets;

const initConnection = socket => {
  sockets.push(socket);
};

const connectToPeers = newPeer => {
  const ws = new WebSockets(newPeer);
  ws.on("open", () => {
    initConnection(ws);
  });
};

module.exports = {
  startP2PServer,
  connectToPeers
};
