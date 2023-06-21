require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
const deploy = require("./deployment.json");
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    xdcdevnet: {
      url: deploy["xdcdevnet"],
      accounts: [process.env.PRIVATE_KEY],
    },
    xdcsubnet: {
      url: deploy["xdcsubnet"],
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
