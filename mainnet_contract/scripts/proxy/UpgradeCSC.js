const hre = require("hardhat");
const upgradeConfig = require("../../upgrade.config.json");
const deploy = require("../../deployment.config.json");
const subnet = require("../utils/subnet");

async function main() {
  // We get the contract to deploy
  const proxyGatewayAddress = upgradeConfig["proxyGateway"];

  const proxyGatewayFactory = await hre.ethers.getContractFactory(
    "ProxyGateway"
  );

  const proxyGateway = proxyGatewayFactory.attach(proxyGatewayAddress);

  let fullProxy = await proxyGateway.cscProxies(0);
  let liteProxy = await proxyGateway.cscProxies(1);

  const { data0Encoded, data1Encoded } = await subnet.data();
  // We get the contract to deploy
  const fullFactory = await hre.ethers.getContractFactory("FullCheckpoint");

  let full;
  try {
    full = await fullFactory.deploy();
  } catch (e) {
    throw Error(
      "depoly to parentnet node failure , pls check the parentnet node status"
    );
  }

  await full.deployed();

  // We get the contract to deploy
  const liteFactory = await hre.ethers.getContractFactory("LiteCheckpoint");

  const lite = await liteFactory.deploy();
  await lite.deployed();

  if (fullProxy == "0x0000000000000000000000000000000000000000") {
    console.log("fullProxy is zero address , start deploy full proxy");

    const tx = await proxyGateway.createFullProxy(
      full.address,
      deploy["validators"],
      data0Encoded,
      data1Encoded,
      deploy["gap"],
      deploy["epoch"]
    );
    await tx.wait();

    fullProxy = await proxyGateway.cscProxies(0);
  } else {
    await proxyGateway.upgrade(fullProxy, full.address);
  }

  if (liteProxy == "0x0000000000000000000000000000000000000000") {
    console.log("liteProxy is zero address , start deploy lite proxy");

    const tx = await proxyGateway.createLiteProxy(
      lite.address,
      deploy["validators"],
      data1Encoded,
      deploy["gap"],
      deploy["epoch"]
    );
    await tx.wait();
    liteProxy = await proxyGateway.cscProxies(1);
  } else {
    await proxyGateway.upgrade(liteProxy, lite.address);
  }

  console.log("upgrade success");
  console.log("full proxy : ", fullProxy);
  console.log("lite proxy : ", liteProxy);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
