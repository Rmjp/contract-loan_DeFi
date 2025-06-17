import hre from "hardhat";
import type { Contract } from "ethers";
import { ProxyModule } from "../ignition/modules/ProxyModule";

async function main() {
  // 1) Provide the verifier address for initialization
  const verifierAddress = "0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c";

  // 2) Deploy Proxy + LoanMarket via Ignition
  const deployment_proxy = await hre.ignition.deploy(ProxyModule, {
    parameters: { ProxyModule:{"verifierAddress":verifierAddress} },
  });
  // const deployment = await hre.ignition.deploy(LoanMarketModule);

  console.log("Deployment started...");

  // 3) Extract deployed instances
  const { proxy, loanMarketImpl, personalLoanImpl, creditLoanImpl  } = deployment_proxy;
  const loanMarketContract = await hre.ethers.getContractAt("LoanMarket", proxy.address);

  // 4) Log addresses and state
  console.log("=== Deployment Results ===");
  console.log("LoanMarket address: ", loanMarketContract.target);
  console.log("Proxy address: ", proxy.address);
  console.log("LoanMarket implementation address: ", loanMarketImpl.address);
  console.log("PersonalLoan implementation address: ", personalLoanImpl.address);
  console.log("CreditLoan implementation address: ", creditLoanImpl.address);
  console.log("get all functions: ", await loanMarketContract.verifier());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
