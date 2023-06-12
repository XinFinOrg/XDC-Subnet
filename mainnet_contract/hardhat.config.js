require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    mainnet: {
      url: "https://devnetstats.apothem.network/mainnet",
      accounts: [process.env.PRIVATE_KEY],
    },
    xdcsubnet: {
      url: "https://devnetstats.apothem.network/subnet",
      accounts: [process.env.PRIVATE_KEY],
    },
    goerli: {
      url: "https://eth-goerli.g.alchemy.com/v2/h_ejnh49CncsUUiD3NbDieD4Ieuvl_tE",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
