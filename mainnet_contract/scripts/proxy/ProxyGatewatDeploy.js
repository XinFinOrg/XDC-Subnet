const hre = require("hardhat");
const deploy = require("../deployment.json");

async function main() {
  // We get the contract to deploy
  const proxyGatewayFactory = await hre.ethers.getContractFactory(
    "ProxyGateway"
  );

  const proxyGateway = await proxyGatewayFactory.deploy();

  await proxyGateway.deployed();

  console.log("proxyGateway deployed to:", proxyGateway.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
