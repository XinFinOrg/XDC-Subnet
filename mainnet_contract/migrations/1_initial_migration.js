const Migrations = artifacts.require("Migrations");
const RLPEncode = artifacts.require("TestingWrapper");

module.exports = function (deployer) {
  deployer.deploy(Migrations);
  deployer.deploy(RLPEncode);
};
