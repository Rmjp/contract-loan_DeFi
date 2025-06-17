import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ProxyModule } from "./ProxyModule";

export default buildModule("LoanMarketUpgradeModule", (m) => {
  const deployer = m.getAccount(0);
  const { proxy } = m.useModule(ProxyModule);

  // 1) Deploy the new logic
  const loanMarketV2 = m.contract("LoanMarketV2");

  // 2) Call the UUPS upgrade function on the proxy
  const proxyAsUpgradable = m.contract("ERC1967Proxy", proxy);
  m.call(proxyAsUpgradable, "upgradeToAndCall", [
    loanMarketV2,
    "0x",           // or new init data
  ], { from: deployer.address });

  return { loanMarketV2 };
});
