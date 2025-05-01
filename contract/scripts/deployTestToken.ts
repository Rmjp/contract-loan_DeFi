import { viem } from "hardhat";

async function main() {
  console.log("Deploying TestToken...");

  // Get the wallet client for deployment
  const [deployer] = await viem.getWalletClients();

  // Deploy the contract
  const contract = await viem.deployContract("TestToken");
  
  console.log("TestToken deployed to:", contract);
  console.log("Initial supply minted to deployer:", deployer.address);

  const tx = await contract.write.transfer([
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    BigInt(1000) * BigInt(10) ** BigInt(18)
  ]);

  console.log(`Sent 1,000 TEST to ${"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 