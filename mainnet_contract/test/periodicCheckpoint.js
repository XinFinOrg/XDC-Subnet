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

describe("periodic checkpoint", () => {
  let periodicCheckpoint;
  let custom;
  let customValidators;
  let customBlock0;
  let customeBlock1;

  const fixture = async () => {
    const headerReaderFactory = await ethers.getContractFactory("HeaderReader");

    const headerReader = await headerReaderFactory.deploy();

    const factory = await ethers.getContractFactory("PeriodicCheckpoint", {
      libraries: {
        HeaderReader: headerReader.address,
      },
    });
    const periodicCheckpoint = await factory.deploy(
      [
        "0x30f21e514a66732da5dff95340624fa808048601",
        "0x25b4cbb9a7ae13feadc3e9f29909833d19d16de5",
        "0x3d9fd0c76bb8b3b4929ca861d167f3e05926cb68",
        "0x3c03a0abac1da8f2f419a59afe1c125f90b506c5",
        "0x2af0cacf84899f504a6dc95e6205547bdfe28c2c",
      ],
      "0xf90339a077ebec526c2409e6dcd7dad995a83247d0c7899817d4ae19d1460925d6da66f0a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479430f21e514a66732da5dff95340624fa808048601a049a9fd6e97475603fcd7ff1415da69ea09ccb67d166ee6f969e2a08997bdbeb0a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000101841908b100808464be8aa9aa02e802e6e3a077ebec526c2409e6dcd7dad995a83247d0c7899817d4ae19d1460925d6da66f08080c080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b84177cbcf7d672d8c1b48de8930ee617076a77bd8c4df11a5808b22ae2daebe71c071ba8f1b53e9fbedfeb5be1e26985b0f2f4720cf4a544bf727096e0d092cd85f00f8699425b4cbb9a7ae13feadc3e9f29909833d19d16de5942af0cacf84899f504a6dc95e6205547bdfe28c2c9430f21e514a66732da5dff95340624fa808048601943c03a0abac1da8f2f419a59afe1c125f90b506c5943d9fd0c76bb8b3b4929ca861d167f3e05926cb68f8699425b4cbb9a7ae13feadc3e9f29909833d19d16de5942af0cacf84899f504a6dc95e6205547bdfe28c2c9430f21e514a66732da5dff95340624fa808048601943c03a0abac1da8f2f419a59afe1c125f90b506c5943d9fd0c76bb8b3b4929ca861d167f3e05926cb68c0",
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
      periodicCheckpoint,
      custom,
      customValidators,
      customBlock0,
      customeBlock1,
    };
  };
  beforeEach("deploy fixture", async () => {
    ({
      periodicCheckpoint,
      custom,
      customValidators,
      customBlock0,
      customeBlock1,
    } = await loadFixture(fixture));
  });
  describe("test periodic checkpoint real block data", () => {
    it("receive a new header which has only the next and uncommitted", async () => {
      const block451Encoded =
        "0xf903a4a0dd37cb87e01ce11ebafdfe4479b663dfd9f32a3a70d1648f9692f8628b25a669a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347943d9fd0c76bb8b3b4929ca861d167f3e05926cb68a031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a02200f18d3f0c6f92e9a904f4ae266654ae181b214fc138d7d8d506f24f3b2299a04a2650b45992260035532dad6473d2dfd0cfc1e49abd9900ff121506ee44df82b9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000800000000000000000000000020000000000000004000000000000000000000000000000000000000000000000000000000000000018201c3841908b100808464be8e78b8fc02f8f98201cbf8f4e7a0dd37cb87e01ce11ebafdfe4479b663dfd9f32a3a70d1648f9692f8628b25a6698201ca8201c2f8c9b841bda00c4e0b2f4d7c0e0cb9469783a62a957011cb413e89dc3fc206e0d551524768caa9705a154f3a220953c3a05aafb6b06ea1477fc8334483e513381acee1d400b84180a246e11ff55881b0f11aa70f03bdc89c40d22454905aee01dfbe7c84069d5e6d43bcfc06638f118f541aec24d09b858ee7ccaeb1a7e3f2e71df9695252dbc801b841fd544a4686b09373fa3026a9129ad4df01dc065391313669e9517f2003f2032875b171b2ef981b21340e0589214fe734a3170d5aa0976dba2a0fda0ac31df9f10080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841df638329ff644938ee3f6e9c2143293c935919246ac116c12041c9010e62cb846a7f7abe9940853e6801bd6daf16b7185e9a2f62e52b16ee4b813d8c721544cc01c0f869943d9fd0c76bb8b3b4929ca861d167f3e05926cb68943c03a0abac1da8f2f419a59afe1c125f90b506c59430f21e514a66732da5dff95340624fa808048601942af0cacf84899f504a6dc95e6205547bdfe28c2c9425b4cbb9a7ae13feadc3e9f29909833d19d16de5c0";
      const canBeSaved = await periodicCheckpoint.checkHeader(block451Encoded);
      expect(canBeSaved).to.equal(true);
      await periodicCheckpoint.receiveHeader([block451Encoded]);
      const block2Hash = blockToHash(block451Encoded);
      const block2Resp = await periodicCheckpoint.getHeader(block2Hash);

      const unBlock2Resp = await periodicCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(block2Resp["number"]).to.eq(451);
      expect(block2Resp["roundNum"]).to.eq(459);
      expect(block2Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock2Resp["sequence"]).to.eq(0);
      expect(unBlock2Resp["preRoundNum"]).to.eq(459);
      expect(unBlock2Resp["lastNum"]).to.eq(451);
    });
    it("receive new header which has only the next and committed", async () => {
      const block451Encoded =
        "0xf903a4a0dd37cb87e01ce11ebafdfe4479b663dfd9f32a3a70d1648f9692f8628b25a669a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347943d9fd0c76bb8b3b4929ca861d167f3e05926cb68a031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a02200f18d3f0c6f92e9a904f4ae266654ae181b214fc138d7d8d506f24f3b2299a04a2650b45992260035532dad6473d2dfd0cfc1e49abd9900ff121506ee44df82b9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000800000000000000000000000020000000000000004000000000000000000000000000000000000000000000000000000000000000018201c3841908b100808464be8e78b8fc02f8f98201cbf8f4e7a0dd37cb87e01ce11ebafdfe4479b663dfd9f32a3a70d1648f9692f8628b25a6698201ca8201c2f8c9b841bda00c4e0b2f4d7c0e0cb9469783a62a957011cb413e89dc3fc206e0d551524768caa9705a154f3a220953c3a05aafb6b06ea1477fc8334483e513381acee1d400b84180a246e11ff55881b0f11aa70f03bdc89c40d22454905aee01dfbe7c84069d5e6d43bcfc06638f118f541aec24d09b858ee7ccaeb1a7e3f2e71df9695252dbc801b841fd544a4686b09373fa3026a9129ad4df01dc065391313669e9517f2003f2032875b171b2ef981b21340e0589214fe734a3170d5aa0976dba2a0fda0ac31df9f10080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841df638329ff644938ee3f6e9c2143293c935919246ac116c12041c9010e62cb846a7f7abe9940853e6801bd6daf16b7185e9a2f62e52b16ee4b813d8c721544cc01c0f869943d9fd0c76bb8b3b4929ca861d167f3e05926cb68943c03a0abac1da8f2f419a59afe1c125f90b506c59430f21e514a66732da5dff95340624fa808048601942af0cacf84899f504a6dc95e6205547bdfe28c2c9425b4cbb9a7ae13feadc3e9f29909833d19d16de5c0";
      const block452Encoded =
        "0xf9033aa06e6e8448574a57e2c3cf4cfdb2155c6bd5b636d4467257c3f3fe885059fe56eda01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479425b4cbb9a7ae13feadc3e9f29909833d19d16de5a031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a089061db7ff980f9d39960313767a9ac1f0f3a3968f4e82a19af0c3fe7dcda7b4a0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c4841908b100808464be8e7ab8fc02f8f98201ccf8f4e7a06e6e8448574a57e2c3cf4cfdb2155c6bd5b636d4467257c3f3fe885059fe56ed8201cb8201c3f8c9b84156e591ad059b5011b2c51316a89c554206bafdabc4cb9cbb599e9ee8c6a88a031c34055cf1f59425b11eafe811e018849d823b68d5afe00a749a0a68ec8016ba01b841a1e42d19c8256a22e6f44aa3f8e4c1e21e518bf2e99d1fc0dadc3076dfb02a3935744d95b818cce2f1dd7a2a83c01819886bcc68baff2f73378856c63ee051a801b8417c603ab72644c9aa3bdd6c7eef74de0df95d0f8ad08ecd140d1a605ce8accb5442e12e8be5eab014b092539fa4732a13586968f0e0252d2d9b6ab59a6544ed020180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841f01611afbe949efa6ca19abeba52e1d73c6e56db8445e9112395f740a9fe270435c14b1fafc346234b7dd4e236f04c72d137e7f4f4d213d445f603a12ffe37a700c0c0c0";
      const block453Encoded =
        "0xf9033aa01bb8989beae8097df20d968bcaab619cf407d1bdccb7f18730060773fcdd5619a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347942af0cacf84899f504a6dc95e6205547bdfe28c2ca031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a0cfe4fdeb32e4ce7dcdfcc5adcb5ebe91d2a953dce23037d8652c1cd6c356eceaa0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c5841908b100808464be8e7cb8fc02f8f98201cdf8f4e7a01bb8989beae8097df20d968bcaab619cf407d1bdccb7f18730060773fcdd56198201cc8201c4f8c9b841215f702d5683925272c56e77b972d7ef02188c5ae4fd90093081faf6cb9b7bb16198c543ed2085c6e5e3a89d3f1110404d5f02695bf212ff6ae57b37dd34cc9f00b841dff2d316109215cd7881b7a69fe50cdee753558a1a7c5974d220b177be2d94186e5deadc986ab1da05335d83f204795dcc07ad1006472ff5c2cf68c7712c721201b841727ab6e87bb886909e99efef6c2165bd3f2c9a098f449008afc129c60cef9a9c07e38d5f12bdcfb7219f7c097a74e04b289f5a96f66244b9b73c6601b8b3c2670080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841bdefa6b827504d36f045e72d752e86e4bd2a200dfa24f81ee9a2ddca5335429f773fa267f1a0d70478d8c51a904604516cf9a1d1ebf91aa8b0fc676fd7c9717801c0c0c0";
      const block454Encoded =
        "0xf9033aa07cc6b467bfd6d13def6829785a6e181a6512357d1c2d9d596b950020eafcc237a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479430f21e514a66732da5dff95340624fa808048601a031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a0ffa2be59b3b97cc024bb01d3d44a8281cacbd80cfb19c88be0a3f9d4a4b9742fa0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c6841908b100808464be8e7eb8fc02f8f98201cef8f4e7a07cc6b467bfd6d13def6829785a6e181a6512357d1c2d9d596b950020eafcc2378201cd8201c5f8c9b841fa6b58f6fab088afe0eeb8bd45dbd79777dd54e069860a5b68be3092986a37ed54b04b36b9dc46b40b7a53bc3d878c4711a3f5d08e9b344253554a25a83cb9b300b841adcd09c9ea70dacce1c86e985c3f8f20e4771fa5a8a34b59ffcfe9bd3fbc9c985e736c1f3a4c2e641c9ec89d77aadf6627f47b3cfd9960e6c305d95f8001010b00b8415908e58f173b81d500d7a5b0a65c8c77181e0e590a0915d43d4c490d4d18367908619ba95b478eebcd847f740486e7284f1410cf11d072cca69ed1390b7f160e0080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841a6f80167cfabaabf3969dccec161f7e8585b364b52972d4b0c4cecf5078ae0226af1efc6c6be73bb0f9ca6c093b2a10449878596ab50494df341a4894694609901c0c0c0";

      const canBeSaved = await periodicCheckpoint.checkHeader(block451Encoded);
      expect(canBeSaved).to.equal(true);
      await periodicCheckpoint.receiveHeader([
        block451Encoded,
        block452Encoded,
        block453Encoded,
        block454Encoded,
      ]);
      const block2Hash = blockToHash(block451Encoded);
      const block2Resp = await periodicCheckpoint.getHeader(block2Hash);

      const unBlock2Resp = await periodicCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(block2Resp["number"]).to.eq(451);
      expect(block2Resp["roundNum"]).to.eq(459);
      expect(block2Resp["mainnetNum"]).to.not.eq(-1);
      expect(unBlock2Resp["sequence"]).to.eq(0);
      expect(unBlock2Resp["preRoundNum"]).to.eq(0);
      expect(unBlock2Resp["lastNum"]).to.eq(0);
    });

    it("replenish header", async () => {
      const block451Encoded =
        "0xf903a4a0dd37cb87e01ce11ebafdfe4479b663dfd9f32a3a70d1648f9692f8628b25a669a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347943d9fd0c76bb8b3b4929ca861d167f3e05926cb68a031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a02200f18d3f0c6f92e9a904f4ae266654ae181b214fc138d7d8d506f24f3b2299a04a2650b45992260035532dad6473d2dfd0cfc1e49abd9900ff121506ee44df82b9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000800000000000000000000000020000000000000004000000000000000000000000000000000000000000000000000000000000000018201c3841908b100808464be8e78b8fc02f8f98201cbf8f4e7a0dd37cb87e01ce11ebafdfe4479b663dfd9f32a3a70d1648f9692f8628b25a6698201ca8201c2f8c9b841bda00c4e0b2f4d7c0e0cb9469783a62a957011cb413e89dc3fc206e0d551524768caa9705a154f3a220953c3a05aafb6b06ea1477fc8334483e513381acee1d400b84180a246e11ff55881b0f11aa70f03bdc89c40d22454905aee01dfbe7c84069d5e6d43bcfc06638f118f541aec24d09b858ee7ccaeb1a7e3f2e71df9695252dbc801b841fd544a4686b09373fa3026a9129ad4df01dc065391313669e9517f2003f2032875b171b2ef981b21340e0589214fe734a3170d5aa0976dba2a0fda0ac31df9f10080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841df638329ff644938ee3f6e9c2143293c935919246ac116c12041c9010e62cb846a7f7abe9940853e6801bd6daf16b7185e9a2f62e52b16ee4b813d8c721544cc01c0f869943d9fd0c76bb8b3b4929ca861d167f3e05926cb68943c03a0abac1da8f2f419a59afe1c125f90b506c59430f21e514a66732da5dff95340624fa808048601942af0cacf84899f504a6dc95e6205547bdfe28c2c9425b4cbb9a7ae13feadc3e9f29909833d19d16de5c0";
      const block452Encoded =
        "0xf9033aa06e6e8448574a57e2c3cf4cfdb2155c6bd5b636d4467257c3f3fe885059fe56eda01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479425b4cbb9a7ae13feadc3e9f29909833d19d16de5a031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a089061db7ff980f9d39960313767a9ac1f0f3a3968f4e82a19af0c3fe7dcda7b4a0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c4841908b100808464be8e7ab8fc02f8f98201ccf8f4e7a06e6e8448574a57e2c3cf4cfdb2155c6bd5b636d4467257c3f3fe885059fe56ed8201cb8201c3f8c9b84156e591ad059b5011b2c51316a89c554206bafdabc4cb9cbb599e9ee8c6a88a031c34055cf1f59425b11eafe811e018849d823b68d5afe00a749a0a68ec8016ba01b841a1e42d19c8256a22e6f44aa3f8e4c1e21e518bf2e99d1fc0dadc3076dfb02a3935744d95b818cce2f1dd7a2a83c01819886bcc68baff2f73378856c63ee051a801b8417c603ab72644c9aa3bdd6c7eef74de0df95d0f8ad08ecd140d1a605ce8accb5442e12e8be5eab014b092539fa4732a13586968f0e0252d2d9b6ab59a6544ed020180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841f01611afbe949efa6ca19abeba52e1d73c6e56db8445e9112395f740a9fe270435c14b1fafc346234b7dd4e236f04c72d137e7f4f4d213d445f603a12ffe37a700c0c0c0";
      const canBeSaved = await periodicCheckpoint.checkHeader(block451Encoded);
      expect(canBeSaved).to.equal(true);

      await periodicCheckpoint.receiveHeader([
        block451Encoded,
        block452Encoded,
      ]);

      const block2Hash = blockToHash(block451Encoded);
      const block2Resp = await periodicCheckpoint.getHeader(block2Hash);

      const unBlock2Resp = await periodicCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(block2Resp["number"]).to.eq(451);
      expect(block2Resp["roundNum"]).to.eq(459);
      expect(block2Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock2Resp["sequence"]).to.eq(1);
      expect(unBlock2Resp["preRoundNum"]).to.eq(460);
      expect(unBlock2Resp["lastNum"]).to.eq(452);

      const block453Encoded =
        "0xf9033aa01bb8989beae8097df20d968bcaab619cf407d1bdccb7f18730060773fcdd5619a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347942af0cacf84899f504a6dc95e6205547bdfe28c2ca031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a0cfe4fdeb32e4ce7dcdfcc5adcb5ebe91d2a953dce23037d8652c1cd6c356eceaa0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c5841908b100808464be8e7cb8fc02f8f98201cdf8f4e7a01bb8989beae8097df20d968bcaab619cf407d1bdccb7f18730060773fcdd56198201cc8201c4f8c9b841215f702d5683925272c56e77b972d7ef02188c5ae4fd90093081faf6cb9b7bb16198c543ed2085c6e5e3a89d3f1110404d5f02695bf212ff6ae57b37dd34cc9f00b841dff2d316109215cd7881b7a69fe50cdee753558a1a7c5974d220b177be2d94186e5deadc986ab1da05335d83f204795dcc07ad1006472ff5c2cf68c7712c721201b841727ab6e87bb886909e99efef6c2165bd3f2c9a098f449008afc129c60cef9a9c07e38d5f12bdcfb7219f7c097a74e04b289f5a96f66244b9b73c6601b8b3c2670080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841bdefa6b827504d36f045e72d752e86e4bd2a200dfa24f81ee9a2ddca5335429f773fa267f1a0d70478d8c51a904604516cf9a1d1ebf91aa8b0fc676fd7c9717801c0c0c0";
      const block454Encoded =
        "0xf9033aa07cc6b467bfd6d13def6829785a6e181a6512357d1c2d9d596b950020eafcc237a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479430f21e514a66732da5dff95340624fa808048601a031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a0ffa2be59b3b97cc024bb01d3d44a8281cacbd80cfb19c88be0a3f9d4a4b9742fa0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c6841908b100808464be8e7eb8fc02f8f98201cef8f4e7a07cc6b467bfd6d13def6829785a6e181a6512357d1c2d9d596b950020eafcc2378201cd8201c5f8c9b841fa6b58f6fab088afe0eeb8bd45dbd79777dd54e069860a5b68be3092986a37ed54b04b36b9dc46b40b7a53bc3d878c4711a3f5d08e9b344253554a25a83cb9b300b841adcd09c9ea70dacce1c86e985c3f8f20e4771fa5a8a34b59ffcfe9bd3fbc9c985e736c1f3a4c2e641c9ec89d77aadf6627f47b3cfd9960e6c305d95f8001010b00b8415908e58f173b81d500d7a5b0a65c8c77181e0e590a0915d43d4c490d4d18367908619ba95b478eebcd847f740486e7284f1410cf11d072cca69ed1390b7f160e0080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841a6f80167cfabaabf3969dccec161f7e8585b364b52972d4b0c4cecf5078ae0226af1efc6c6be73bb0f9ca6c093b2a10449878596ab50494df341a4894694609901c0c0c0";

      await periodicCheckpoint.replenishHeader(block2Hash, [
        block453Encoded,
        block454Encoded,
      ]);

      const committedBlock2Resp = await periodicCheckpoint.getHeader(
        block2Hash
      );
      const committedUnBlock2Resp =
        await periodicCheckpoint.getUnCommittedHeader(block2Hash);

      expect(committedBlock2Resp["number"]).to.eq(451);
      expect(committedBlock2Resp["roundNum"]).to.eq(459);
      expect(committedBlock2Resp["mainnetNum"]).to.not.eq(-1);
      expect(committedUnBlock2Resp["sequence"]).to.eq(0);
      expect(committedUnBlock2Resp["preRoundNum"]).to.eq(0);
      expect(committedUnBlock2Resp["lastNum"]).to.eq(0);
    });
  });
  describe("test periodic checkpoint custom block data", () => {
    //TODO
    it("receive new header which has only the next and no committed", async () => {
      const next = createValidators(3).map((item) => {
        return item["address"];
      });
      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        7,
        6,
        //doesn't matter random value, periodic not check the value at array 0
        customeBlock1["hash"],
        customValidators,
        2,
        [],
        next
      );

      const canBeSaved = await custom.checkHeader(block6Encoded);
      expect(canBeSaved).to.equal(true);
      await custom.receiveHeader([block6Encoded]);

      const block6Resp = await custom.getHeader(block6Hash);

      const unBlock6Resp = await custom.getUnCommittedHeader(block6Hash);

      expect(block6Resp["number"]).to.eq(6);
      expect(block6Resp["roundNum"]).to.eq(7);
      expect(block6Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock6Resp["sequence"]).to.eq(0);
      expect(unBlock6Resp["preRoundNum"]).to.eq(7);
      expect(unBlock6Resp["lastNum"]).to.eq(6);
    });
    it("receive new header which has only the current and no committed", async () => {
      
    });
    it("receive new header which has only the next and committed", async () => {
      const next = createValidators(3).map((item) => {
        return item["address"];
      });
      const [block6, block6Encoded, block6Hash] = composeAndSignBlock(
        6,
        7,
        6,
        //doesn't matter random value, periodic not check the value at array 0
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

      const canBeSaved = await custom.checkHeader(block6Encoded);
      expect(canBeSaved).to.equal(true);
      await custom.receiveHeader([
        block6Encoded,
        block7Encoded,
        block8Encoded,
        block9Encoded,
      ]);

      const block6Resp = await custom.getHeader(block6Hash);

      const unBlock6Resp = await custom.getUnCommittedHeader(block6Hash);

      expect(block6Resp["number"]).to.eq(6);
      expect(block6Resp["roundNum"]).to.eq(7);
      expect(block6Resp["mainnetNum"]).to.not.eq(-1);
      expect(unBlock6Resp["sequence"]).to.eq(0);
      expect(unBlock6Resp["preRoundNum"]).to.eq(0);
      expect(unBlock6Resp["lastNum"]).to.eq(0);
    });
    it("replenish header", async () => {

    });
  });
});
