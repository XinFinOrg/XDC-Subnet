const fs = require('fs');
const Web3 = require("web3");
const RLP = require("rlp");
const assert = require('assert');

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
  ************* Dealing with validators *****************
  *******************************************************
  */

  // Update validator information
  // validators: [address] => list of validator address
  // threshold: int => number of validators to pass verification
  // block_height: int => the height in mainnet where the validators become valid
  async updateValidators(validators, threshold, block_height) {
    let transaction = this.subnetContract.methods.reviseValidatorSet(validators, threshold, block_height);
    const receipt = await this.send(transaction);
    return receipt;
  }

  // Get validator set at a block height
  async getValidatorSet(block_height) {
    return await this.subnetContract.methods.getValidatorSet(block_height).call();
  }

  // Get validators threshold at a block height
  async getValidatorThreshold(block_height) {
    return await this.subnetContract.methods.getValidatorThreshold(block_height).call();
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
  async getLatestBlock() {
    let latestBlock = await this.subnetContract.methods.getLatestBlock().call();
    return [latestBlock[0], latestBlock[1]];
  }

  // Return the boolean of whether the block is finalized in the mainnet
  async getBlockConfirmationStatus(blockHash) {
    return await this.subnetContract.methods.getHeaderConfirmationStatus(blockHash).call();
  }

  // Return the mainnet block height that receives the subnet block
  async getMainnetNumber(blockHash) {
    return await this.subnetContract.methods.getMainnetBlockNumber(blockHash).call();
  }

}

// const oldLibAddress = "0x3B3a580c10B4CA7596b95eAa87f4480137D615C5"
// const oldLibAddress = "0x91A91e5E6b130e5549a11e0904E9d3A7a90804C0";
// const oldLibAddress1 = "0x1E871879B6cD47A28AE57f14005966A35179722b";
// const oldLibAddress2 = "0xC320F9f75C684D83b7d1ff37eE9684A6c205eD95";
// const oldLibAddress3 = "0x049b5E200e31041eA81848A6E90810e96c5E970c";
// const devnet = "http://194.233.77.19:8545";
// const oldSubnetContractAddress1 = "0x1C0391882fB2979e90d81d4f72B3D0B3BBD449C0";
// const oldSubnetContractAddress2 = "0x8D0120C86202939d2A5f56497c905B19d0A2CbA6";
// const oldSubnetContractAddress3 = "0x8646DD101BA87de663aA4153B650aC8A3B620456";
// const oldSubnetContractAddress4 = "0x122D02d11A682D05Da1cb701Fa659C16F58D96DA"
// const subnetContractJson = JSON.parse(fs.readFileSync("../build/contracts/Subnet.json"))
// const web3 = new Web3(devnet);
// const account = web3.eth.accounts.privateKeyToAccount(fs.readFileSync("../.env", "utf-8").trim());
// const subnetContract = new web3.eth.Contract(subnetContractJson["abi"], subnetContractAddress);

if (require.main === module) {
  (async() => {
    const subnet = new SubnetAPI(
      "http://34.228.141.74:8545",
      fs.readFileSync("../.env", "utf-8").trim(),
      "0xD942dAc072724FC4E4EC73c8f59420D465DB0FD6",
      JSON.parse(fs.readFileSync("../build/contracts/Subnet.json"))["abi"]
    );

    //pk: 0x1d2df3be09a495a628a848381253d24b2ab66e282ecc4a4d508f809cbf4ad1b7 address: 0x281845121519129d3d2D5eB547E77E4e980a2725
    //pk: 0xa1b9443d727933eda527714fa632767b25698e23e8703493d2a11102839c80f5 address: 0xceA057D9e467B4b32A5d905FaaA6FB625Fa366c1
    //pk: 0x54a6baf83b71e127f9f3dc9d299bc11530655bb60f03f527bda66ecfc8fedcb6 address: 0xdc988bC88541199696AF395AdB460f28CE73411F
    // await subnet.updateValidators(
    //   ["0x281845121519129d3d2D5eB547E77E4e980a2725", "0xceA057D9e467B4b32A5d905FaaA6FB625Fa366c1", "0xdc988bC88541199696AF395AdB460f28CE73411F"],
    //   2,
    //   1
    // );
    
    let data = "+QLyoBhUEVB1JDN2fkI75hZ1DtJpLZkDdcTs8tcQo4+DnvlooB3MTejex116q4W1Z7bM1BrTEkUblIp0E/ChQv1A1JNHlFBY3+JO9rU3tbxHEWpF8EKNoYL6oHfSQoNpYH9Et8Jot0o6Xrr+PR2qGW6uxu1B7Iq+B86+oAfNrUUg7OfiWDQLEg+byi04Yt+XtriLxKtwFC6C1gwhoDdncgbIXXv5BaLynZOAxlyNb3IxscWjbLYovFzMD+TQuQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEChBkIsQCCYwiEZCugzrizAviwA/it46AYVBFQdSQzdn5CO+YWdQ7SaS2ZA3XE7PLXEKOPg575aAIB+Ia4QSNOFmSGEGe3AS32B7JuNDSYwC6JzeMYIFdzJ66dKYx6fyVcrmFu7LQxOm8xr4pgCObFq5g9nEWlN/gLMwgOZtcBuEEyVFAo3Xel7c8RmcDiuskNVwGN8I1PCrY5WlsraoPQzF50pvrBFV44wzC9yu8ZZzgkDT5+A5L04RazKKDTBoXHAYCgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACIAAAAAAAAAADCgIC4QYa3Hjo7N/flJ+GPqXxoBN7+CSt/8qyKvFyv3W/990/MMPqLbMTMPHjvPYAxlFKQLG38DQLCkb6aiu9GjZ/RX8wBgA=="
    let buff = new Buffer(data, "base64");
    let header = "0x"+buff.toString("hex");
    // console.log(header);
    // headerBytes = "0xf902a3a06f228d14f45ddfa59124871d8854a3533cd55021748e711f457d3eda6f4b8cc8a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794efea93e384a6ccaaf28e33790a2d1b2625bf964da0391364838a922acf944686ad94f3f8cc2189302ae085be123e72ec6550aaa990a0f56fb69db371169b9007d863f48c82e60f28e40b64657d87da08629c362716b8a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000101841908b1008263088463d8c006aa02e802e6e3a06f228d14f45ddfa59124871d8854a3533cd55021748e711f457d3eda6f4b8cc88080c080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b83c5058dfe24ef6b537b5bc47116a45f0428da182fa888c073313b36cf03cf1f739f39443551ff12bbeefea93e384a6ccaaf28e33790a2d1b2625bf964db841f1c9e8a95d2ee5e018250871c18835bcc084a772fb324032eebb66255c1bc4bf5b263f303390b18ee7005d6f00c80795c52d2262cea3f9bf56920cca77fed4470180";
    console.log(RLP.decode(header)[15]);

    // await subnet.submitHeaderInBytes(headerBytes);
    
    // By default only this account is the master of the contract
    // if (subnet.account.address == "0x377B97484925d616886816754c6CD4FB2004D4C1") {
    //   let isMaster = await subnet.verifyMaster(subnet.account.address);
    //   assert.equal(isMaster, true);
    // } else {
    //   let isMaster = await subnet.verifyMaster(subnet.account.address);
    //   assert.equal(isMaster, false);
    // }
    
    // // The validator at block1 has been updated according to the prerun updateValidator function above
    // let validatorSets = await subnet.getValidatorSet(0);
    // assert.deepEqual(validatorSets, [
    //   "0x1e702e18c9B70328c593D79ba9cae2189184f2Ac",
    //   "0x247E30050AA6eF2d0E2Df55189c0b7BC23e638Be",
    //   "0xee2e7a6479Cf0477B97A9f4705E23411f31404a3"
    // ]);
    // let validatorThreshold = await subnet.getValidatorThreshold(1);
    // assert.equal(validatorThreshold, 2);

    // // The latest finalized block is the genesis which equals to the one we have defined previously
    // const initJson = JSON.parse(fs.readFileSync("../subnet_initialization.json"));
    // let genesis = await subnet.getLatestHeader();
    // await subnet.submitHeaderInBytes(headerBytes);
    // assert.equal(genesis, initJson["genesis_header_encoded"]);
    // let genesis_hash = subnet.web3.utils.sha3(genesis);
    // let finalized_hash = await subnet.getLatestBlockHash();
    // assert.equal(finalized_hash, genesis_hash);
    // console.log(await subnet.getLatestBlock())
    // console.log("No assertion failure, verification complete!");

  })();
}