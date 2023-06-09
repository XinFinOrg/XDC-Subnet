require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
const { ProxyAgent, setGlobalDispatcher } = require("undici");

// set proxy
// const proxyUrl = "http://127.0.0.1:1087"; // change to yours, With the global proxy enabled, change the proxyUrl to your own proxy link. The port may be different for each client.

// const proxyAgent = new ProxyAgent(proxyUrl);
// setGlobalDispatcher(proxyAgent);
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.20",
};
