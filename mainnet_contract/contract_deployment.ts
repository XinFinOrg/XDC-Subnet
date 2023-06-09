import assert from 'assert';
import fs from "fs";
import dotenv from "dotenv";
import Web3 from "web3";
import { blocks, config, lib_address, subnet_contract} from "./config";

const TRANSACTION_GAS_NUMBER = 250000000;
dotenv.config({path: ".env"});

let w3 = new Web3(config["mainnet_rpc"]);
let account = w3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY || "");
var subnet = new w3.eth.Contract(subnet_contract["abi"]);
let subnetTxn = subnet.deploy({
  data: subnet_contract["bytecode"].replaceAll("__HeaderReader__________________________", lib_address),
  arguments: [
    config["validators"],
    blocks["genesis_header_encoded"],
    blocks["block1_header_encoded"],
    config["gap"],
    config["epoch"],
  ]
});

let txn = (await w3.eth.accounts.signTransaction(
  {
    data: subnetTxn.encodeABI(),
    gas: await subnetTxn.estimateGas({from: account.address}),
    gasPrice: TRANSACTION_GAS_NUMBER
  },
  account.privateKey
)).rawTransaction || "";

let receipt = await w3.eth.sendSignedTransaction(txn);
console.log(`Subnet contract deployed at: ${receipt.contractAddress}`);

fs.writeFileSync("./address.txt", receipt.contractAddress);

subnet = new w3.eth.Contract(subnet_contract["abi"], receipt.contractAddress);

assert((await subnet.methods.isMaster(account.address).call()), "Contract is not loaded into the chain");

