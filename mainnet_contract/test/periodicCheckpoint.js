const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
function blockToHash(blockEncoded) {
  const blockBuffer = Buffer.from(blockEncoded.slice(2), "hex");
  return ethers.utils.keccak256(blockBuffer);
}
describe("periodic checkpoint", () => {
  let periodicCheckpoint;
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
      "0xf902e7a082c3605bed0c24cf03a45bb146d88e62a67742c122e85686455e2282f2796125a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794888c073313b36cf03cf1f739f39443551ff12bbea0c1dc283417f209d60a1b4a884d4da715781817b5a83a9c642a3e3ef9901a0f38a01b638e0cd65c922db5a78f927aea590dc2f05bfd4f87009396d27030c6a4d029a037677206c85d7bf905a2f29d9380c65c8d6f7231b1c5a36cb628bc5ccc0fe4d0b90100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000101841908b100826308846468da3caa02e801e6e3a082c3605bed0c24cf03a45bb146d88e62a67742c122e85686455e2282f27961258080c080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8412c0644873d33a0045348ba247d083dbf22ae86cd35403ac6f0cdd3bcf2c71a2a3ba9799b991bf5e1eab2351809e7fc3b4ad54650bc7fcda9c3f5422c11914a8700f83f945058dfe24ef6b537b5bc47116a45f0428da182fa94888c073313b36cf03cf1f739f39443551ff12bbe94efea93e384a6ccaaf28e33790a2d1b2625bf964df83f945058dfe24ef6b537b5bc47116a45f0428da182fa94888c073313b36cf03cf1f739f39443551ff12bbe94efea93e384a6ccaaf28e33790a2d1b2625bf964d80",
      450,
      900
    );

    return { periodicCheckpoint };
  };
  beforeEach("deploy fixture", async () => {
    ({ periodicCheckpoint } = await loadFixture(fixture));
  });
  describe("test xdc periodic checkpoint real block data", () => {
    it("receive new header", async () => {
      const block451Encoded =
        "0xf903a4a0dd37cb87e01ce11ebafdfe4479b663dfd9f32a3a70d1648f9692f8628b25a669a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347943d9fd0c76bb8b3b4929ca861d167f3e05926cb68a031767fdd93b983bbde8462c60102a7b98992c6d8c047858870995fd600dd5c18a02200f18d3f0c6f92e9a904f4ae266654ae181b214fc138d7d8d506f24f3b2299a04a2650b45992260035532dad6473d2dfd0cfc1e49abd9900ff121506ee44df82b9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000800000000000000000000000020000000000000004000000000000000000000000000000000000000000000000000000000000000018201c3841908b100808464be8e78b8fc02f8f98201cbf8f4e7a0dd37cb87e01ce11ebafdfe4479b663dfd9f32a3a70d1648f9692f8628b25a6698201ca8201c2f8c9b841bda00c4e0b2f4d7c0e0cb9469783a62a957011cb413e89dc3fc206e0d551524768caa9705a154f3a220953c3a05aafb6b06ea1477fc8334483e513381acee1d400b84180a246e11ff55881b0f11aa70f03bdc89c40d22454905aee01dfbe7c84069d5e6d43bcfc06638f118f541aec24d09b858ee7ccaeb1a7e3f2e71df9695252dbc801b841fd544a4686b09373fa3026a9129ad4df01dc065391313669e9517f2003f2032875b171b2ef981b21340e0589214fe734a3170d5aa0976dba2a0fda0ac31df9f10080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841df638329ff644938ee3f6e9c2143293c935919246ac116c12041c9010e62cb846a7f7abe9940853e6801bd6daf16b7185e9a2f62e52b16ee4b813d8c721544cc01c0f869943d9fd0c76bb8b3b4929ca861d167f3e05926cb68943c03a0abac1da8f2f419a59afe1c125f90b506c59430f21e514a66732da5dff95340624fa808048601942af0cacf84899f504a6dc95e6205547bdfe28c2c9425b4cbb9a7ae13feadc3e9f29909833d19d16de5c0";
      await periodicCheckpoint.receiveHeader([block451Encoded]);
      const block2Hash = blockToHash(block451Encoded);
      const block2Resp = await periodicCheckpoint.getHeader(block2Hash);
      console.log(block2Resp);
    });
  });
});
