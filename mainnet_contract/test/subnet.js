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


contract("Subnet test", async accounts => {

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
      "coinbase": "0x0000000000000000000000000000000000000000000000000000000000000000",
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
    
    this.lib = await HeaderReader.new();
    Subnet.link("HeaderReader", this.lib.address);
    this.subnet = await Subnet.new(
      this.validators_addr,
      2,
      this.genesis_encoded,
      {"from": accounts[0]}
    );
    this.decoder = await forContractInstance(this.subnet);
  })

  it("Running setup", async() => {
    const is_master = await this.subnet.isMaster(accounts[0]);
    const validators = await this.subnet.getValidatorSet(0);
    const threshold = await this.subnet.getValidatorThreshold(0);
    assert.equal(is_master, true);
    assert.deepEqual(validators, this.validators_addr);
    assert.equal(threshold, 2);
  });

  it("Add Master", async() => {
    await this.subnet.addMaster(accounts[1]);
    var is_master = await this.subnet.isMaster(accounts[1]);
    assert.equal(is_master, true);
    await this.subnet.removeMaster(accounts[1]);
    is_master = await this.subnet.isMaster(accounts[1]);
    assert.equal(is_master, false);
  });

  it("Revise Validator Set", async() => {
    const new_validators = [];
    for (let i = 0; i < 3; i++) {
      new_validators.push(web3.eth.accounts.create().address);
    }

    await this.subnet.reviseValidatorSet(new_validators, 2, 4, {"from": accounts[0]});
    const validators = await this.subnet.getValidatorSet(4);
    const threshold = await this.subnet.getValidatorThreshold(4);
    assert.deepEqual(validators, new_validators);
    assert.equal(threshold, 2);
  });

  it("Receive New Header", async() => {
    const new_validators = [];
    const raw_sigs = [];
    for (let i = 0; i < 3; i++) {
      new_validators.push(web3.eth.accounts.create());
    }

    const version = new Uint8Array([2]);
    const voteForSignHash = web3.utils.sha3(Buffer.from(
      RLP.encode([
        [this.genesis_hash, 1, 1],
        0
      ])
    ));

    for (let i = 0; i < 2; i++) {
      raw_sigs.push(
        secp256k1.ecdsaSign(
          hex2Arr(voteForSignHash.substring(2)),
          hex2Arr(new_validators[i].privateKey.substring(2))
      ));
    }

    const sigs = raw_sigs.map(x => {
      var res = new Uint8Array(65);
      res.set(x.signature, 0);
      res.set([x.recid], 64);
      return "0x"+Buffer.from(res).toString("hex");
    });

    await this.subnet.reviseValidatorSet(
      new_validators.map(x => x.address),
      2,
      1, {"from": accounts[0]}
    );

    const block1 = {
      "parent_hash": this.genesis_hash,
      "uncle_hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "coinbase": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "root": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "txHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "receiptAddress": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "bloom": new Uint8Array(256),
      "difficulty": 0,
      "number": 1,
      "gasLimit": 0,
      "gasUsed": 0,
      "time": 0,
      "extra": new Uint8Array([...version, ...RLP.encode([
        1,
        [
          [this.genesis_hash, 1, 1],
          sigs,
          0
        ]
      ])]),
      "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "nonce": new Uint8Array(8),
      "validators": new Uint8Array(8),
      "validator": new Uint8Array(8),
      "penalties": new Uint8Array(8)
    };

    const block1_hash = web3.utils.sha3(Buffer.from(
      RLP.encode([
        util.toBuffer(this.genesis_hash),
        util.zeros(32),
        util.zeros(32),
        util.zeros(32),
        util.zeros(32),
        util.zeros(32),
        new Uint8Array(256),
        util.bigIntToUnpaddedBuffer(0),
        util.bigIntToUnpaddedBuffer(1),
        util.bigIntToUnpaddedBuffer(0),
        util.bigIntToUnpaddedBuffer(0),
        util.bigIntToUnpaddedBuffer(0),
        new Uint8Array([...version, ...RLP.encode([
          1,
          [
            [this.genesis_hash, 1, 1],
            sigs,
            0
          ]
        ])]),
        util.zeros(32),
        new Uint8Array(8),
        new Uint8Array(8),
        new Uint8Array(8),
        new Uint8Array(8),
    ]))).toString("hex");

    const block1_encoded = "0x"+Buffer.from(RLP.encode([
      util.toBuffer(this.genesis_hash),
      util.zeros(32),
      util.zeros(32),
      util.zeros(32),
      util.zeros(32),
      util.zeros(32),
      new Uint8Array(256),
      util.bigIntToUnpaddedBuffer(0),
      util.bigIntToUnpaddedBuffer(1),
      util.bigIntToUnpaddedBuffer(0),
      util.bigIntToUnpaddedBuffer(0),
      util.bigIntToUnpaddedBuffer(0),
      new Uint8Array([...version, ...RLP.encode([
        1,
        [
          [this.genesis_hash, 1, 1],
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

    await this.subnet.receiveHeader(block1_encoded);

    const block1_resp = await this.subnet.getHeader(block1_hash);
    const block1_decoded = RLP.decode(block1_resp);
    const block1_extra = RLP.decode(block1_decoded[12].slice(1));
    assert.equal("0x"+Buffer.from(block1_decoded[0]).toString("hex"), this.genesis_hash);
    assert.equal(block1_extra[0][0], 1);
    assert.equal(block1_decoded[8][0], 1);

    const finalized = await this.subnet.getHeaderConfirmationStatus(block1_hash);
    const mainnet_num = await this.subnet.getMainnetBlockNumber(block1_hash);
    const latest_finalized_block = await this.subnet.getLatestFinalizedBlock();
    assert.equal(finalized, false);
    assert.equal(latest_finalized_block, this.genesis_hash);
  });

  it("Confirm A Received Block", async() => {

    const composeAndSignBlock = (number, round_num, parent_hash, validators, threshold) => {

      const version = new Uint8Array([2]);
      const voteForSignHash = web3.utils.sha3(Buffer.from(
        RLP.encode([
          [parent_hash, round_num, number],
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
            [this.genesis_hash, round_num, number],
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
            [this.genesis_hash, round_num, number],
            sigs,
            0
          ]
        ])]),
        util.zeros(32),
        new Uint8Array(8),
        new Uint8Array(8),
        new Uint8Array(8),
        new Uint8Array(8),
      ]));

      var block_hash = web3.utils.sha3(block_encoded).toString("hex");
      return [block, "0x"+block_encoded.toString("hex"), block_hash];
    }
    
    var [block1, block1_encoded, block1_hash] = composeAndSignBlock(1, 1, this.genesis_hash, this.validators, 2);
    var [block2, block2_encoded, block2_hash] = composeAndSignBlock(2, 2, block1_hash, this.validators, 2);
    var [block3, block3_encoded, block3_hash] = composeAndSignBlock(3, 3, block2_hash, this.validators, 2);
    var [block4, block4_encoded, block4_hash] = composeAndSignBlock(4, 4, block3_hash, this.validators, 2);

    await this.subnet.receiveHeader(block1_encoded); 
    await this.subnet.receiveHeader(block2_encoded);
    await this.subnet.receiveHeader(block3_encoded);
    await this.subnet.receiveHeader(block4_encoded);

    const block1_resp = await this.subnet.getHeader(block1_hash);
    const block1_decoded = RLP.decode(block1_resp);
    const block1_extra = RLP.decode(block1_decoded[12].slice(1));
    assert.equal("0x"+Buffer.from(block1_decoded[0]).toString("hex"), this.genesis_hash);
    assert.equal(block1_extra[0][0], 1);
    assert.equal(block1_decoded[8][0], 1);

    const finalized = await this.subnet.getHeaderConfirmationStatus(block1_hash);
    const mainnet_num = await this.subnet.getMainnetBlockNumber(block1_hash);
    const latest_finalized_block = await this.subnet.getLatestFinalizedBlock();
    assert.equal(finalized, true);
    assert.equal(latest_finalized_block, block1_hash);
  });

  it("Confirm A Received Block with Lots of Signatures", async() => {

    const composeAndSignBlock = (number, round_num, parent_hash, validators, threshold) => {

      const version = new Uint8Array([2]);
      const voteForSignHash = web3.utils.sha3(Buffer.from(
        RLP.encode([
          [parent_hash, round_num, number],
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
            [this.genesis_hash, round_num, number],
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
            [this.genesis_hash, round_num, number],
            sigs,
            0
          ]
        ])]),
        util.zeros(32),
        new Uint8Array(8),
        new Uint8Array(8),
        new Uint8Array(8),
        new Uint8Array(8),
      ]));

      var block_hash = web3.utils.sha3(block_encoded).toString("hex");
      return [block, "0x"+block_encoded.toString("hex"), block_hash];
    }
    const new_validators = [];
    for (let i = 0; i < 21; i++) {
      new_validators.push(web3.eth.accounts.create());
    }

    await this.subnet.reviseValidatorSet(new_validators.map(x => x.address), 14, 1, {"from": accounts[0]});

    var [block1, block1_encoded, block1_hash] = composeAndSignBlock(1, 1, this.genesis_hash, new_validators, 14);
    var [block2, block2_encoded, block2_hash] = composeAndSignBlock(2, 2, block1_hash, new_validators, 14);
    var [block3, block3_encoded, block3_hash] = composeAndSignBlock(3, 3, block2_hash, new_validators, 14);
    var [block4, block4_encoded, block4_hash] = composeAndSignBlock(4, 4, block3_hash, new_validators, 14);

    await this.subnet.receiveHeader(block1_encoded); 
    await this.subnet.receiveHeader(block2_encoded);
    await this.subnet.receiveHeader(block3_encoded);
    await this.subnet.receiveHeader(block4_encoded);

    const block1_resp = await this.subnet.getHeader(block1_hash);
    const block1_decoded = RLP.decode(block1_resp);
    const block1_extra = RLP.decode(block1_decoded[12].slice(1));
    assert.equal("0x"+Buffer.from(block1_decoded[0]).toString("hex"), this.genesis_hash);
    assert.equal(block1_extra[0][0], 1);
    assert.equal(block1_decoded[8][0], 1);

    const finalized = await this.subnet.getHeaderConfirmationStatus(block1_hash);
    const mainnet_num = await this.subnet.getMainnetBlockNumber(block1_hash);
    const latest_finalized_block = await this.subnet.getLatestFinalizedBlock();
    assert.equal(finalized, true);
    assert.equal(latest_finalized_block, block1_hash);
  });
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