import fs from "fs";

const configFilePath = "./config.json";
const config = JSON.parse(fs.readFileSync(configFilePath).toString());
const subnet_contract = JSON.parse(fs.readFileSync(config["subnet_contract"]).toString());
const blocks = JSON.parse(fs.readFileSync(config["deploy_init"]).toString());
const lib_address = fs.readFileSync("lib_address.txt").toString().slice(2);

export { blocks, config, lib_address, subnet_contract};