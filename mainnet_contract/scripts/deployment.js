const hre = require("hardhat");
const deployArguments = require("../deploy-arguments");
const fetch = require("node-fetch").default;

function getBlockEncoded(encodedRLP) {
  const blockEncoded = "0x" + Buffer.from(encodedRLP, "base64").toString("hex");
  return blockEncoded;
}
async function main() {
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
  const block0res = await fetch(deployArguments["subnetRpc"], {
    method: "POST",
    body: JSON.stringify(block0),
    headers: { "Content-Type": "application/json" },
  });
  const block1res = await fetch(deployArguments["subnetRpc"], {
    method: "POST",
    body: JSON.stringify(block1),
    headers: { "Content-Type": "application/json" },
  });
  const data0 = await block0res.json();
  const data1 = await block1res.json();

  const data0Encoded = getBlockEncoded(data0["result"]["EncodedRLP"]);
  const data1Encoded = getBlockEncoded(data1["result"]["EncodedRLP"]);

  const headerReaderFactory = await hre.ethers.getContractFactory(
    "HeaderReader"
  );

  const headerReader = await headerReaderFactory.deploy();
  await headerReader.deployed();

  console.log("headerReader deployed to:", headerReader.address);
  // We get the contract to deploy
  const subnetFactory = await hre.ethers.getContractFactory("Subnet", {
    libraries: {
      HeaderReader: headerReader.address,
    },
  });

  const subnet = await subnetFactory.deploy(
    deployArguments["validators"],
    data0Encoded,
    data1Encoded,
    deployArguments["gap"],
    deployArguments["epoch"]
  );

  await subnet.deployed();

  console.log("subnet deployed to:", subnet.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
