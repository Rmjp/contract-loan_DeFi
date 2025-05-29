import { viem } from "hardhat";

async function main() {
  console.log("Deploying TestToken...");

  // Get the wallet client for deployment
  const [deployer] = await viem.getWalletClients();

  // Deploy the contract
  const contract = await viem.deployContract("TestToken");
  
  console.log("TestToken deployed to:", contract);
  console.log("Initial supply minted to deployer:", deployer.account.address);

  const tx = await contract.write.transfer([
    "0xC565eA25F263150F3a5ECf764847a9E99F166A47",
    BigInt(1000) * BigInt(10) ** BigInt(18)
  ]);

  console.log(`Sent 1,000 TEST to ${"0xC565eA25F263150F3a5ECf764847a9E99F166A47"}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 