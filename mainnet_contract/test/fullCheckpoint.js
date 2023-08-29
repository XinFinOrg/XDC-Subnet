const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {
  getGenesis,
  hex2Arr,
  blockToHash,
  hash,
  encoded,
  getSigs,
  composeAndSignBlock,
  createValidators,
} = require("./libraries/utils");

describe("checkpoint", () => {
  const block2Encoded =
    "0xf90379a0684d18e0081cbe82cab66173647eaf2b078413da5f79a1082a5228314c23ae15a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794d23cf44b862ba86703f11f6e94a4a833f4fe2244a03a9114857792f2a10b4d04ded4e29cb2371535ed749a7686aa2e9885c6007e25a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000102841908b100808464d68e41b9013c02f9013804f90134e3a0684d18e0081cbe82cab66173647eaf2b078413da5f79a1082a5228314c23ae150201f9010cb8415b9502064749ae6383ca3db159e581833c4c979e6e9f9e0fcd070c26d342853f5eed92fb1aeb939679c8729b367095e557fe67e319b817aad4a1b81e8ba9332f00b841777e3a0539c8f1153541830fd16b6dc86e342660942b7e27c1f17a1c8535c2ac6158e420fe5365837bb6d65fb56d973e5e9b7cfceaf4820a39629efee242415000b84116042a34235dc29153c2cc05feb2c75a3a2d6521be5913525701beaf3d65636a012487b0f13489d67f4491444ce3739013af905eb422cf0b21f200f8ab03870c01b841860741faafd4f5ce5d612330f86aee3c9eff6aa8af2bb6a565841215c98ebb7a45f9a937de49e57285834fcc8f174164cab8b454625053ce8d6985aaebe3d7bc0180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b84126f7a1c93f2b691484ed935fdecc60bb8b0b146cdb249214a2fae058445d645350a8abfda8d853141e3e1a50037567ea21e2f66229b0f93353b373365b2bc06800c0c0c0";

  const block3Encoded =
    "0xf90379a0042d032a8d2a2e413b7e778f67f63f0314ecce78a56bb8a21e30249ff9048d71a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479410982668af23d3e4b8d26805543618412ac724d4a03a9114857792f2a10b4d04ded4e29cb2371535ed749a7686aa2e9885c6007e25a0aa5c22a6b44642cb26e615b25909c4ce85fa09c6d07be8dd277c16a41913b752a0f1e9711aafd2cc3a654c508ff781ff01ebaf495cc3a80f1ac689b745b2f3c8e7b90100010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000103841908b100808464d68e43b9013c02f9013805f90134e3a0042d032a8d2a2e413b7e778f67f63f0314ecce78a56bb8a21e30249ff9048d710402f9010cb84168483ea8067e3432d01a1ed3e401e4373c87bfbc55f8082cf9f2b3d1f402c681480297e1239f13bc9d619789f59f2fbdb1f48fcae327d746094cfacce4a6bb7601b841b329b2b5ca5750dcc45600a63cf36cb633e1ba932e0273c06cf040f62e18d0604391ef2af450c815b895e06000f4e34dcd13ef299d5dcc6e9db6561c13080a4400b841576e03c4ecc1f124fb41218004de36f818bae7e61b6c40a1deb06bf7aa05e1d87cee514d6c36098cde2c6537fb6c556774a4d382dbdeae37b6c676d5d509e1c200b841f354a8eaa22bfd983cb6669974b7de78e229094e315d095646c970a96e3615021de832730b17fa1833b3032d9c25e1b1887418747a845761cf546bd4ba83d5e20180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841d1570a04d189780140c9c71120b24edef830c1320fd28a928cd31e88e1b2f3a768967615e887f466d78b57a5bbf54a0750be466f2a90e961acf8bc1203166dff01c0c0c0";
  const block4Encoded =
    "0xf90379a0943df401cff04f6f72268e63e1f2737c7bee3347de6175779af3f0247588c3c5a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347946f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b2614a03a9114857792f2a10b4d04ded4e29cb2371535ed749a7686aa2e9885c6007e25a0774ec1306070d707c45375189ea663a3a74c7c2c03a1727606a73bef6ffe43bfa0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab90100010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000104841908b100808464d68e45b9013c02f9013806f90134e3a0943df401cff04f6f72268e63e1f2737c7bee3347de6175779af3f0247588c3c50503f9010cb841af3c37e0578631f766aa0bcb67e451a003da396b1fc10d2b1cadd9f9cd0fe1d2368792de099fed569d6d9623dedde2db871aef9b26f23d0c7419cf57ecfa67f401b84106891a6d4bc73bc4295f9d00b17d62fffbdd34032803c35cc7cbc7eec57b7ca70d236906e9ab55ae61eab0a95a031fc1394c64b06dcdd08be9d298a9c5067f7a00b84166b00fa8f3338824792e82b4e8b31c45f8a0ced6cb163c0399de258b0611173d527558063504fba8745b18dc7179b268afe48f76744cf52bfb4ad78fc9cccd5100b841cb27696ff615ee3b4780bd31db1c67823b8d40389ac4b9e4df7d922f02f712463c4c4f658ae582b3bd8ec8bd1382feabf960353511156aa59fd87da60abc272b0180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b84147a9f90eae46c16b2b34158606284a62d3bee421fadc28d588cde83a203db6d11d0e549bd6f05bb8341789935faebb2310cbb72a923a083e9e20869eba1833ea01c0c0c0";
  const block5Encoded =
    "0xf90379a05c0edc00bb0dae82277c4018f52af29663fdab3ddd8c3a6b5992b5954a2bc347a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479480f489a673042c2e5f17e5b2a5e49d71bf0611a4a03a9114857792f2a10b4d04ded4e29cb2371535ed749a7686aa2e9885c6007e25a0f8decd77dd41d9af5111633085d026e6d51c46c72df707e341e4e429e148471ea0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab90100010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000105841908b100808464d68e47b9013c02f9013807f90134e3a05c0edc00bb0dae82277c4018f52af29663fdab3ddd8c3a6b5992b5954a2bc3470604f9010cb841000d7dc02cf85bd31f296f38cbcac70731da3890fab990918e5d3e6c45ad6666083030dfdbd419ffd285dba33444b4bd8314f2ba790a013379eafca701b2979201b841fbf5be8f55b05e7e25a11c0b9944120bc3493dd8f142423473dc4ad3ead4d45d56c0f58a5cc0762b8e162a66fa571e5a7c91e3161be455d8e3aeebc29657e16901b84122ba8ebd01d3329140b5396168e71d6733656ec3441bf999c0fda45cbe0bd93829a1c24e046ec01953b159389a24762da44f5c50efcef025cf103c4ad024f5d900b841ff2d8e3ff4b02bd745fe260378e435536476f4c48d1934a60cd396c5c12936ed079c0d93d143d1266b0ca9a90ae80f8f424986cde01363bd5305e7dffd653ea90180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8413a919aa9491748d75f986e7a20c298ed7c8928f45ea339bb7e994308714a988e794c7d15a8e6f4f95a244d1a1139b092181ea4863a12238cf96c22c63b6912be00c0c0c0";

  let checkpoint;
  let custom;
  let customValidators;
  let customBlock0;
  let customeBlock1;

  const fixture = async () => {
    const factory = await ethers.getContractFactory("FullCheckpoint");
    const checkpoint = await factory.deploy();
    await checkpoint.init(
      [
        "0x10982668af23d3e4b8d26805543618412ac724d4",
        "0x6f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b2614",
        "0x80f489a673042c2e5f17e5b2a5e49d71bf0611a4",
        "0xb51df3658799cccb48c172d54e3bc89649f04eb4",
        "0xd23cf44b862ba86703f11f6e94a4a833f4fe2244",
      ],
      "0xf902bea00000000000000000000000000000000000000000000000000000000000000000a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347940000000000000000000000000000000000000000a03a9114857792f2a10b4d04ded4e29cb2371535ed749a7686aa2e9885c6007e25a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b901000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001808347b760808464d68a93b8c5000000000000000000000000000000000000000000000000000000000000000010982668af23d3e4b8d26805543618412ac724d46f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b261480f489a673042c2e5f17e5b2a5e49d71bf0611a4b51df3658799cccb48c172d54e3bc89649f04eb4d23cf44b862ba86703f11f6e94a4a833f4fe22440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000088000000000000000080c0c0c0",
      "0xf902cfa0c2e6a789316fe7112553ef911649f2d19380ce6746288b9fa6fc5af8ad16ef2aa01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479480f489a673042c2e5f17e5b2a5e49d71bf0611a4a03a9114857792f2a10b4d04ded4e29cb2371535ed749a7686aa2e9885c6007e25a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000101841908b100808464d68e35aa02e802e6e3a0c2e6a789316fe7112553ef911649f2d19380ce6746288b9fa6fc5af8ad16ef2a8080c080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841160324f07543714bd91d4576bc74a6fe8c0aa706781ed943479a5ee0d9c2ed75174a776ee736030bb0d080947514d83c69ed328c69661409341c317fcacf855b00c0f8699410982668af23d3e4b8d26805543618412ac724d4946f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b26149480f489a673042c2e5f17e5b2a5e49d71bf0611a494b51df3658799cccb48c172d54e3bc89649f04eb494d23cf44b862ba86703f11f6e94a4a833f4fe2244c0",
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

    const custom = await factory.deploy();
    await custom.init(
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

    return {
      checkpoint,
      custom,
      customValidators,
      customBlock0,
      customeBlock1,
    };
  };

  beforeEach("deploy fixture", async () => {
    ({ checkpoint, custom, customValidators, customBlock0, customeBlock1 } =
      await loadFixture(fixture));
  });

  describe("test checkpoint real block data", () => {
    it("receive new header", async () => {
      await checkpoint.receiveHeader([block2Encoded]);

      const block2Hash = blockToHash(block2Encoded);
      const block2Resp = await checkpoint.getHeader(block2Hash);
      const latestBlocks = await checkpoint.getLatestBlocks();

      expect(block2Resp[4]).to.eq(false);

      expect(latestBlocks[0][0]).to.eq(block2Hash);
    });

    it("confirm a received block", async () => {
      await checkpoint.receiveHeader([block2Encoded, block3Encoded]);
      await checkpoint.receiveHeader([block4Encoded, block5Encoded]);

      const block2Hash = blockToHash(block2Encoded);
      const block5Hash = blockToHash(block5Encoded);

      const block2Resp = await checkpoint.getHeader(block2Hash);
      const latestBlocks = await checkpoint.getLatestBlocks();

      expect(block2Resp[4]).to.eq(true);
      expect(latestBlocks[0][0]).to.eq(block5Hash);
      expect(latestBlocks[1][0]).to.eq(block2Hash);
    });
    it("mainnet num submit", async () => {
      await checkpoint.receiveHeader([block2Encoded, block3Encoded]);
      await checkpoint.receiveHeader([block4Encoded, block5Encoded]);

      const block2Hash = blockToHash(block2Encoded);
      const block3Hash = blockToHash(block3Encoded);
      const block2Resp = await checkpoint.getHeader(block2Hash);

      expect(block2Resp[1]).to.eq(2);
      expect(block2Resp[2]).to.eq(4);
      expect(block2Resp[3]).to.not.eq(-1);
      expect(block2Resp[4]).to.eq(true);
      const block3Resp = await checkpoint.getHeader(block3Hash);
      expect(block3Resp[3]).to.eq(-1);
    });
  });

  describe("test checkpoint custom block data", () => {
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

      const next = createValidators(3);

      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        6,
        5,
        block5Hash,
        customValidators,
        2,
        [],
        next.map((item) => item.address)
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
        customValidators,
        2,
        next.map((item) => item.address),
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

      const currentValidators = await custom.getCurrentValidators();
      expect(currentValidators[0]).to.deep.eq(next.map((item) => item.address));
    });

    it("penalty validitor verify", async () => {
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
      const next = createValidators(5);
      const penalties = [next[0], next[1]];
      const actualValidators = [next[2], next[3], next[4]];

      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        6,
        5,
        block5Hash,
        customValidators,
        2,
        [],
        next.map((item) => item.address),
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
        customValidators,
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
