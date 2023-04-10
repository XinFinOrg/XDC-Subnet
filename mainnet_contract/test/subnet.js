const { forContractInstance } =  require("@truffle/decoder");
const RLP = require("rlp");
const util = require("@ethereumjs/util");
const secp256k1 = require("secp256k1");
const HeaderReader = artifacts.require("HeaderReader");
const Subnet = artifacts.require("Subnet");

const num2Arr = (n) => {
  if (!n) return new Uint8Array(0)
  const a = []
  a.unshift(n & 255)
  while (n >= 256) {
    n = n >>> 8
    a.unshift(n & 255)
  }
  return new Uint8Array(a);
}

const hex2Arr = (hexString) => {
  if (hexString.length % 2 !== 0) {
      throw "Must have an even number of hex digits to convert to bytes";
  }
  var numBytes = hexString.length / 2;
  var byteArray = new Uint8Array(numBytes);
  for (var i=0; i<numBytes; i++) {
      byteArray[i] = parseInt(hexString.substr(i*2, 2), 16);
  }
  return byteArray;
}

const composeAndSignBlock = (number, round_num, prn, parent_hash, validators, threshold, current, next) => {

  const version = new Uint8Array([2]);
  const voteForSignHash = web3.utils.sha3(Buffer.from(
    RLP.encode([
      [parent_hash, prn, number-1],
      0
    ])
  ));

  var raw_sigs = []
  for (let i = 0; i < threshold; i++) {
    raw_sigs.push(
      secp256k1.ecdsaSign(
        hex2Arr(voteForSignHash.substring(2)),
        hex2Arr(validators[i].privateKey.substring(2))
    ));
  }
  var sigs = raw_sigs.map(x => {
    var res = new Uint8Array(65);
    res.set(x.signature, 0);
    res.set([x.recid], 64);
    return "0x"+Buffer.from(res).toString("hex");
  });


  var block = {
    "parent_hash": parent_hash,
    "uncle_hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "coinbase": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "root": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "txHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "receiptAddress": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "bloom": new Uint8Array(256),
    "difficulty": 0,
    "number": number,
    "gasLimit": 0,
    "gasUsed": 0,
    "time": 0,
    "extra": new Uint8Array([...version, ...RLP.encode([
      round_num,
      [
        [parent_hash, prn, number-1],
        sigs,
        0
      ]
    ])]),
    "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "nonce": new Uint8Array(8),
    "validators": [current, next],
    "validator": new Uint8Array(8),
    "penalties": new Uint8Array(8)
  }

  var block_encoded = Buffer.from(RLP.encode([
    util.toBuffer(parent_hash),
    util.zeros(32),
    util.zeros(32),
    util.zeros(32),
    util.zeros(32),
    util.zeros(32),
    new Uint8Array(256),
    util.bigIntToUnpaddedBuffer(0),
    util.bigIntToUnpaddedBuffer(number),
    util.bigIntToUnpaddedBuffer(0),
    util.bigIntToUnpaddedBuffer(0),
    util.bigIntToUnpaddedBuffer(0),
    new Uint8Array([...version, ...RLP.encode([
      round_num,
      [
        [parent_hash, prn, number-1],
        sigs,
        0
      ]
    ])]),
    util.zeros(32),
    new Uint8Array(8),
    [current, next],
    new Uint8Array(8),
    new Uint8Array(8),
  ]));

  var block_hash = web3.utils.sha3(block_encoded).toString("hex");
  return [block, "0x"+block_encoded.toString("hex"), block_hash];
}

const createValidators = (num_val) => {
  const validators = [];
  for (let i = 0; i < num_val; i++) {
    validators.push(web3.eth.accounts.create());
  }
  return validators;
}

contract("Subnet Test", async accounts => {

  beforeEach(async () => {
    this.validators = [];
    this.validators_addr = [];
    for (let i = 0; i < 3; i++) {
      this.validators.push(web3.eth.accounts.create());
      this.validators_addr.push(this.validators.at(-1).address);
    }
    const version = new Uint8Array([2]);
    const voteForSignHash = web3.utils.sha3(Buffer.from(
      RLP.encode([
        ["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 0],
        0
      ])
    ));
    const raw_sigs = [];
    for (let i = 0; i < 3; i++) {
      raw_sigs.push(
        secp256k1.ecdsaSign(
          hex2Arr(voteForSignHash.substring(2)),
          hex2Arr(this.validators[i].privateKey.substring(2))
        )
      );
    }
    const sigs = raw_sigs.map(x => {
      var res = new Uint8Array(65);
      res.set(x.signature, 0);
      res.set([x.recid], 64);
      return "0x"+Buffer.from(res).toString("hex");
    });

    this.genesis_block = {
      "parent_hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "uncle_hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "coinbase": "0x0000000000000000000000000000000000000000",
      "root": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "txHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "receiptAddress": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "bloom": new Uint8Array(256),
      "difficulty": 0,
      "number": 0,
      "gasLimit": 0,
      "gasUsed": 0,
      "time": 0,
      "extra": new Uint8Array([...version, ...RLP.encode([
        0,
        [
          ["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 0],
          sigs,
          0
        ]
      ])]),
      "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "nonce": new Uint8Array(8),
      "validators": new Uint8Array(8),
      "validator": new Uint8Array(8),
      "penalties": new Uint8Array(8)
    }
    
    this.genesis_hash = web3.utils.sha3(Buffer.from(
      RLP.encode([
        util.zeros(32),
        util.zeros(32),
        util.zeros(32),
        util.zeros(32),
        util.zeros(32),
        util.zeros(32),
        new Uint8Array(256),
        util.bigIntToUnpaddedBuffer(0),
        util.bigIntToUnpaddedBuffer(0),
        util.bigIntToUnpaddedBuffer(0),
        util.bigIntToUnpaddedBuffer(0),
        util.bigIntToUnpaddedBuffer(0),
        new Uint8Array([...version, ...RLP.encode([
          0,
          [
            ["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 0],
            sigs,
            0
          ]
        ])]),
        util.zeros(32),
        new Uint8Array(8),
        new Uint8Array(8),
        new Uint8Array(8),
        new Uint8Array(8),
    ])));

    this.genesis_encoded = "0x"+Buffer.from(RLP.encode([
      util.zeros(32),
      util.zeros(32),
      util.zeros(32),
      util.zeros(32),
      util.zeros(32),
      util.zeros(32),
      new Uint8Array(256),
      util.bigIntToUnpaddedBuffer(0),
      util.bigIntToUnpaddedBuffer(0),
      util.bigIntToUnpaddedBuffer(0),
      util.bigIntToUnpaddedBuffer(0),
      util.bigIntToUnpaddedBuffer(0),
      new Uint8Array([...version, ...RLP.encode([
        0,
        [
          ["0x0000000000000000000000000000000000000000000000000000000000000000", 0, 0],
          sigs,
          0
        ]
      ])]),
      util.zeros(32),
      new Uint8Array(8),
      new Uint8Array(8),
      new Uint8Array(8),
      new Uint8Array(8),
    ])).toString("hex");
    
    var [block1, block1_encoded, block1_hash] = composeAndSignBlock(1, 1, 0, this.genesis_hash, this.validators, 2, [], []);
    this.block1 = block1;
    this.block1_encoded = block1_encoded;
    this.block1_hash = block1_hash;

    this.lib = await HeaderReader.new();
    Subnet.link("HeaderReader", this.lib.address);
    this.subnet = await Subnet.new(
      this.validators_addr,
      2,
      this.genesis_encoded,
      this.block1_encoded,
      5,
      10,
      {"from": accounts[0]}
    );
    this.decoder = await forContractInstance(this.subnet);
  })

  it("Running Setup", async() => {
    const is_master = await this.subnet.isMaster(accounts[0]);
    const validators = await this.subnet.getCurrentValidators();
    assert.equal(is_master, true);
    assert.deepEqual(validators[0], this.validators_addr);
    assert.equal(validators[2], 2);
  });

  it("Add Master", async() => {
    await this.subnet.addMaster(accounts[1]);
    var is_master = await this.subnet.isMaster(accounts[1]);
    assert.equal(is_master, true);
    await this.subnet.removeMaster(accounts[1]);
    is_master = await this.subnet.isMaster(accounts[1]);
    assert.equal(is_master, false);
  });

  it("Receive New Header", async() => {

    var [block2, block2_encoded, block2_hash] = composeAndSignBlock(2, 2, 1, this.block1_hash, this.validators, 2, [], []);

    await this.subnet.receiveHeader([block2_encoded]);

    const block2_resp = await this.subnet.getHeader(block2_hash);
    const block2_decoded = RLP.decode(block2_resp);
    const block2_extra = RLP.decode(block2_decoded[12].slice(1));
    assert.equal("0x"+Buffer.from(block2_decoded[0]).toString("hex"), this.block1_hash);
    assert.equal(block2_extra[0][0], 2);
    assert.equal("0x"+Buffer.from(block2_extra[1][0][0]).toString("hex"), this.block1_hash);
    assert.equal(block2_extra[1][0][1][0], 1);
    assert.equal(block2_extra[1][0][2][0], 1);
    const finalized = await this.subnet.getHeaderConfirmationStatus(block2_hash);
    const mainnet_num = await this.subnet.getMainnetBlockNumber(block2_hash);
    const latest_blocks = await this.subnet.getLatestBlocks();
    assert.equal(finalized, false);
    assert.equal(latest_blocks["0"][0], block2_hash);
    assert.equal(latest_blocks["1"][0], this.block1_hash);

    const block2_resp2 = await this.subnet.getHeaderByNumber(2);
    assert.equal(block2_resp2[0], block2_hash);
    assert.equal(block2_resp2[1], 2);
  });

  it("Confirm A Received Block", async() => {
    
    var [block2, block2_encoded, block2_hash] = composeAndSignBlock(2, 2, 1, this.block1_hash, this.validators, 2, [], []);
    var [block3, block3_encoded, block3_hash] = composeAndSignBlock(3, 3, 2, block2_hash, this.validators, 2, [], []);
    var [block4, block4_encoded, block4_hash] = composeAndSignBlock(4, 4, 3, block3_hash, this.validators, 2, [], []);
    var [block5, block5_encoded, block5_hash] = composeAndSignBlock(5, 5, 4, block4_hash, this.validators, 2, [], []);

    await this.subnet.receiveHeader([block2_encoded, block3_encoded]); 
    await this.subnet.receiveHeader([block4_encoded, block5_encoded]);

    const block2_resp = await this.subnet.getHeader(block2_hash);
    const block2_decoded = RLP.decode(block2_resp);
    const block2_extra = RLP.decode(block2_decoded[12].slice(1));
    assert.equal("0x"+Buffer.from(block2_decoded[0]).toString("hex"), this.block1_hash);
    assert.equal(block2_extra[0][0], 2);
    assert.equal("0x"+Buffer.from(block2_extra[1][0][0]).toString("hex"), this.block1_hash);
    assert.equal(block2_extra[1][0][1][0], 1);
    assert.equal(block2_extra[1][0][2][0], 1);

    const finalized = await this.subnet.getHeaderConfirmationStatus(block2_hash);
    const mainnet_num = await this.subnet.getMainnetBlockNumber(block2_hash);
    const latest_blocks = await this.subnet.getLatestBlocks();
    assert.equal(finalized, true);
    assert.equal(latest_blocks["0"][0], block5_hash);
    assert.equal(latest_blocks["1"][0], block2_hash);

    const block2_resp2 = await this.subnet.getHeaderByNumber(2);
    assert.equal(block2_resp2[0], block2_hash);
    assert.equal(block2_resp2[1], 2);

    const block3_resp = await this.subnet.getHeaderByNumber(3);
    assert.equal(block3_resp[0], block3_hash);
    assert.equal(block3_resp[1], 3);
  });

  it("Switch a Validator Set", async() => {
    
    var [block2, block2_encoded, block2_hash] = composeAndSignBlock(2, 2, 1, this.block1_hash, this.validators, 2, [], []);
    var [block3, block3_encoded, block3_hash] = composeAndSignBlock(3, 3, 2, block2_hash, this.validators, 2, [], []);
    var [block4, block4_encoded, block4_hash] = composeAndSignBlock(4, 4, 3, block3_hash, this.validators, 2, [], []);
    var [block5, block5_encoded, block5_hash] = composeAndSignBlock(5, 5, 4, block4_hash, this.validators, 2, [], []);
    let new_validators = createValidators(3);
    var [block6, block6_encoded, block6_hash] = composeAndSignBlock(6, 6, 5, block5_hash, this.validators, 2, [], new_validators.map((val) => val.address));
    var [block7, block7_encoded, block7_hash] = composeAndSignBlock(7, 7, 6, block6_hash, this.validators, 2, [], []);
    var [block8, block8_encoded, block8_hash] = composeAndSignBlock(8, 8, 7, block7_hash, this.validators, 2, [], []);
    var [block9, block9_encoded, block9_hash] = composeAndSignBlock(9, 9, 8, block8_hash, this.validators, 2, [], []);
    var [block10, block10_encoded, block10_hash] = composeAndSignBlock(10, 10, 9, block9_hash, new_validators, 2, new_validators.map((val) => val.address), []);

    await this.subnet.receiveHeader([block2_encoded, block3_encoded, block4_encoded]); 
    await this.subnet.receiveHeader([block5_encoded, block6_encoded, block7_encoded]);
    await this.subnet.receiveHeader([block8_encoded, block9_encoded, block10_encoded]);

    const block7_resp = await this.subnet.getHeader(block7_hash);
    const block7_decoded = RLP.decode(block7_resp);
    const block7_extra = RLP.decode(block7_decoded[12].slice(1));
    assert.equal("0x"+Buffer.from(block7_decoded[0]).toString("hex"), block6_hash);
    assert.equal(block7_extra[0][0], 7);
    assert.equal("0x"+Buffer.from(block7_extra[1][0][0]).toString("hex"), block6_hash);
    assert.equal(block7_extra[1][0][1][0], 6);
    assert.equal(block7_extra[1][0][2][0], 6);

    const finalized = await this.subnet.getHeaderConfirmationStatus(block7_hash);
    const latest_blocks = await this.subnet.getLatestBlocks();
    assert.equal(finalized, true);
    assert.equal(latest_blocks["0"][0], block10_hash);
    assert.equal(latest_blocks["1"][0], block7_hash);

    const block7_resp2 = await this.subnet.getHeaderByNumber(7);
    assert.equal(block7_resp2[0], block7_hash);
    assert.equal(block7_resp2[1], 7);

    const block8_resp = await this.subnet.getHeaderByNumber(8);
    assert.equal(block8_resp[0], block8_hash);
    assert.equal(block8_resp[1], 8);
  });

  it("Switch a Validator Set in Special Case", async() => {
    
    var [block2, block2_encoded, block2_hash] = composeAndSignBlock(2, 2, 1, this.block1_hash, this.validators, 2, [], []);
    var [block3, block3_encoded, block3_hash] = composeAndSignBlock(3, 3, 2, block2_hash, this.validators, 2, [], []);
    var [block4, block4_encoded, block4_hash] = composeAndSignBlock(4, 4, 3, block3_hash, this.validators, 2, [], []);
    var [block5, block5_encoded, block5_hash] = composeAndSignBlock(5, 5, 4, block4_hash, this.validators, 2, [], []);
    let new_validators = createValidators(3);
    var [block6, block6_encoded, block6_hash] = composeAndSignBlock(6, 9, 5, block5_hash, this.validators, 2, [], new_validators.map((val) => val.address));
    var [block7, block7_encoded, block7_hash] = composeAndSignBlock(7, 10, 9, block6_hash, this.validators, 2, this.validators.map((val) => val.address), []);

    await this.subnet.receiveHeader([block2_encoded, block3_encoded, block4_encoded]); 
    await this.subnet.receiveHeader([block5_encoded, block6_encoded, block7_encoded]);

    const latest_blocks = await this.subnet.getLatestBlocks();
    assert.equal(latest_blocks["0"][0], block7_hash);
    assert.equal(latest_blocks["1"][0], block2_hash);

    const block5_resp = await this.subnet.getHeaderByNumber(5);
    assert.equal(block5_resp[0], block5_hash);
    assert.equal(block5_resp[1], 5);

    const block2_resp = await this.subnet.getHeaderByNumber(2);
    assert.equal(block2_resp[0], block2_hash);
    assert.equal(block2_resp[1], 2);
  });


  // it("Create an Epoch Switch with Lots of Validators", async() => {
  //   const new_validators = [];
  //   for(let i = 0; i < 21; i++) {
  //     new_validators.push(web3.eth.accounts.create());
  //   }

  //   var [block2, block2_encoded, block2_hash] = composeAndSignBlock(2, 2, this.block1_hash, this.validators, 2, [], []);
  //   var [block3, block3_encoded, block3_hash] = composeAndSignBlock(3, 3, block2_hash, this.validators, 2, [], []);
  //   var [block4, block4_encoded, block4_hash] = composeAndSignBlock(4, 4, block3_hash, this.validators, 2, [], new_validators.map((x) => x.address));
  //   var [block5, block5_encoded, block5_hash] = composeAndSignBlock(5, 5, block4_hash, new_validators, 14, new_validators.map((x) => x.address), []);

  //   await this.subnet.receiveHeader(block2_encoded); 
  //   await this.subnet.receiveHeader(block3_encoded);
  //   await this.subnet.receiveHeader(block4_encoded);
  //   await this.subnet.receiveHeader(block5_encoded);

    
  //   const block2_resp = await this.subnet.getHeader(block2_hash);
  //   const block2_decoded = RLP.decode(block2_resp);
  //   const block2_extra = RLP.decode(block2_decoded[12].slice(1));
  //   assert.equal("0x"+Buffer.from(block2_decoded[0]).toString("hex"), this.block1_hash);
  //   assert.equal(block2_extra[0][0], 2);
  //   assert.equal("0x"+Buffer.from(block2_extra[1][0][0]).toString("hex"), this.block1_hash);
  //   assert.equal(block2_extra[1][0][1][0], 1);
  //   assert.equal(block2_extra[1][0][2][0], 1);

  //   const finalized = await this.subnet.getHeaderConfirmationStatus(block2_hash);
  //   const mainnet_num = await this.subnet.getMainnetBlockNumber(block2_hash);
  //   const latest_block = await this.subnet.getLatestBlock();
  //   assert.equal(finalized, true);
  //   assert.equal(latest_block[0], block2_hash);
  // });

  // it("Lookup the transaction", async() => {
  //   const raw_sigs = [];
  //   const block1 = {
  //     "number": 1,
  //     "round_num": 0,
  //     "parent_hash": this.genesis_hash,
  //   };
  //   const block1_hash = web3.utils.sha3(Buffer.from(
  //     RLP.encode([
  //       util.bigIntToUnpaddedBuffer(1),
  //       util.bigIntToUnpaddedBuffer(0),
  //       util.toBuffer(this.genesis_hash)
  //   ])));
  //   for (let i = 0; i < 3; i++) {
  //     raw_sigs.push(
  //       secp256k1.ecdsaSign(
  //         hex2Arr(block1_hash.substring(2)),
  //         hex2Arr(this.validators[i].privateKey.substring(2))
  //     ));
  //   }

  //   const sigs = raw_sigs.map(x => {
  //     var res = new Uint8Array(65);
  //     res.set(x.signature, 0);
  //     res.set([x.recid], 64);
  //     return "0x"+Buffer.from(res).toString("hex");
  //   });

  //   await this.subnet.receiveHeader(block1, sigs);
  //   const mainnet_num = await this.subnet.getMainnetBlockNumber(block1_hash);
  //   const transactionCount = await web3.eth.getBlockTransactionCount(mainnet_num);
  //   for (let i = 0; i < transactionCount; i++) {
  //     let transaction = await web3.eth.getTransactionFromBlock(mainnet_num, i);
  //     let decodeData = await this.decoder.decodeTransaction(transaction);
  //     let block_hash = web3.utils.sha3(Buffer.from(
  //       RLP.encode([
  //         util.bigIntToUnpaddedBuffer(decodeData.arguments[0].value.value[0].value.value.asBN),
  //         util.bigIntToUnpaddedBuffer(decodeData.arguments[0].value.value[1].value.value.asBN),
  //         util.toBuffer(decodeData.arguments[0].value.value[2].value.value.asHex)
  //     ])));
  //     console.log(block_hash);
  //   }
  // });
})