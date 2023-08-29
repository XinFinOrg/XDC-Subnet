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
    "0xf90400a0cdd8f018129bb028f7bc1f1c9df6e91a7659dd4dce9828c6cd17abdc018b5494a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479410982668af23d3e4b8d26805543618412ac724d4a09e6cdf2b4a731bc0b148f2eb971bfdbb06d0962e4d3bf84a36574e62fe1b5e00a0397986318348e0655340ffecd0185dc0bafbce601557d05622d0670775520e2ba0567dc30f8f146083c0b197f0487e1f000c395296dc939a85dafa4af7e4b2e200b9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000800000000000000000000000020000000000000004000000000000000000000000000000000000000000000000000000000000000018201c3841908b100808464d69621b9014202f9013e820235f90138e7a0cdd8f018129bb028f7bc1f1c9df6e91a7659dd4dce9828c6cd17abdc018b54948202348201c2f9010cb8413c788b1525e6e3b1775582b703d265974ea3710695fe94bb2783e292d2694ebf06888056aeedac269c0ab18fd3b15a1f49111bf374b6914a49d869e37d39405900b841f3bbb12590767f4790658766f5a208614b3eb59b5652d58f8497fb46dc1b1c021a489e163985c2a96b7f114c8216693de796494aac65b43db932938e87635ce700b841429d71c4ad42347f9e2db322a78e13826766749f4b4140c4405bef17cd4c3de417af659c65da243de100658a09cd4835ce20bbce43b7be7c547115f8051a6afb01b841c42eaceeced0fc5a3fe4acb23fc986684d9eb3d9b6a4d601b6956c5095faf6792dcc1439c673127405a9f5a09a033d93ff66abaea0d55060bfc3811aba4c799c0180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841f4f31c1fd0ed03858c7197dd53baac983c8c21b3b98434fc2c6016da3925437e6de3e98a679b511ef41299ffa6447a630bc8c0997e1408c2ce84fffb3c7df78701c0f86994d23cf44b862ba86703f11f6e94a4a833f4fe224494b51df3658799cccb48c172d54e3bc89649f04eb49480f489a673042c2e5f17e5b2a5e49d71bf0611a4946f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b26149410982668af23d3e4b8d26805543618412ac724d4d594b51df3658799cccb48c172d54e3bc89649f04eb4";
  const block452Encoded =
    "0xf90381a0c178c4c82b2275dd626de328b7aff22d78e7e2f5bbda279e9d388101a4c20a59a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347946f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b2614a09e6cdf2b4a731bc0b148f2eb971bfdbb06d0962e4d3bf84a36574e62fe1b5e00a0d03f0e8f32608926478fe87f5d0ababf12a4ad1c13ccc08dd7553fe3ff52c04aa0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c4841908b100808464d69623b9014202f9013e820236f90138e7a0c178c4c82b2275dd626de328b7aff22d78e7e2f5bbda279e9d388101a4c20a598202358201c3f9010cb84172b87d52050ac6544c0d979ec6b09ec3a98d5bfee46e8d1e544eabc0113642805c7adce050909c5b05b780b95b753c9f85659f84fdf24b88ff10797f2d1cb09a00b8414ad2069d315be8998b28bc62a23ae0be9df4027275348678938044bc2ac0251320df45e9147add4b124331b6f1c7aa83b6d8b45e950d459f64309c0840c4732901b8416909e6c9e4b6a8c536394d68f449e7c85676bec25907714ed513122701b5ed9946254f9446ea2bd30b103840eaa220ebbe67e07877d8a405990a9283ac23c77c01b841a1c4d312b14e9b437b38f93615dc38c3a5a778e305cdeea8cf2e8c41733770f61a9e252b7cb125a01edb654d5ebb8e383330642366b8cdd4d38d7a9a833e43dc0080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8410accee86d54565312cafcaefd160523a2508b616f6680209a9cd584371cc26673e344e81e6c842575b95ea07ce441e481f3ae58c327b43d938ff8d80736b493501c0c0c0";
  const block453Encoded =
    "0xf90381a0fb3ae2af16bdbccd49661afd1961b34750a218ba8ac8db4091948e9b1afec4eba01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479480f489a673042c2e5f17e5b2a5e49d71bf0611a4a09e6cdf2b4a731bc0b148f2eb971bfdbb06d0962e4d3bf84a36574e62fe1b5e00a0f0a336f1c768b881bf5a93d91b02bb6f001196e6fe70e25ab3c21e618fe260f5a0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c5841908b100808464d69625b9014202f9013e820237f90138e7a0fb3ae2af16bdbccd49661afd1961b34750a218ba8ac8db4091948e9b1afec4eb8202368201c4f9010cb841e107247867e30ab441ad994ff19a67c764c603b4b9845df5f8494e201c749c6a452350f8079c9d84a8a09cf327f017b79302df5c2351aa009c8a1e0a69f8a15701b8414e6abed59bb35ab724bad51b4f0f4474333c0fcdc9226a0ffa204d0b6546ec9a4d9b16cef43ef8ec393f12993b06aef1b7a677de2b675ee1f93dbc954c145bd301b8411f0366b1c14948b25a879a4e64e04e77b65131851f0400770e2e62ee6d6f37245cd3a6bb6eb50a07deaaecc2ff4b4afd6574194c7e8a3eec294f35796bb4f93100b84152543e3b8f210f3c9a2f8dd46fb84cd0ad20ae11aedcceafc92bf59b93991a47059ee6922e8cdf340797caa16a2eba3df2a7e710dbcac8ad2009c530caff9a650180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b84176fad2c81b0feaac6ee233be649b692cd4cd88532e2b4bdc8f8dbb2ce67583742da603bacb721de45cfddabf0bf7d0502c77b85e7fd5c1f362064a104c8bd88400c0c0c0";
  const block454Encoded =
    "0xf90381a02012b98fd7048f37c76dc1f3ea93596a4256dcd04a583d2505a405f539e1ce9ea01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794d23cf44b862ba86703f11f6e94a4a833f4fe2244a09e6cdf2b4a731bc0b148f2eb971bfdbb06d0962e4d3bf84a36574e62fe1b5e00a092f99544ffc32f7f44c697ebfe14b3ff1f7453318dbee36faee56f2741b43a1da0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c6841908b100808464d69631b9014202f9013e820239f90138e7a02012b98fd7048f37c76dc1f3ea93596a4256dcd04a583d2505a405f539e1ce9e8202378201c5f9010cb8417fb1edff1d73b1e6cd4ffb9c0110fee6d007d7f6dcd8dad62678c68eaa6fff3461dfed223b27ca14b76e962a40df3ba48e7aa9ee2bac883a22d52606b4ff206a00b841468756f60362d67ae5ae847b92129700e1aae2b14e79f732ea81f762a08e472f30f11a0c46764aa813e2ba3ab5f441f28b8687926f3ac6ad1937c6f1f168020600b841151afe6fe815d37359d1d2df5ece00ffb61f9c5b823ad1fac5757ac3cfc2407e7414b0e5bd6e26be9929be63e379a94b61d243397e0d13658cfb3c0aa2cd563e00b84142aed3a3016ec599a53653d84baf43e34bd4ccfbfb1d76943a6c2440c89c918d6716afd5a27ffc70f05bf1139c5c7d720d181e26544d68177709a87a574a16690180a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b8416b32c2d0b12a76256bb4b7c179f1acf1bc3b8c0ba390e6d8e86de8c541b914db430dce8948925c3a52b3a1930cd9c9a6b9c236098bc914b145f58fd972bc179f00c0c0c0";
  const block455Encoded =
    "0xf90381a0ba002d045dd532062e1bc4775e9d97b64c19458d24d99c224182d423af38f838a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479410982668af23d3e4b8d26805543618412ac724d4a09e6cdf2b4a731bc0b148f2eb971bfdbb06d0962e4d3bf84a36574e62fe1b5e00a0701868079efa449ccf7da5408d2d9ae609f343e8dab595519677d1ada6ba39cda0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c7841908b100808464d69633b9014202f9013e82023af90138e7a0ba002d045dd532062e1bc4775e9d97b64c19458d24d99c224182d423af38f8388202398201c6f9010cb84166772e2eec5a596c6452dbd4566e5b31995ac5d6899a1eb234d2aba3c469b51711472bc487fa54d0c3fb596cdb3e3a31475a80165a4570d1915331ff8a99996100b841abc2f606121bc9eecd290c5d07303c0cd7fafdb1c7e6d2b5bc8d8914d18e38313f795246151c20808530cbc7bbe76e6a3b1a40936732017a9f8ef2f4e9401eda01b841f762137334838c4c7dace2b592b8e60a9293e49fd4226fde20b484a0b9fc1fd63d3e66ebf56f2d208e0d937445e80826ce942efa4b81ef7becbdf6f000177fb701b841d3b23ca35ce62fd2d5c1e59887d4dcce0110bfcb0c45e57b68eaa29e4700aec872b202beab2a903c7f9892fb46f01eb931aaf3ab467beae10a928bc30f8c8e5e0080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841defcd6d7bdd69fdc78f400aca53285e99eaae07654c6e9dca247a4dd208122db11c0e2da52572f494efa47bdff2b61e1a3e7c5b78ae24145ac2fbbcfc5cb237601c0c0c0";
  const block456Encoded =
    "0xf90381a0feb6d069a10000a1f81ee0d2c2ab81031ddd579e717aa14d2f8461cc6adcb01ba01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347946f3c1d8ba6cc6b6fb6387b0fe5d2d37a822b2614a09e6cdf2b4a731bc0b148f2eb971bfdbb06d0962e4d3bf84a36574e62fe1b5e00a0d03f0e8f32608926478fe87f5d0ababf12a4ad1c13ccc08dd7553fe3ff52c04aa0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c8841908b100808464d69635b9014202f9013e82023bf90138e7a0feb6d069a10000a1f81ee0d2c2ab81031ddd579e717aa14d2f8461cc6adcb01b82023a8201c7f9010cb841c233c177f25a754187a56c5c8801ef0900ec8dca13bf1be8f8931b26271a781d366fed0010283a45ef01d3ee9463ad1181f9327d7b1491a679dcf15160921dec00b841a09bafa55fdce2ff4644ec9b630e1e6e3c505b15c332810009a31c3345961d5d32728ffd3858967023b1e1162d12649ff002b6674cd771b7fa8bae0725af0ed900b841b75d7c00c596dcbf753b76788cb8ed3ae5d13cf9b67571152129baf4b4f2863340603f0fa791d3baf4c8f92c2c6a64ec14f06b2084c561d3920183d8e27c1e6901b841c4f6632f9847a9e4d76fc9fcf855c2a3e57a662fd26ad2cc8acd71b1b573e46a6cd83dd12187c2ef169b226909e129548d0e270121ae27c6aa0c42d99d73157c0080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841562942ded2ccf31f72fece554f9adc1c3c6949c1f943ddcad40e9c062caf3b897503c483890043829457a7325d0038b5b6f80a7aa81a5dd8acae99eee3c0e55a00c0c0c0";
  const block457Encoded =
    "0xf90381a066b831a1a252d8427782f5a1f656f70b4e5e36b57e181e1d3b8f64b758dd02a0a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479480f489a673042c2e5f17e5b2a5e49d71bf0611a4a09e6cdf2b4a731bc0b148f2eb971bfdbb06d0962e4d3bf84a36574e62fe1b5e00a0f0a336f1c768b881bf5a93d91b02bb6f001196e6fe70e25ab3c21e618fe260f5a0bcd2a51669cdca54e5f28517bcd09ca95007951a7d7ec181cb3f361f783cde4ab9010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000018201c9841908b100808464d69638b9014202f9013e82023cf90138e7a066b831a1a252d8427782f5a1f656f70b4e5e36b57e181e1d3b8f64b758dd02a082023b8201c8f9010cb84122c45285b2bf249b6534b6443b304aa772dfa291c8c30e389cfc313f62c1bbda07d9484725431e7e64437ebfd9d20632e8e5ceae800027404131c5ef75c9c6da01b841521c3d069c5e1c9e681a1f8785987c6a8074f6408debe0ca0a26b075add207cc516dd9c4e6f8086cecc5ce44a6d3ef051c169383beb0c71100aabdd9de7e2d5201b841467ad3f2b3ee748caab3b26b4cce752d4e8acf46d2d5135a53ea243a85f719f531ec2defcc30414846053ff560f760a0fdfeba2ffc477a2e8137913aef8a84a601b8418c4ff65a70d60b28d04df802520d78101b179b250e3b0c9efa31c89a0947690e1b1cfc83a9e105bc26551fbdd8b2200105d5600ffaf8958e9ba0c17c9bdd1b780080a00000000000000000000000000000000000000000000000000000000000000000880000000000000000b841a9360fd924b91df0e3f502311c27261c53d001242edc2e2982e3defc7833817f6d7e933050f65603db4b3b7e69a99862c540638bcb3ae725b10b7352d605e3ac00c0c0c0";
  let liteCheckpoint;
  let custom;
  let customValidators;
  let customBlock0;
  let customeBlock1;

  const fixture = async () => {
    const factory = await ethers.getContractFactory("LiteCheckpoint");
    const liteCheckpoint = await factory.deploy();
    await liteCheckpoint.init(
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
    const custom = await factory.deploy();
    await custom.init(
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
      expect(block2Resp["roundNum"]).to.eq(565);
      expect(block2Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock2Resp["sequence"]).to.eq(0);
      expect(unBlock2Resp["lastRoundNum"]).to.eq(565);
      expect(unBlock2Resp["lastNum"]).to.eq(451);
    });
    it("receive new header which has only the next and committed", async () => {
      await liteCheckpoint.receiveHeader([
        block451Encoded,
        block452Encoded,
        block453Encoded,
        block454Encoded,
        block455Encoded,
        block456Encoded,
        block457Encoded,
      ]);
      const block2Hash = blockToHash(block451Encoded);
      const block2Resp = await liteCheckpoint.getHeader(block2Hash);

      const unBlock2Resp = await liteCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(block2Resp["number"]).to.eq(451);
      expect(block2Resp["roundNum"]).to.eq(565);
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
      expect(block2Resp["roundNum"]).to.eq(565);
      expect(block2Resp["mainnetNum"]).to.eq(-1);
      expect(unBlock2Resp["sequence"]).to.eq(1);
      expect(unBlock2Resp["lastRoundNum"]).to.eq(566);
      expect(unBlock2Resp["lastNum"]).to.eq(452);

      await liteCheckpoint.commitHeader(block2Hash, [
        block453Encoded,
        block454Encoded,
        block455Encoded,
        block456Encoded,
        block457Encoded,
      ]);

      const committedBlock2Resp = await liteCheckpoint.getHeader(block2Hash);
      const committedUnBlock2Resp = await liteCheckpoint.getUnCommittedHeader(
        block2Hash
      );

      expect(committedBlock2Resp["number"]).to.eq(451);
      expect(committedBlock2Resp["roundNum"]).to.eq(565);
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
        customValidators,
        2,
        next.map((item) => item.address),
        []
      );

      await custom.receiveHeader([
        block6Encoded,
        block7Encoded,
        block8Encoded,
        block9Encoded,
      ]);

      await custom.receiveHeader([block10Encoded]);
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
        customValidators,
        2,
        actualValidators.map((item) => item.address),
        []
      );

      await custom.receiveHeader([
        block6Encoded,
        block7Encoded,
        block8Encoded,
        block9Encoded,
      ]);

      await custom.receiveHeader([block10Encoded]);

      const currentValidators = await custom.getCurrentValidators();
      expect(currentValidators[0]).to.deep.eq(
        actualValidators.map((item) => item.address)
      );
    });
  });
});
