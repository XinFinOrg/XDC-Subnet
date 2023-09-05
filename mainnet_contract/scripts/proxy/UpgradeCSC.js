const hre = require("hardhat");
const upgradeConfig = require("../../upgrade.config.json");
const deploy = require("../../deployment.config.json");

async function main() {
  // We get the contract to deploy
  const proxyGatewayAddress = upgradeConfig["proxyGateway"];

  const proxyGatewayFactory = await hre.ethers.getContractFactory(
    "ProxyGateway"
  );

  const proxyGateway = proxyGatewayFactory.attach(proxyGatewayAddress);

  let fullProxy = await proxyGateway.cscProxies(0);
  let liteProxy = await proxyGateway.cscProxies(1);

  const block0 = {
    jsonrpc: "2.0",
    method: "XDPoS_getV2BlockByNumber",
    params: ["0x0"],
    id: 1,
  };
  const block1 = {
    jsonrpc: "2.0",
    method: "XDPoS_getV2BlockByNumber",
    params: ["0x1"],
    id: 1,
  };
  const block0res = await fetch(deploy["xdcsubnet"], {
    method: "POST",
    body: JSON.stringify(block0),
    headers: { "Content-Type": "application/json" },
  });
  const block1res = await fetch(deploy["xdcsubnet"], {
    method: "POST",
    body: JSON.stringify(block1),
    headers: { "Content-Type": "application/json" },
  });
  const data0 = await block0res.json();
  const data1 = await block1res.json();

  if (!data0["result"]["Committed"] || !data1["result"]["Committed"]) {
    console.error(
      "remote subnet node block data 0 or block 1 is not committed"
    );
    return;
  }

  const data0Encoded = "0x" + data0["result"]["HexRLP"];
  const data1Encoded = "0x" + data1["result"]["HexRLP"];
  // We get the contract to deploy
  const fullFactory = await hre.ethers.getContractFactory("FullCheckpoint");

  const full = await fullFactory.deploy();

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
