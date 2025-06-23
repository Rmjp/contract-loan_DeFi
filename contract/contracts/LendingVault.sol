// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {UniversalVerifier} from "./UniversalVerifier/verifiers/UniversalVerifier.sol";
import {ILoan} from "./Loan/interface/ILoan.sol";

/// @title LendingVault
/// @notice Simple ERC4626 vault that acts as a lender for Loan contracts.
///         Anyone can deposit assets and receive shares representing their
///         portion of the vault. The vault owner can fund loans and when
///         borrowers repay, the profits are shared by all depositors
///         through an increased share value.
contract LendingVault is ERC4626, Ownable {
    UniversalVerifier public verifier;
    uint64 public depositRequestId;

    /// @param asset_ The ERC20 token that the vault accepts and lends out
    /// @param verifierAddress The address of the UniversalVerifier contract
    constructor(ERC20 asset_, address verifierAddress)
        ERC20("Vault Share", "vSHARE")
        ERC4626(asset_)
        Ownable(msg.sender)
    {
        require(verifierAddress != address(0), "LV: verifier zero");
        verifier = UniversalVerifier(verifierAddress);
    }

    function setDepositRequestId(uint64 requestId) external onlyOwner {
        depositRequestId = requestId;
    }

    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override {
        if (depositRequestId != 0) {
            UniversalVerifier.ProofStatus memory status =
                verifier.getProofStatus(receiver, depositRequestId);
            require(status.isVerified, "LV: receiver not verified");
        }
        super._deposit(caller, receiver, assets, shares);
    }

    /// @notice Funds a loan using assets held by the vault. The vault must be
    ///         the lender of the loan contract.
    /// @param loan The loan contract to fund
    function fundLoan(ILoan loan) external onlyOwner {
        (, , uint256 principal, , , , ) = loan.state();
        require(principal <= totalAssets(), "LV: insufficient assets");
        IERC20(asset()).approve(address(loan), principal);
        loan.fundLoan();
    }
}
