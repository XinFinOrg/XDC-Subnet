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

describe("lite checkpoint", () => {
  const block451Encoded =
    "0xf903a4a0eb684d0ff10fce899d2e0441d956a36f82b4cde153342f0a574be2fe221e4baba01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479480f489a673042c2e5f17e5b2a5e49d71bf0611a4a0cb45ef66afde6db6327d9b35a5ff58804f1026e07282ea064d5f6c3e0a1ac310a0e01a7fa2be74214bce49d387d48cd9ae50516b9a8026bdafd9cf1fbf85320640a04a2650b45992260035532dad6473d2dfd0cfc1e49abd9900ff121506ee44df82b9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000800000000000000000000000020000000000000004000000000000000000000000000000000000000000000000000000000000000018201c3841908b100808464d21820b8fc02f8f98201c4f8f4e7a0eb684d0ff10fce899d2e0441d956a36f82b4cde153342f0a574be2fe221e4bab8201c38201c2f8c9b841055b9bb42081c36c48c56d26de648cf8124235b8404950d88eedc446d7d7bdb97688f36b0208fd3f12d4895a0e43cccb9c6b3111c1ae34bd4583e34ad1801dd701b8413671a53a98f3b2f89d472722ea9454372b9f0087e272a41ca00b0e017b4255d11890b1607939c541f72963cc54ba4af419eb57f19cb8017568133ff26c51e0ee01b841d39c442e23c11566cfdad3511f5a2bc71dd9a08fb92c2696c3187f76cde2dc0c3e2497e92fbb5cea69b8bf7f90b090c17a6ecdd68d585180cc5a1723ab15fd2a0180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8414fc163637018bbc14e0773a5a8be1e5c7c6431936bffa05c7f4ab1e672aba9570f66b29729d72b6108608470d2480a85d0da3b28f5981d1401806cc9d7a217ae01c0f86994d23cf44b862ba86703f11f6e94a4a833f4fe224494b51df3658799cccb48c172d54e3bc89649f04eb49480f489a673042c2e5f17e5b2a5e49d71bf0611a4946f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b26149410982668af23d3e4b8d26805543618412ac724d4c0";
  const block452Encoded =
    "0xf9033aa06ca55725e3bb57a30d6a325843e8b330e1016b91750f5bd3ed0595532bc4b458a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794b51df3658799cccb48c172d54e3bc89649f04eb4a0cb45ef66afde6db6327d9b35a5ff58804f1026e07282ea064d5f6c3e0a1ac310a050042539782409b0daad9b3c89c8fc257ef6bcea7bda01f1a470fa6d11862403a0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c4841908b100808464d21822b8fc02f8f98201c5f8f4e7a06ca55725e3bb57a30d6a325843e8b330e1016b91750f5bd3ed0595532bc4b4588201c48201c3f8c9b841a1661f214c57d5b55a0956cdd433b475cabc1f27a6ec1f15fd4189d071fbfcf53fb57a7c34fa7817bdc97c80e355ecf004166e0ff0559c68c84a47d6f46ca7fa00b84163547ef90b0185ea3ec26b320939466197a57942ff19814a7ededa9abc279e6b1805efe9b4afbee218b04620dcd9771a57b841b1ac3dd993a010c043e2095f0e01b8417645858a0a74e8729a3f1bbccce8c86dbbd9dd4eb24fbee14ad9e1916590e89f490875671595bc65f5a26b84855f5dea3b16f9dc2007f8cbca5b77e0559de7350080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b84129f1ffda2df8b138419a21d638e4f01e28a41195b3fe6480e4dd35d502148edf54e97e6fb3aa2c04b46494ab40ea7ffb3127a75d05451905b761db032706ac2401c0c0c0";
  const block453Encoded =
    "0xf9033aa061d7ef7440afd84981e8d0a095c8396055065693e1bb4758ef0896a53ce995dea01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794d23cf44b862ba86703f11f6e94a4a833f4fe2244a0cb45ef66afde6db6327d9b35a5ff58804f1026e07282ea064d5f6c3e0a1ac310a092f99544ffc32f7f44c697ebfe14b3ff1f7453318dbee36faee56f2741b43a1da0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c5841908b100808464d21824b8fc02f8f98201c6f8f4e7a061d7ef7440afd84981e8d0a095c8396055065693e1bb4758ef0896a53ce995de8201c58201c4f8c9b8418ba2fcb977ba49455b5fd62338cc537813c32bf31c529ceea89dec4b50c629945e6db0017f196deb898574f350ab08b9bc828e6592e6ccd26ce029aaa2499aee01b8417d4cc3f05e761611a73e248862f193a5cf95057178d76a108fdd710e79a0a8d82aaf02f275dddaace6fb6c13464cb3b36a86d410429fcc5c0b7cb4aab6cc6af001b8410d55434a73ff58d03d41b1c9b665a1c6964bf32b687705a65375f0cf3e843013716cf195de62b102ca68aa462e48d9d492d55fdfca2d91e82c168e8005d8ec290180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841600afc80b4aa38598301ba77760fd177352b315b5493e5649533f03bd0c9b40e18ea3f28103383e3b384e26449a6f7a6de46cfb2619539acba8ea87483fdfc4800c0c0c0";
  const block454Encoded =
    "0xf9033aa01469d35c3d36273143d2aacc9e9d4d4bba766d320a057635f8a4c84ec4d7203ba01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479410982668af23d3e4b8d26805543618412ac724d4a0cb45ef66afde6db6327d9b35a5ff58804f1026e07282ea064d5f6c3e0a1ac310a0701868079efa449ccf7da5408d2d9ae609f343e8dab595519677d1ada6ba39cda0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c6841908b100808464d21826b8fc02f8f98201c7f8f4e7a01469d35c3d36273143d2aacc9e9d4d4bba766d320a057635f8a4c84ec4d7203b8201c68201c5f8c9b841f054a67b9bf52534134acabfb085859600c0cff509344537c9c60952f547e4741f2b106e8115ca338ee0ba97eac191b84600ab84b85fd489b070d873b8bdebe800b84146feab5a830f0acd4a13363a5a21c518b0652bcc9ac2c80810ab7cda212483603780c51a73023c51819c74a3e0fd8425dde9e481fe6a0d371ec3b81a9aebacad01b841754cf516f2aa7775ae8b54465b7c6e2d0abd1898f5a1dffebc0e462c7233d5000e29704be2f6fc4fcfdfb115174453b8f26d4290e473f44ebedbf02c15cf7d1a0080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841d94e877bd1981e4f08e1754551d7b8eb4a9ed2ed3a452549277e69c006a308a177c6639a55cbb4ad4bcf02115d6d35d256b01289eddfec75b64ecfc75535502100c0c0c0";

  let liteCheckpoint;
  let custom;
  let customValidators;
  let customBlock0;
  let customeBlock1;

  const fixture = async () => {
    const headerReaderFactory = await ethers.getContractFactory("HeaderReader");

    const headerReader = await headerReaderFactory.deploy();

    const factory = await ethers.getContractFactory("LiteCheckpoint", {
      libraries: {
        HeaderReader: headerReader.address,
      },
    });
    const liteCheckpoint = await factory.deploy(
      [
        "0x10982668af23d3e4b8d26805543618412ac724d4",
        "0x6f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b2614",
        "0x80f489a673042c2e5f17e5b2a5e49d71bf0611a4",
        "0xb51df3658799cccb48c172d54e3bc89649f04eb4",
        "0xd23cf44b862ba86703f11f6e94a4a833f4fe2244",
      ],
      "0xf902cfa0994512611cf80029bf4de5f214437e6c47841ab8730cd7598dfb04b606af91a3a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479480f489a673042c2e5f17e5b2a5e49d71bf0611a4a03a9114857792f2a10b4d04ded4e29cb2371535ed749a7686aa2e9885c6007e25a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000101841908b100808464d21493aa02e802e6e3a0994512611cf80029bf4de5f214437e6c47841ab8730cd7598dfb04b606af91a38080c080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841cadb57e92efb44f8614c1c13d0fbb7f19bc7e5a2d6d84a211fda0bf59cff283c387689979dd2c989265ebdcca9aeb96d6701253502ccf83d5e052be1dfbea19d00c0f8699410982668af23d3e4b8d26805543618412ac724d4946f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b26149480f489a673042c2e5f17e5b2a5e49d71bf0611a494b51df3658799cccb48c172d54e3bc89649f04eb494d23cf44b862ba86703f11f6e94a4a833f4fe2244c0",
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
      block1Encoded,
      5,
      10
    );
    const customBlock0 = { hash: block0Hash, encoded: block0Encoded };
    const customeBlock1 = { hash: block1Hash, encoded: block1Encoded };

    return {
      liteCheckpoint,
      custom,
      customValidators,
      customBlock0,
      customeBlock1,
    };
  };
  beforeEach("deploy fixture", async () => {
    ({ liteCheckpoint, custom, customValidators, customBlock0, customeBlock1 } =
      await loadFixture(fixture));
  });
  describe("test lite checkpoint real block data", () => {
    it("receive a new header which has only the next and uncommitted", async () => {
      await liteCheckpoint.receiveHeader([block451Encoded]);
      const block2Hash = blockToHash(block451Encoded);
      const block2Resp = await liteCheckpoint.getHeader(block2Hash);

      const unBlock2Resp = await liteCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(block2Resp["number"]).to.eq(451);
      expect(block2Resp["roundNum"]).to.eq(459);
      expect(block2Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock2Resp["sequence"]).to.eq(0);
      expect(unBlock2Resp["lastRoundNum"]).to.eq(459);
      expect(unBlock2Resp["lastNum"]).to.eq(451);
    });
    it("receive new header which has only the next and committed", async () => {
      await liteCheckpoint.receiveHeader([
        block451Encoded,
        block452Encoded,
        block453Encoded,
        block454Encoded,
      ]);
      const block2Hash = blockToHash(block451Encoded);
      const block2Resp = await liteCheckpoint.getHeader(block2Hash);

      const unBlock2Resp = await liteCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(block2Resp["number"]).to.eq(451);
      expect(block2Resp["roundNum"]).to.eq(459);
      expect(block2Resp["mainnetNum"]).to.not.eq(-1);
      expect(unBlock2Resp["sequence"]).to.eq(0);
      expect(unBlock2Resp["lastRoundNum"]).to.eq(0);
      expect(unBlock2Resp["lastNum"]).to.eq(0);
    });

    it("commit header", async () => {
      await liteCheckpoint.receiveHeader([block451Encoded, block452Encoded]);

      const block2Hash = blockToHash(block451Encoded);
      const block2Resp = await liteCheckpoint.getHeader(block2Hash);

      const unBlock2Resp = await liteCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(block2Resp["number"]).to.eq(451);
      expect(block2Resp["roundNum"]).to.eq(459);
      expect(block2Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock2Resp["sequence"]).to.eq(1);
      expect(unBlock2Resp["lastRoundNum"]).to.eq(460);
      expect(unBlock2Resp["lastNum"]).to.eq(452);

      await liteCheckpoint.commitHeader(block2Hash, [
        block453Encoded,
        block454Encoded,
      ]);

      const committedBlock2Resp = await liteCheckpoint.getHeader(block2Hash);
      const committedUnBlock2Resp = await liteCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(committedBlock2Resp["number"]).to.eq(451);
      expect(committedBlock2Resp["roundNum"]).to.eq(459);
      expect(committedBlock2Resp["mainnetNum"]).to.not.eq(-1);
      expect(committedUnBlock2Resp["sequence"]).to.eq(0);
      expect(committedUnBlock2Resp["lastRoundNum"]).to.eq(0);
      expect(committedUnBlock2Resp["lastNum"]).to.eq(0);
    });
  });
  describe("test lite checkpoint custom block data", () => {
    //TODO
    it("receive new header which has only the next and uncommitted", async () => {
      const next = createValidators(3).map((item) => {
        return item["address"];
      });
      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        7,
        6,
        //doesn't matter random value, lite not check the value at array 0
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        next
      );

      await custom.receiveHeader([block6Encoded]);

      const block6Resp = await custom.getHeader(block6Hash);

      const unBlock6Resp = await custom.getUnCommittedHeader(block6Hash);

      expect(block6Resp["number"]).to.eq(6);
      expect(block6Resp["roundNum"]).to.eq(7);
      expect(block6Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock6Resp["sequence"]).to.eq(0);
      expect(unBlock6Resp["lastRoundNum"]).to.eq(7);
      expect(unBlock6Resp["lastNum"]).to.eq(6);
    });
    it("receive new header which has only the next and committed", async () => {
      const next = createValidators(3).map((item) => {
        return item["address"];
      });
      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        7,
        6,
        //doesn't matter random value, lite not check the value at array 0
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        next
      );
      const [block7, block7Encoded, block7Hash] = composeAndSignBlock(
        7,
        8,
        7,
        block6Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block8, block8Encoded, block8Hash] = composeAndSignBlock(
        8,
        9,
        8,
        block7Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block9, block9Encoded, block9Hash] = composeAndSignBlock(
        9,
        10,
        9,
        block8Hash,
        customValidators,
        2,
        [],
        []
      );

      await custom.receiveHeader([
        block6Encoded,
        block7Encoded,
        block8Encoded,
        block9Encoded,
      ]);

      const block6Resp = await custom.getHeader(block6Hash);

      const unBlock6Resp = await custom.getUnCommittedHeader(block6Hash);

      const latestBlocks = await custom.getLatestBlocks();

      expect(block6Resp["number"]).to.eq(6);
      expect(block6Resp["roundNum"]).to.eq(7);
      expect(block6Resp["mainnetNum"]).to.not.eq(-1);
      expect(unBlock6Resp["sequence"]).to.eq(0);
      expect(unBlock6Resp["lastRoundNum"]).to.eq(0);
      expect(unBlock6Resp["lastNum"]).to.eq(0);
      expect(latestBlocks[0]["blockHash"]).to.eq(block6Hash);
      expect(latestBlocks[1]["blockHash"]).to.eq(latestBlocks[0]["blockHash"]);
    });
    it("commit header", async () => {
      const next = createValidators(3).map((item) => {
        return item["address"];
      });
      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        7,
        6,
        //doesn't matter random value, lite not check the value at array 0
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        next
      );
      const [block7, block7Encoded, block7Hash] = composeAndSignBlock(
        7,
        8,
        7,
        block6Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block8, block8Encoded, block8Hash] = composeAndSignBlock(
        8,
        9,
        8,
        block7Hash,
        customValidators,
        2,
        [],
        []
      );
      const [block9, block9Encoded, block9Hash] = composeAndSignBlock(
        9,
        10,
        9,
        block8Hash,
        customValidators,
        2,
        [],
        []
      );

      await custom.receiveHeader([block6Encoded, block7Encoded]);

      const block6Resp = await custom.getHeader(block6Hash);

      const unBlock6Resp = await custom.getUnCommittedHeader(block6Hash);

      const latestBlocks = await custom.getLatestBlocks();

      expect(block6Resp["number"]).to.eq(6);
      expect(block6Resp["roundNum"]).to.eq(7);
      expect(block6Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock6Resp["sequence"]).to.eq(1);
      expect(unBlock6Resp["lastRoundNum"]).to.eq(8);
      expect(unBlock6Resp["lastNum"]).to.eq(7);
      expect(latestBlocks[0]["blockHash"]).to.eq(block6Hash);
      expect(latestBlocks[0]["blockHash"]).to.not.eq(
        latestBlocks[1]["blockHash"]
      );

      await custom.commitHeader(block6Hash, [block8Encoded, block9Encoded]);

      const committedBlock6Resp = await custom.getHeader(block6Hash);
      const committedUnBlock6Resp = await custom.getUnCommittedHeader(
        block6Hash
      );
      const committedLatestBlocks = await custom.getLatestBlocks();

      expect(committedBlock6Resp["number"]).to.eq(6);
      expect(committedBlock6Resp["roundNum"]).to.eq(7);
      expect(committedBlock6Resp["mainnetNum"]).to.not.eq(-1);
      expect(committedUnBlock6Resp["sequence"]).to.eq(0);
      expect(committedUnBlock6Resp["lastRoundNum"]).to.eq(0);
      expect(committedUnBlock6Resp["lastNum"]).to.eq(0);
      expect(committedLatestBlocks[0]["blockHash"]).to.eq(block6Hash);
      expect(committedLatestBlocks[0]["blockHash"]).to.eq(
        committedLatestBlocks[1]["blockHash"]
      );
    });

    it("switch a validator set", async () => {
      const next = createValidators(3);

      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        6,
        5,
        //doesn't matter random value, lite not check the value at array 0
        customeBlock1["hash"],
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
        next,
        2,
        next.map((item) => item.address),
        []
      );

      await custom.receiveHeader([
        block6Encoded,
        block7Encoded,
        block8Encoded,
        block9Encoded,
        block10Encoded,
      ]);
      const committedBlock6Resp = await custom.getHeader(block6Hash);
      const committedUnBlock6Resp = await custom.getUnCommittedHeader(
        block6Hash
      );

      expect(committedBlock6Resp["number"]).to.eq(6);
      expect(committedBlock6Resp["roundNum"]).to.eq(6);
      expect(committedBlock6Resp["mainnetNum"]).to.not.eq(-1);
      expect(committedUnBlock6Resp["sequence"]).to.eq(0);
      expect(committedUnBlock6Resp["lastRoundNum"]).to.eq(0);
      expect(committedUnBlock6Resp["lastNum"]).to.eq(0);

      const committedBlock10Resp = await custom.getHeader(block10Hash);
      const committedUnBlock10Resp = await custom.getUnCommittedHeader(
        block10Hash
      );

      expect(committedBlock10Resp["number"]).to.eq(10);
      expect(committedBlock10Resp["roundNum"]).to.eq(10);
      expect(committedBlock10Resp["mainnetNum"]).to.eq(-1);
      expect(committedUnBlock10Resp["sequence"]).to.eq(0);
      expect(committedUnBlock10Resp["lastRoundNum"]).to.eq(10);
      expect(committedUnBlock10Resp["lastNum"]).to.eq(10);

      const currentValidators = await custom.getCurrentValidators();
      expect(currentValidators[0]).to.deep.eq(next.map((item) => item.address));
    });

    it("penalty validitor verify", async () => {
      const next = createValidators(5);
      const penalties = [next[0], next[1]];
      const actualValidators = [next[2], next[3], next[4]];

      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        6,
        5,
        //doesn't matter random value, lite not check the value at array 0
        customeBlock1["hash"],
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
        actualValidators,
        2,
        actualValidators.map((item) => item.address),
        []
      );

      await custom.receiveHeader([
        block6Encoded,
        block7Encoded,
        block8Encoded,
        block9Encoded,
        block10Encoded,
      ]);

      const currentValidators = await custom.getCurrentValidators();
      expect(currentValidators[0]).to.deep.eq(
        actualValidators.map((item) => item.address)
      );
    });
  });
});
