import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export const ProxyModule = buildModule("ProxyModule", (m) => {
  // 1) Deploy your logic (implementation)
  const loanMarketImpl   = m.contract("LoanMarket");
  const personalLoanImpl = m.contract("PersonalLoan");
  const creditLoanImpl   = m.contract("CreditLoan");
//   const verifierAddr     = m.getParameter("verifierAddress");
    const verifierAddr     = "0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c";

  // 2) Encode the initialize(...) call against your logic
  const initialize = m.encodeFunctionCall(
    loanMarketImpl,
    "initialize",
    [personalLoanImpl, creditLoanImpl, verifierAddr]
  );

  // 3) Deploy the ERC1967Proxy, pointing to your logic and init data
  const proxy = m.contract("ERC1967Proxy", [
    loanMarketImpl,
    initialize,
  ]);

  return { proxy, loanMarketImpl, personalLoanImpl, creditLoanImpl };
});
