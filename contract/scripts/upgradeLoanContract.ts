    import { ethers, upgrades } from "hardhat";

    async function main() {
      // The address of the deployed LoanContract proxy you want to upgrade
      const PROXY_ADDRESS = "0xYourDeployedLoanContractProxyAddress"; // <<< REPLACE THIS

      if (!PROXY_ADDRESS || PROXY_ADDRESS === "0xYourDeployedLoanContractProxyAddress") {
        console.error("Please replace 0xYourDeployedLoanContractProxyAddress with the actual proxy address of your LoanContract.");
        process.exit(1);
      }

      // Get the ContractFactory for the NEW version of your contract
      const LoanContractV2Factory = await ethers.getContractFactory("LoanContractV2"); // <<< Assuming your new version is LoanContractV2

      console.log(`Upgrading LoanContract at proxy: ${PROXY_ADDRESS} to LoanContractV2...`);

      // The upgradeProxy function will:
      // 1. Deploy the new implementation contract (LoanContractV2).
      // 2. Call the proxy to change its implementation address to the new one.
      // It does NOT call any initializer function by default during an upgrade.
      const loanContractV2Proxy = await upgrades.upgradeProxy(PROXY_ADDRESS, LoanContractV2Factory);

      await loanContractV2Proxy.waitForDeployment(); // This waits for the upgrade transaction to be mined

      const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(
        await loanContractV2Proxy.getAddress()
      );

      console.log(`LoanContract successfully upgraded at proxy: ${await loanContractV2Proxy.getAddress()}`);
      console.log(`New implementation address: ${newImplementationAddress}`);

      // If your V2 contract has a new function you want to call immediately after upgrade (e.g., a setup function for new state):
      // const loanContractV2 = LoanContractV2Factory.attach(await loanContractV2Proxy.getAddress()) as LoanContractV2; // Cast to your V2 type
      // await loanContractV2.someNewSetupFunctionForV2();
      // console.log("Called someNewSetupFunctionForV2 on the upgraded contract.");
    }

    main()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
    