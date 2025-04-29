async function main() {
    const MyToken = await ethers.getContractFactory("MyToken");
    const token = await MyToken.deploy();
    await token.deployed();
    console.log(`MyToken deployed to: ${token.address}`);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });