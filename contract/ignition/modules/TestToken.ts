import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export const TestTokenModule = buildModule("TestTokenModule", (m) => {
  const testToken   = m.contract("TestToken");
  
  return {testToken};
});
