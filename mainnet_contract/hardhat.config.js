require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

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
      url: "https://devnetstats.apothem.network/devnet",
      accounts: [process.env.PRIVATE_KEY],
    },
    xdcsubnet: {
      url: "https://devnetstats.apothem.network/subnet",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
