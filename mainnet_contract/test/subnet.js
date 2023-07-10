const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const secp256k1 = require("secp256k1");
const RLP = require("rlp");
const util = require("@ethereumjs/util");
const hex2Arr = (hexString) => {
  if (hexString.length % 2 !== 0) {
    throw "Must have an even number of hex digits to convert to bytes";
  }
  var numBytes = hexString.length / 2;
  var byteArray = new Uint8Array(numBytes);
  for (var i = 0; i < numBytes; i++) {
    byteArray[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return byteArray;
};
function blockToHash(blockEncoded) {
  return ethers.utils
    .keccak256(Buffer.from(hex2Arr(blockEncoded.slice(2))))
    .toString("hex");
}
const hash = (block) => {
  return ethers.utils.keccak256(block);
};

const encoded = (block) => {
  return "0x" + block.toString("hex");
};
const getGenesis = (validators) => {
  const voteForSignHash = ethers.utils.keccak256(
    Buffer.from(
      RLP.encode([
        [
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
        ],
        0,
      ])
    )
  );
  const version = new Uint8Array([2]);
  const sigs = getSigs(voteForSignHash, validators, 3);
  return Buffer.from(
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
      new Uint8Array([
        ...version,
        ...RLP.encode([
          0,
          [
            [
              "0x0000000000000000000000000000000000000000000000000000000000000000",
              0,
              0,
            ],
            sigs,
            0,
          ],
        ]),
      ]),
      util.zeros(32),
      new Uint8Array(8),
      new Uint8Array(8),
      [],
      [],
      [],
    ])
  );
};

const getSigs = (voteForSignHash, validators, sigNum) => {
  const rawSigs = [];
  for (let i = 0; i < sigNum; i++) {
    rawSigs.push(
      secp256k1.ecdsaSign(
        hex2Arr(voteForSignHash.substring(2)),
        hex2Arr(validators[i].privateKey.substring(2))
      )
    );
  }

  const sigs = rawSigs.map((x) => {
    var res = new Uint8Array(65);
    res.set(x.signature, 0);
    res.set([x.recid], 64);
    return "0x" + Buffer.from(res).toString("hex");
  });

  return sigs;
};

const composeAndSignBlock = (
  number,
  round_num,
  prn,
  parent_hash,
  validators,
  threshold,
  current,
  next,
  penalties = []
) => {
  const version = new Uint8Array([2]);
  const voteForSignHash = ethers.utils.keccak256(
    Buffer.from(RLP.encode([[parent_hash, prn, number - 1], 0]))
  );

  const sigs = getSigs(voteForSignHash, validators, threshold);

  var block = {
    parentHash: parent_hash,
    uncleHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    coinbase:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    root: "0x0000000000000000000000000000000000000000000000000000000000000000",
    txHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    receiptAddress:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    bloom: new Uint8Array(256),
    difficulty: 0,
    number: number,
    gasLimit: 0,
    gasUsed: 0,
    time: 0,
    extra: new Uint8Array([
      ...version,
      ...RLP.encode([round_num, [[parent_hash, prn, number - 1], sigs, 0]]),
    ]),
    mixHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    nonce: new Uint8Array(8),
    validator: new Uint8Array(8),
    validators: current,
    nextValidators: next,
    penalties: penalties,
  };

  var blockBuffer = Buffer.from(
    RLP.encode([
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
      new Uint8Array([
        ...version,
        ...RLP.encode([round_num, [[parent_hash, prn, number - 1], sigs, 0]]),
      ]),
      util.zeros(32),
      new Uint8Array(8),
      new Uint8Array(8),
      current,
      next,
      penalties,
    ])
  );

  return [block, encoded(blockBuffer), hash(blockBuffer)];
};
function createValidators(num) {
  const validators = [];
  for (let i = 0; i < num; i++) {
    validators.push(ethers.Wallet.createRandom());
  }
  return validators;
}
describe("Subnet", () => {
  let subnet;
  let custom;
  let customValidators;
  let customBlock0;
  let customeBlock1;

  const fixture = async () => {
    const headerReaderFactory = await ethers.getContractFactory("HeaderReader");

    const headerReader = await headerReaderFactory.deploy();

    const factory = await ethers.getContractFactory("Subnet", {
      libraries: {
        HeaderReader: headerReader.address,
      },
    });
    const subnet = await factory.deploy(
      [
        "0x888c073313b36cf03CF1f739f39443551Ff12bbE",
        "0x5058dfE24Ef6b537b5bC47116A45F0428DA182fA",
        "0xefEA93e384a6ccAaf28E33790a2D1b2625BF964d",
      ],
      "0xf90296a00000000000000000000000000000000000000000000000000000000000000000a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347940000000000000000000000000000000000000000a017df135a4fad193293e2d89501be8a53ae7622310bba56b80b7e57b7580ceb99a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b901000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001808347b7608084645213d3b89d00000000000000000000000000000000000000000000000000000000000000005058dfe24ef6b537b5bc47116a45f0428da182fa888c073313b36cf03cf1f739f39443551ff12bbeefea93e384a6ccaaf28e33790a2d1b2625bf964d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000088000000000000000080c0c080",
      "0xf902e7a082c3605bed0c24cf03a45bb146d88e62a67742c122e85686455e2282f2796125a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794888c073313b36cf03cf1f739f39443551ff12bbea0c1dc283417f209d60a1b4a884d4da715781817b5a83a9c642a3e3ef9901a0f38a01b638e0cd65c922db5a78f927aea590dc2f05bfd4f87009396d27030c6a4d029a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000101841908b100826308846468da3caa02e801e6e3a082c3605bed0c24cf03a45bb146d88e62a67742c122e85686455e2282f27961258080c080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8412c0644873d33a0045348ba247d083dbf22ae86cd35403ac6f0cdd3bcf2c71a2a3ba9799b991bf5e1eab2351809e7fc3b4ad54650bc7fcda9c3f5422c11914a8700f83f945058dfe24ef6b537b5bc47116a45f0428da182fa94888c073313b36cf03cf1f739f39443551ff12bbe94efea93e384a6ccaaf28e33790a2d1b2625bf964df83f945058dfe24ef6b537b5bc47116a45f0428da182fa94888c073313b36cf03cf1f739f39443551ff12bbe94efea93e384a6ccaaf28e33790a2d1b2625bf964d80",
      450,
      900
    );
    const customValidators = createValidators(3);
    const block0 = getGenesis(customValidators);
    const block0Hash = hash(block0);
    const block0Encoded = encoded(block0);
    const [block1, block1Encoded, block1Hash] = composeAndSignBlock(
      1,
      1,
      0,
      block0Hash,
      customValidators,
      2,
      [],
      []
    );

    const custom = await factory.deploy(
      customValidators.map((item) => {
        return item.address;
      }),
      block0Encoded,
      block1Encoded,
      5,
      10
    );
    const customBlock0 = { hash: block0Hash, encoded: block0Encoded };
    const customeBlock1 = { hash: block1Hash, encoded: block1Encoded };
    const result = {
      subnet,
      custom,
      customValidators,
      customBlock0,
      customeBlock1,
    };
    return result;
  };

  beforeEach("deploy fixture", async () => {
    ({ subnet, custom, customValidators, customBlock0, customeBlock1 } =
      await loadFixture(fixture));
  });

  describe("test xdc subnet real block data", () => {
    it("receive new header", async () => {
      const block2Encoded =
        "0xf902f1a085227fb9e3a00b798fd6cda94283f19bdd6dd7e21e185f46fcfe54b4d58bde36a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347945058dfe24ef6b537b5bc47116a45f0428da182faa0cca91743ca785143edd39702cabf95808a25ff37600a324e7439167caf7287a2a0f3a8c013ff3ff60a7aed3bb0ec8d225914988c48186fe0483378cb36acc8e2d3a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000102841908b100826308846468da59b8b302f8b003f8ade3a085227fb9e3a00b798fd6cda94283f19bdd6dd7e21e185f46fcfe54b4d58bde360101f886b841d222768d52b2ca1cf816d305ee186110bd65c988709cc2c07a3d394ce89ccf1f52368c9a9baf20a5331cd2fd6d995975fd281972b1b66773190e2e3169ddc2ff00b841c07e4dfa759a3ad52a2ee29c8cb33141091d82f508d25945e58372b0aad744e16d0b222dbedfb1cdc96a61cf1e131505987b384e22e96b1b92591a5a5c60d9110080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8418e92522c099709c138e82a15ecfeaacfd5cf87320c8547d94d83b94e4805a9605c12f8fc034b0c8f7e9378449092a01e34bf3c7971a0d5bde79c8c84f17a012301c0c080";
      await subnet.receiveHeader([block2Encoded]);

      const block2Hash = blockToHash(block2Encoded);
      const block2Resp = await subnet.getHeader(block2Hash);
      const latestBlocks = await subnet.getLatestBlocks();

      expect(block2Resp[4]).to.eq(false);

      expect(latestBlocks[0][0]).to.eq(block2Hash);
    });

    it("confirm a received block", async () => {
      const block2Encoded =
        "0xf902f1a085227fb9e3a00b798fd6cda94283f19bdd6dd7e21e185f46fcfe54b4d58bde36a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347945058dfe24ef6b537b5bc47116a45f0428da182faa0cca91743ca785143edd39702cabf95808a25ff37600a324e7439167caf7287a2a0f3a8c013ff3ff60a7aed3bb0ec8d225914988c48186fe0483378cb36acc8e2d3a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000102841908b100826308846468da59b8b302f8b003f8ade3a085227fb9e3a00b798fd6cda94283f19bdd6dd7e21e185f46fcfe54b4d58bde360101f886b841d222768d52b2ca1cf816d305ee186110bd65c988709cc2c07a3d394ce89ccf1f52368c9a9baf20a5331cd2fd6d995975fd281972b1b66773190e2e3169ddc2ff00b841c07e4dfa759a3ad52a2ee29c8cb33141091d82f508d25945e58372b0aad744e16d0b222dbedfb1cdc96a61cf1e131505987b384e22e96b1b92591a5a5c60d9110080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8418e92522c099709c138e82a15ecfeaacfd5cf87320c8547d94d83b94e4805a9605c12f8fc034b0c8f7e9378449092a01e34bf3c7971a0d5bde79c8c84f17a012301c0c080";

      const block3Encoded =
        "0xf902f1a095795dc5e9f62d3f657f90dd6ffabb89e93128ef4aaed19849eeb45205b4fb2ba01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794888c073313b36cf03cf1f739f39443551ff12bbea030609afbddf08ebdbd1450906274a33da2cb88a70029f60e78ab0c21def2f6f3a0a2c325b45af02d9f98d1aee11c139669bb723045ad41d3995a92af20427e5299a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000103841908b100826308846468da5bb8b302f8b004f8ade3a095795dc5e9f62d3f657f90dd6ffabb89e93128ef4aaed19849eeb45205b4fb2b0302f886b841fcd4e17caa809f5cc588768864890f5e1d198aa2ce1a05c4fb1c7c9dae49eca0057d5e005103b9e96e8baf8e00c33a7d063545e1ba4dcf3f6165df006333aac100b841f9a849f53322dcbf89488230cd593d5d2124bc223bbf3f5b64eff38343167a5d3a7391f99b1eeb238575b340de167b314b0c60b81d26c3febe08d83481d84e6a0180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841283c260fbe0220d0cbf26178aa2e507e4aad1df828c82adedc460049f07a50f4226d22f135e4bc208d8dd1caa2f3940956dd535c3db861aa9f2728e20d1b2ccb00c0c080";
      const block4Encoded =
        "0xf902f1a0f1c9e9bd8b4f5e793733167df0c3b7ac52656ab543ac8cd666131e5bdb651846a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794efea93e384a6ccaaf28e33790a2d1b2625bf964da0fe1a63690c559715c07b81223c0b4d7d3b3220d38fa14047aebf28180bc04209a033357dbb31a3c341e4d110f2ea27b623cceec86a37461a77612672e1f40b0f58a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000104841908b100826308846468da5db8b302f8b005f8ade3a0f1c9e9bd8b4f5e793733167df0c3b7ac52656ab543ac8cd666131e5bdb6518460403f886b84197afb91f7f2145f5b866b318ee63a8d450f69c46a045d8b20d6968c7cd52aa6f1bfa7d057812f5790a544e7ca927b085f3cbe2ff617eee3767a90d8f4e804ad600b8418f7c50bbb57f9007137d44513ae8c62a90584649f648813718c7450d50b516311c00e611efda6423f1087087b4964adc51f7c78d1d24db4c24ff485b8e1024960080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b84160fa3df9703387edf44cf018d7e4143b7854730183a402cfccbba50d7c84bcf95c533e3a8f65422e4861e66d058b9737c302adeeb638d9fd3a5b8ea04e2b379900c0c080";
      const block5Encoded =
        "0xf902f1a09c62abed78406019919f8fb4e6f3483360b51731bc65205228a8ef1028d2e2bca01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347945058dfe24ef6b537b5bc47116a45f0428da182faa049d7772889dc41ff7462e8debceaa9631ba0af03bb37b9dbb89b85aacd5f14f7a05f88f2029276d4d44d919b7ed90a07dbf203351a1829a964f4709ee6d8d5c5cca037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000105841908b100826308846468da5fb8b302f8b006f8ade3a09c62abed78406019919f8fb4e6f3483360b51731bc65205228a8ef1028d2e2bc0504f886b841f3afc25d63d810060231f56a90987993f96d20e029270275d0d9f9929b7fcf4a303c2b8252acfd22c702a4d58c05a67f59f8143b013c82fae996f95b1cf6e5c001b841a15d5b6190f688c478bff2cf7166da15180f50429ff15fcd49128ff319a804ca126c65d24e878b33ad1616e889274a75332b3353e872c087502f42184bef16330180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8412427ba43895149aafd4085c3ff93df6c798b617c60ee312bc9c6fad4bca03c49600a80994cf9710c9fad706f807c4568dffc45e3059c4501863d4ffec452c43601c0c080";

      await subnet.receiveHeader([block2Encoded, block3Encoded]);
      await subnet.receiveHeader([block4Encoded, block5Encoded]);

      const block2Hash = blockToHash(block2Encoded);
      const block5Hash = blockToHash(block5Encoded);

      const block2Resp = await subnet.getHeader(block2Hash);
      const latestBlocks = await subnet.getLatestBlocks();

      expect(block2Resp[4]).to.eq(true);
      expect(latestBlocks[0][0]).to.eq(block5Hash);
      expect(latestBlocks[1][0]).to.eq(block2Hash);
    });
    it("mainnet num submit", async () => {
      const block2Encoded =
        "0xf902f1a085227fb9e3a00b798fd6cda94283f19bdd6dd7e21e185f46fcfe54b4d58bde36a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347945058dfe24ef6b537b5bc47116a45f0428da182faa0cca91743ca785143edd39702cabf95808a25ff37600a324e7439167caf7287a2a0f3a8c013ff3ff60a7aed3bb0ec8d225914988c48186fe0483378cb36acc8e2d3a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000102841908b100826308846468da59b8b302f8b003f8ade3a085227fb9e3a00b798fd6cda94283f19bdd6dd7e21e185f46fcfe54b4d58bde360101f886b841d222768d52b2ca1cf816d305ee186110bd65c988709cc2c07a3d394ce89ccf1f52368c9a9baf20a5331cd2fd6d995975fd281972b1b66773190e2e3169ddc2ff00b841c07e4dfa759a3ad52a2ee29c8cb33141091d82f508d25945e58372b0aad744e16d0b222dbedfb1cdc96a61cf1e131505987b384e22e96b1b92591a5a5c60d9110080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8418e92522c099709c138e82a15ecfeaacfd5cf87320c8547d94d83b94e4805a9605c12f8fc034b0c8f7e9378449092a01e34bf3c7971a0d5bde79c8c84f17a012301c0c080";

      const block3Encoded =
        "0xf902f1a095795dc5e9f62d3f657f90dd6ffabb89e93128ef4aaed19849eeb45205b4fb2ba01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794888c073313b36cf03cf1f739f39443551ff12bbea030609afbddf08ebdbd1450906274a33da2cb88a70029f60e78ab0c21def2f6f3a0a2c325b45af02d9f98d1aee11c139669bb723045ad41d3995a92af20427e5299a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000103841908b100826308846468da5bb8b302f8b004f8ade3a095795dc5e9f62d3f657f90dd6ffabb89e93128ef4aaed19849eeb45205b4fb2b0302f886b841fcd4e17caa809f5cc588768864890f5e1d198aa2ce1a05c4fb1c7c9dae49eca0057d5e005103b9e96e8baf8e00c33a7d063545e1ba4dcf3f6165df006333aac100b841f9a849f53322dcbf89488230cd593d5d2124bc223bbf3f5b64eff38343167a5d3a7391f99b1eeb238575b340de167b314b0c60b81d26c3febe08d83481d84e6a0180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841283c260fbe0220d0cbf26178aa2e507e4aad1df828c82adedc460049f07a50f4226d22f135e4bc208d8dd1caa2f3940956dd535c3db861aa9f2728e20d1b2ccb00c0c080";
      const block4Encoded =
        "0xf902f1a0f1c9e9bd8b4f5e793733167df0c3b7ac52656ab543ac8cd666131e5bdb651846a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794efea93e384a6ccaaf28e33790a2d1b2625bf964da0fe1a63690c559715c07b81223c0b4d7d3b3220d38fa14047aebf28180bc04209a033357dbb31a3c341e4d110f2ea27b623cceec86a37461a77612672e1f40b0f58a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000104841908b100826308846468da5db8b302f8b005f8ade3a0f1c9e9bd8b4f5e793733167df0c3b7ac52656ab543ac8cd666131e5bdb6518460403f886b84197afb91f7f2145f5b866b318ee63a8d450f69c46a045d8b20d6968c7cd52aa6f1bfa7d057812f5790a544e7ca927b085f3cbe2ff617eee3767a90d8f4e804ad600b8418f7c50bbb57f9007137d44513ae8c62a90584649f648813718c7450d50b516311c00e611efda6423f1087087b4964adc51f7c78d1d24db4c24ff485b8e1024960080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b84160fa3df9703387edf44cf018d7e4143b7854730183a402cfccbba50d7c84bcf95c533e3a8f65422e4861e66d058b9737c302adeeb638d9fd3a5b8ea04e2b379900c0c080";
      const block5Encoded =
        "0xf902f1a09c62abed78406019919f8fb4e6f3483360b51731bc65205228a8ef1028d2e2bca01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347945058dfe24ef6b537b5bc47116a45f0428da182faa049d7772889dc41ff7462e8debceaa9631ba0af03bb37b9dbb89b85aacd5f14f7a05f88f2029276d4d44d919b7ed90a07dbf203351a1829a964f4709ee6d8d5c5cca037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000105841908b100826308846468da5fb8b302f8b006f8ade3a09c62abed78406019919f8fb4e6f3483360b51731bc65205228a8ef1028d2e2bc0504f886b841f3afc25d63d810060231f56a90987993f96d20e029270275d0d9f9929b7fcf4a303c2b8252acfd22c702a4d58c05a67f59f8143b013c82fae996f95b1cf6e5c001b841a15d5b6190f688c478bff2cf7166da15180f50429ff15fcd49128ff319a804ca126c65d24e878b33ad1616e889274a75332b3353e872c087502f42184bef16330180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8412427ba43895149aafd4085c3ff93df6c798b617c60ee312bc9c6fad4bca03c49600a80994cf9710c9fad706f807c4568dffc45e3059c4501863d4ffec452c43601c0c080";

      await subnet.receiveHeader([block2Encoded, block3Encoded]);
      await subnet.receiveHeader([block4Encoded, block5Encoded]);

      const block2Hash = blockToHash(block2Encoded);
      const block3Hash = blockToHash(block3Encoded);
      const block2Resp = await subnet.getHeader(block2Hash);
   
      expect(block2Resp[1]).to.eq(2);
      expect(block2Resp[2]).to.eq(3);
      expect(block2Resp[3]).to.not.eq(-1);
      expect(block2Resp[4]).to.eq(true);
      const block3Resp = await subnet.getHeader(block3Hash);
      expect(block3Resp[3]).to.eq(-1);
    });
  });

  describe("test custom block data", () => {
    it("receive new header", async () => {
      const [block2, block2Encoded, block2Hash] = composeAndSignBlock(
        2,
        2,
        1,
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        []
      );
      await custom.receiveHeader([block2Encoded]);

      const block2Resp = await custom.getHeader(block2Hash);
      const latestBlocks = await custom.getLatestBlocks();

      expect(block2Resp[4]).to.eq(false);

      expect(latestBlocks[0][0]).to.eq(block2Hash);
    });
    it("confirm a received block", async () => {
      const [block2, block2Encoded, block2Hash] = composeAndSignBlock(
        2,
        2,
        1,
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        []
      );
      const [block3, block3Encoded, block3Hash] = composeAndSignBlock(
        3,
        3,
        2,
        block2Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block4, block4Encoded, block4Hash] = composeAndSignBlock(
        4,
        4,
        3,
        block3Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block5, block5Encoded, block5Hash] = composeAndSignBlock(
        5,
        5,
        4,
        block4Hash,
        customValidators,
        2,
        [],
        []
      );
      await custom.receiveHeader([block2Encoded, block3Encoded]);
      await custom.receiveHeader([block4Encoded, block5Encoded]);

      const block2Resp = await custom.getHeader(block2Hash);
      const latestBlocks = await custom.getLatestBlocks();

      expect(block2Resp[4]).to.eq(true);
      expect(latestBlocks[0][0]).to.eq(block5Hash);
      expect(latestBlocks[1][0]).to.eq(block2Hash);
    });
    it("switch a validator set", async () => {
      const [block2, block2Encoded, block2Hash] = composeAndSignBlock(
        2,
        2,
        1,
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        []
      );
      const [block3, block3Encoded, block3Hash] = composeAndSignBlock(
        3,
        3,
        2,
        block2Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block4, block4Encoded, block4Hash] = composeAndSignBlock(
        4,
        4,
        3,
        block3Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block5, block5Encoded, block5Hash] = composeAndSignBlock(
        5,
        5,
        4,
        block4Hash,
        customValidators,
        2,
        [],
        []
      );

      const newValidators = createValidators(3);

      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        6,
        5,
        block5Hash,
        customValidators,
        2,
        [],
        newValidators.map((item) => item.address)
      );
      const [block7, block7Encoded, block7Hash] = composeAndSignBlock(
        7,
        7,
        6,
        block6Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block8, block8Encoded, block8Hash] = composeAndSignBlock(
        8,
        8,
        7,
        block7Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block9, block9Encoded, block9Hash] = composeAndSignBlock(
        9,
        9,
        8,
        block8Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block10, block10Encoded, block10Hash] = composeAndSignBlock(
        10,
        10,
        9,
        block9Hash,
        newValidators,
        2,
        newValidators.map((item) => item.address),
        []
      );
      await custom.receiveHeader([block2Encoded, block3Encoded, block4Encoded]);

      await custom.receiveHeader([block5Encoded, block6Encoded, block7Encoded]);

      await custom.receiveHeader([
        block8Encoded,
        block9Encoded,
        block10Encoded,
      ]);

      const block7Resp = await custom.getHeader(block7Hash);

      expect(block7Resp[0]).to.eq(block6Hash);
      expect(block7Resp[1]).to.eq(7);
      expect(block7Resp[2]).to.eq(7);
      expect(block7Resp[4]).to.eq(true);
      const latestBlocks = await custom.getLatestBlocks();
      expect(latestBlocks[0][0]).to.eq(block10Hash);
      expect(latestBlocks[1][0]).to.eq(block7Hash);

      const blockHeader7Resp = await custom.getHeaderByNumber(7);
      expect(blockHeader7Resp[0]).to.eq(block7Hash);
      expect(blockHeader7Resp[1]).to.eq(7);

      const blockHeader8Resp = await custom.getHeaderByNumber(8);
      expect(blockHeader8Resp[0]).to.eq(block8Hash);
      expect(blockHeader8Resp[1]).to.eq(8);
    });

    it("switch a validator set in special case", async () => {
      const [block2, block2Encoded, block2Hash] = composeAndSignBlock(
        2,
        2,
        1,
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        []
      );
      const [block3, block3Encoded, block3Hash] = composeAndSignBlock(
        3,
        3,
        2,
        block2Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block4, block4Encoded, block4Hash] = composeAndSignBlock(
        4,
        4,
        3,
        block3Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block5, block5Encoded, block5Hash] = composeAndSignBlock(
        5,
        5,
        4,
        block4Hash,
        customValidators,
        2,
        [],
        []
      );

      const newValidators = createValidators(3);
      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        9,
        5,
        block5Hash,
        customValidators,
        2,
        [],
        newValidators.map((item) => item.address)
      );
      const [block7, block7Encoded, block7Hash] = composeAndSignBlock(
        7,
        10,
        9,
        block6Hash,
        customValidators,
        2,
        newValidators.map((item) => item.address),
        []
      );
      await custom.receiveHeader([block2Encoded, block3Encoded, block4Encoded]);
      await custom.receiveHeader([block5Encoded, block6Encoded, block7Encoded]);
      const latestBlocks = await custom.getLatestBlocks();
      expect(latestBlocks[0][0]).to.eq(block7Hash);
      expect(latestBlocks[1][0]).to.eq(block2Hash);

      const block5HeaderResp = await custom.getHeaderByNumber(5);
      expect(block5HeaderResp[0]).to.eq(block5Hash);
      expect(block5HeaderResp[1]).to.eq(5);

      const block2HeaderResp = await custom.getHeaderByNumber(2);
      expect(block2HeaderResp[0]).to.eq(block2Hash);
      expect(block2HeaderResp[1]).to.eq(2);
    });

    it("penalty validity verify", async () => {
      const [block2, block2Encoded, block2Hash] = composeAndSignBlock(
        2,
        2,
        1,
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        []
      );
      const [block3, block3Encoded, block3Hash] = composeAndSignBlock(
        3,
        3,
        2,
        block2Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block4, block4Encoded, block4Hash] = composeAndSignBlock(
        4,
        4,
        3,
        block3Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block5, block5Encoded, block5Hash] = composeAndSignBlock(
        5,
        5,
        4,
        block4Hash,
        customValidators,
        2,
        [],
        []
      );
      const newValidators = createValidators(5);
      const penalties = [newValidators[0], newValidators[1]];
      const actualValidators = [
        newValidators[2],
        newValidators[3],
        newValidators[4],
      ];

      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        6,
        5,
        block5Hash,
        customValidators,
        2,
        [],
        newValidators.map((item) => item.address),
        penalties.map((item) => item.address)
      );
      const [block7, block7Encoded, block7Hash] = composeAndSignBlock(
        7,
        7,
        6,
        block6Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block8, block8Encoded, block8Hash] = composeAndSignBlock(
        8,
        8,
        7,
        block7Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block9, block9Encoded, block9Hash] = composeAndSignBlock(
        9,
        9,
        8,
        block8Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block10, block10Encoded, block10Hash] = composeAndSignBlock(
        10,
        10,
        9,
        block9Hash,
        actualValidators,
        2,
        actualValidators.map((item) => item.address),
        []
      );
      await custom.receiveHeader([block2Encoded, block3Encoded, block4Encoded]);

      await custom.receiveHeader([block5Encoded, block6Encoded, block7Encoded]);

      await custom.receiveHeader([
        block8Encoded,
        block9Encoded,
        block10Encoded,
      ]);
      const currentValidators = await custom.getCurrentValidators();
      expect(currentValidators[0]).to.deep.eq(
        actualValidators.map((item) => item.address)
      );
    });
    it("mainnet num submit", async () => {
      const [block2, block2Encoded, block2Hash] = composeAndSignBlock(
        2,
        2,
        1,
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        []
      );
      const [block3, block3Encoded, block3Hash] = composeAndSignBlock(
        3,
        3,
        2,
        block2Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block4, block4Encoded, block4Hash] = composeAndSignBlock(
        4,
        4,
        3,
        block3Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block5, block5Encoded, block5Hash] = composeAndSignBlock(
        5,
        5,
        4,
        block4Hash,
        customValidators,
        2,
        [],
        []
      );
      await custom.receiveHeader([block2Encoded, block3Encoded]);
      await custom.receiveHeader([block4Encoded, block5Encoded]);

      const block2Resp = await custom.getHeader(block2Hash);
      expect(block2Resp[1]).to.eq(2);
      expect(block2Resp[2]).to.eq(2);
      expect(block2Resp[3]).to.not.eq(-1);
      expect(block2Resp[4]).to.eq(true);
      const block3Resp = await custom.getHeader(block3Hash);
      expect(block3Resp[3]).to.eq(-1);
    });
  });
});
