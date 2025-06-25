import hre from "hardhat";
import { ethers } from "hardhat";

async function main() {
  const loanMarketAddress = "0xfa29a89b64d8f96732d21d1e67f6b7016e093dc9"; // Replace with your actual loan market address
  const LoanMarket = await ethers.getContractAt("LoanMarket", loanMarketAddress);

  console.log(await LoanMarket.owner());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
