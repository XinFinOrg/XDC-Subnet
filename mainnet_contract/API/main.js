const fs = require('fs');
const Web3 = require("web3");
const RLP = require("rlp");
const assert = require('assert');
const secp256k1 = require("secp256k1");
const request = require("request");

class SubnetAPI {

  constructor(devnet_ip, privKey, subnetContractAddress, subnetContractABI) {
    this.web3 = new Web3(devnet_ip);
    this.account = this.web3.eth.accounts.privateKeyToAccount(privKey);
    this.subnetContract = new this.web3.eth.Contract(subnetContractABI, subnetContractAddress);
  }


  // Complete transaction that modify contract status
  async send(transaction) {
    const options = {
      to      : transaction._parent._address,
      data    : transaction.encodeABI(),
      gas     : await transaction.estimateGas({from: this.account.address}),
      gasPrice: 250000000
    };
    const signed  = await this.web3.eth.accounts.signTransaction(options, this.account.privateKey);
    const receipt = await this.web3.eth.sendSignedTransaction(signed.rawTransaction);
    return receipt
  }

  /*
  *******************************************************
  ************* Dealing with masters ********************
  *******************************************************
  */

  // Verify whether address is in the master list
  // TODO: there is some modification to the current contract. At the devnet now, it is using masters which
  //       should not be allowed because of non-restricted access
  async verifyMaster(address) {
    return await this.subnetContract.methods.isMaster(address).call();
  }


  async addMaster(address) {
    let transaction = this.subnetContract.methods.addMaster(address);
    const receipt = await send(transaction);
    return receipt;
  }

  async removeMaster(address) {
    let transaction = this.subnetContract.methods.removeMaster(address);
    const receipt = await send(transaction);
    return receipt;
  }

  /*
  *******************************************************
  ************* Dealing with block headers **************
  *******************************************************
  */

  // Send subnet block header to mainnet
  // header: RLP encoded bytes of subnet header.
  async submitHeaderInBytes(header) {
    let transaction = this.subnetContract.methods.receiveHeader(header);
    const receipt = await this.send(transaction);
    return receipt;
  }

  // Send subnet block header to mainnet
  // header: subnet header in struct.
  // TODO: not sure if this is needed. 
  async submitHeaderInStruct(header) {
    let transaction = this.subnetContract.methods.receiveHeader(header);
    const receipt = await this.send(transaction);
    return receipt;
  }

  // Return latest finalized subnet block header in RLP encoded bytes
  async getLatestHeader() {
    let latestBlock = await this.subnetContract.methods.getLatestBlock().call();
    const latestFinalizedBlockInfo = await this.subnetContract.methods.getHeader(latestBlock[0]).call();
    return latestFinalizedBlockInfo;
  }

  // Return latest finalized subnet block hash
  async getLatestBlocks() {
    let latestBlocks = await this.subnetContract.methods.getLatestBlocks().call();
    return [latestBlocks[0], latestBlocks[1]];
  }

  // Return the mainnet block height that receives the subnet block
  async getCurrentValidators() {
    return await this.subnetContract.methods.getCurrentValidators().call();
  }

}


if (require.main === module) {
  (async() => {
    const subnet = new SubnetAPI(
      "http://194.233.77.19:8545",
      fs.readFileSync("../.env", "utf-8").trim(),
      "0x0552B96871fA181dD2218035762353bfa26778c1",
      JSON.parse(fs.readFileSync("../build/contracts/Subnet.json"))["abi"]
    );
    console.log(await subnet.getLatestBlocks())
    // const genesis = "+QKWoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoB3MTejex116q4W1Z7bM1BrTEkUblIp0E/ChQv1A1JNHlAAAAAAAAAAAAAAAAAAAAAAAAAAAoDGswPR920uJqpvphJhP4sNGVWESdeuTXp0NzQlgPYwHoFboHxcbzFWm/4NF5pLA+G5bSOAbmWytwAFiL7XjY7QhoFboHxcbzFWm/4NF5pLA+G5bSOAbmWytwAFiL7XjY7QhuQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAg0e3YICEZDQ1rLidAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQWN/iTva1N7W8RxFqRfBCjaGC+oiMBzMTs2zwPPH3OfOUQ1Uf8Su+7+qT44SmzKryjjN5Ci0bJiW/lk0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIgAAAAAAAAAAIDAwIA=";
    // const web3 = new Web3("http://127.0.0.1:8545");
    // const account = web3.eth.accounts.privateKeyToAccount("0xa4848e9becfc1ed3dfee1e6e86cd35cb8848afa657ac9ab66727afc61280214b");
    // const libContractFile = JSON.parse(fs.readFileSync("../build/contracts/HeaderReader.json"))
    // const libContract = new web3.eth.Contract(libContractFile["abi"]);
    // const libContractTxn = libContract.deploy({
    //   data: libContractFile["bytecode"]
    // });
    // const txn1 = await web3.eth.accounts.signTransaction(
    //   {
    //     data: libContractTxn.encodeABI(),
    //     gas: 2000000,
    //   },
    //   account.privateKey
    // );
    // const receipt1 = await web3.eth.sendSignedTransaction(txn1.rawTransaction);
    // console.log(`Contract deployed at address: ${receipt1.contractAddress}`);

    // libInstance = new web3.eth.Contract(libContractFile["abi"], receipt1.contractAddress);
    // const subnetContractFile = JSON.parse(fs.readFileSync("../build/contracts/Subnet.json"))
    // const subnetContract = new web3.eth.Contract(subnetContractFile["abi"]);
    // const subnetContractTxn = subnetContract.deploy({
    //   data: subnetContractFile["bytecode"].replaceAll("__HeaderReader__________________________", receipt1.contractAddress.slice(2)),
    //   arguments: [
    //     [
    //       "0x888c073313b36cf03CF1f739f39443551Ff12bbE",
    //       "0x5058dfE24Ef6b537b5bC47116A45F0428DA182fA",
    //       "0xefEA93e384a6ccAaf28E33790a2D1b2625BF964d"
    //     ],
    //     "0xF90296A00000000000000000000000000000000000000000000000000000000000000000A01DCC4DE8DEC75D7AAB85B567B6CCD41AD312451B948A7413F0A142FD40D49347940000000000000000000000000000000000000000A031ACC0F47DDB4B89AA9BE984984FE2C34655611275EB935E9D0DCD09603D8C07A056E81F171BCC55A6FF8345E692C0F86E5B48E01B996CADC001622FB5E363B421A056E81F171BCC55A6FF8345E692C0F86E5B48E01B996CADC001622FB5E363B421B901000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001808347B7608084643435ACB89D00000000000000000000000000000000000000000000000000000000000000005058DFE24EF6B537B5BC47116A45F0428DA182FA888C073313B36CF03CF1F739F39443551FF12BBEEFEA93E384A6CCAAF28E33790A2D1B2625BF964D0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000A0000000000000000000000000000000000000000000000000000000000000000088000000000000000080C0C080",
    //     "0xF902E7A02E79DF1A00D1476063BA6EF75FF9E9FBAA6FC3F6F87F2E5CA2B19AE37B9F4543A01DCC4DE8DEC75D7AAB85B567B6CCD41AD312451B948A7413F0A142FD40D4934794EFEA93E384A6CCAAF28E33790A2D1B2625BF964DA09B21C68C6B49C9BC5DFF95F7AD6BD69920A97F54A56D5D1C72BCC608B95825D8A0A3BA846F7BAC944A3A323E083CF3A1E8722D78708216A46C99963ABA1DB42585A037677206C85D7BF905A2F29D9380C65C8D6F7231B1C5A36CB628BC5CCC0FE4D0B90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000101841908B1008263088464343A44AA02E802E6E3A02E79DF1A00D1476063BA6EF75FF9E9FBAA6FC3F6F87F2E5CA2B19AE37B9F45438080C080A00000000000000000000000000000000000000000000000000000000000000000880000000000000000B84130EDF5FC28D539DCC22AA4C712D90DA368A0F956D0B72CD1355475311B4D669368159D6E5E8296D762265DEBD133FDC301BACFE64D37F9596ACF80AA5346686400F83F945058DFE24EF6B537B5BC47116A45F0428DA182FA94888C073313B36CF03CF1F739F39443551FF12BBE94EFEA93E384A6CCAAF28E33790A2D1B2625BF964DF83F945058DFE24EF6B537B5BC47116A45F0428DA182FA94888C073313B36CF03CF1F739F39443551FF12BBE94EFEA93E384A6CCAAF28E33790A2D1B2625BF964D80",
    //     450,
    //     900
    //   ]
    // });
    // const txn2 = await web3.eth.accounts.signTransaction(
    //   {
    //     data: subnetContractTxn.encodeABI(),
    //     gas: 6000000,
    //   },
    //   account.privateKey
    // );
    // const receipt2 = await web3.eth.sendSignedTransaction(txn2.rawTransaction);
    // console.log(`Contract deployed at address: ${receipt2.contractAddress}`);
    // subnetInstance = new web3.eth.Contract(subnetContractFile["abi"], receipt2.contractAddress);
    // const blocks = JSON.parse(fs.readFileSync("blocks.json"));
    // for (let i = 2; i < 1800; i++) {
    //   console.log(i);
    //   let transaction = subnetInstance.methods.receiveHeader([blocks[i]]);
    //   let options = {
    //     to      : transaction._parent._address,
    //     data    : transaction.encodeABI(),
    //     // gas     : await transaction.estimateGas({from: account.address}),
    //     gas     : 3000000,
    //     gasPrice: 250000000
    //   };
    //   let signed  = await web3.eth.accounts.signTransaction(options, account.privateKey);
    //   let receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
      
    // }

  })();
}