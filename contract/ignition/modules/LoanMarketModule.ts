import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ProxyModule } from "./ProxyModule";

export const LoanMarketModule = buildModule("LoanMarketModule", (m) => {
  const { proxy } = m.useModule(ProxyModule);

  const loanMarket = m.contractAt("LoanMarket", proxy, {id: "LoanMarketProxy"});

  return { loanMarket };
});
export default LoanMarketModule;
