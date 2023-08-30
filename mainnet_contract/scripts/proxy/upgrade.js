const hre = require("hardhat");
const upgradeConfig = require("../../upgrade.config.json");
async function main() {
  // We get the contract to deploy
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
