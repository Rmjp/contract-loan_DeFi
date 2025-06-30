import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export const VaultManagerModule = buildModule("VaultManagerModule", (m) => {
  const vaultManager = m.contract("VaultManager");

  return { vaultManager };
});

export default VaultManagerModule;
