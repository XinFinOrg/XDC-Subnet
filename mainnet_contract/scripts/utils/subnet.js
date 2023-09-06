const fetch = require("node-fetch").default;
const deploy = require("../../deployment.config.json");

async function data() {
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
  let data0;
  let data1;
  try {
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
    data0 = await block0res.json();
    data1 = await block1res.json();
  } catch (e) {
    throw Error(
      "Fetch remote subnet node data error , pls check the subnet status"
    );
  }

  if (!data0["result"]["Committed"] || !data1["result"]["Committed"]) {
    console.error(
      "remote subnet node block data 0 or block 1 is not committed"
    );
    return;
  }
  const data0Encoded = "0x" + data0["result"]["HexRLP"];
  const data1Encoded = "0x" + data1["result"]["HexRLP"];

  return { data0Encoded, data1Encoded };
}

module.exports = { data };
