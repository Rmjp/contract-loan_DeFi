import { viem } from "hardhat";

async function main() {
  console.log("Deploying LoanContract...");

  // Get the wallet client for deployment
  const [deployer] = await viem.getWalletClients();

  // Deploy the contract
  const contract = await viem.deployContract("LoanContract");
  
  console.log("LoanContract deployed to:", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 