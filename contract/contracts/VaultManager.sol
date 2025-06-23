// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LendingVault} from "./LendingVault.sol";
import {ILoan} from "./Loan/interface/ILoan.sol";

/// @title VaultManager
/// @notice Admin contract to deploy and manage LendingVaults.
contract VaultManager is Ownable {
    /// @dev Array of all deployed vaults
    LendingVault[] public vaults;

    event VaultCreated(uint256 indexed id, address vault, address asset);

    constructor() Ownable(msg.sender) {}

    /// @notice Deploy a new LendingVault for a given asset and verifier
    function createVault(
        ERC20 asset,
        address verifier,
        uint64 requestId
    ) external onlyOwner returns (uint256 id, address vaultAddr) {
        LendingVault vault = new LendingVault(asset, verifier);
        vault.setDepositRequestId(requestId);
        id = vaults.length;
        vaults.push(vault);
        emit VaultCreated(id, address(vault), address(asset));
        return (id, address(vault));
    }

    /// @notice Deposit assets into a managed vault
    function deposit(uint256 vaultId, uint256 assets) external {
        require(vaultId < vaults.length, "VM: invalid id");
        LendingVault vault = vaults[vaultId];
        ERC20 token = ERC20(vault.asset());
        require(token.transferFrom(msg.sender, address(this), assets), "VM: transfer failed");
        require(token.approve(address(vault), assets), "VM: approve failed");
        vault.deposit(assets, msg.sender);
    }

    /// @notice Withdraw shares from a managed vault
    function withdraw(uint256 vaultId, uint256 shares) external {
        require(vaultId < vaults.length, "VM: invalid id");
        LendingVault vault = vaults[vaultId];
        vault.redeem(shares, msg.sender, msg.sender);
    }

    /// @notice Fund a loan using one of the managed vaults
    function fundLoan(uint256 vaultId, ILoan loan) external onlyOwner {
        require(vaultId < vaults.length, "VM: invalid id");
        LendingVault vault = vaults[vaultId];
        vault.fundLoan(loan);
    }

    /// @return count Number of vaults deployed
    function vaultCount() external view returns (uint256 count) {
        return vaults.length;
    }
}
