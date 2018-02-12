const WebSockets = require("ws");

const sockets = [];

const startP2PServer = port => {
  const server = new WebSockets.Server({ port });
  console.log(`Nomad Coin P2P Server Running on port ${port} ✅`);
};

module.exports = {
  startP2PServer
};
