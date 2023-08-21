const hre = require("hardhat");
const deploy = require("../deployment.json");
const fetch = require("node-fetch").default;

async function main() {
  const block1 = {
    jsonrpc: "2.0",
    method: "XDPoS_getV2BlockByNumber",
    params: ["0x1"],
    id: 1,
  };

  const block1res = await fetch(deploy["xdcsubnet"], {
    method: "POST",
    body: JSON.stringify(block1),
    headers: { "Content-Type": "application/json" },
  });

  const data1 = await block1res.json();

  if (!data1["result"]["Committed"]) {
    console.error(
      "remote subnet node block data 0 or block 1 is not committed"
    );
    return;
  }

  const data1Encoded = "0x" + data1["result"]["HexRLP"];

  // We get the contract to deploy
  const checkpointFactory = await hre.ethers.getContractFactory(
    "LiteCheckpoint"
  );

  await sleep(10000)
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

  const checkpoint = await checkpointFactory.deploy(
    deploy["validators"],
    data1Encoded,
    deploy["gap"],
    deploy["epoch"]
  );

  await checkpoint.deployed();

  console.log("lite checkpoint deployed to:", checkpoint.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
