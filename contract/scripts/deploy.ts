import { upgrades, ethers  } from "hardhat";

async function main() {
  const universalVerifierAddressAmoy = "0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c"; // Replace with actual Amoy UniversalVerifier address if different

  const LoanContractFactory = await ethers.getContractFactory("LoanMarket");

  console.log("Deploying LoanContract (upgradeable)...");
  const loanContractProxy = await upgrades.deployProxy(
    LoanContractFactory,
    [universalVerifierAddressAmoy], // Arguments for your initialize function
    {
      initializer: "initialize", // Name of your initialize function
      kind: "uups", // Or "transparent". UUPS is generally recommended for new projects.
    }
  );

  await loanContractProxy.waitForDeployment();
  const proxyAddress = await loanContractProxy.getAddress();

  console.log("LoanContract Proxy deployed to:", proxyAddress);

  // You can also get the implementation address if needed
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("LoanContract Implementation deployed to:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });