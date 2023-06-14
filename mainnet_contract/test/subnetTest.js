describe("Greeter", function () {
  it("Should return the new greeting once it's changed", async function () {
    const Greeter = await ethers.getContractFactory("MintBot");
    const greeter = await Greeter.deploy();

    await greeter.deployed();
    await greeter.mint(100);
  });
});
