// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// This interface remains unchanged, providing a standard way to interact with loans.
interface ILoan {
    function fundLoan() external;
    function state() external view returns (address borrower, address lender, uint256 principal, uint256 interestBps, uint256 dueDate, bool isFunded, bool isRepaid);
}

/**
 * @title LoanBase
 * @notice An abstract base contract with a unified initializer for all loan types.
 * @dev Contains shared state, modifiers, and a generic initializer for the proxy pattern.
 */
abstract contract LoanBase is Initializable, Ownable2StepUpgradeable, ReentrancyGuardUpgradeable, ILoan {
    // --- Shared State Variables ---
    address public borrower;
    address public lender;
    IERC20 public token;
    uint256 public principalAmount;
    uint256 public interestBps;
    address public marketContract;
    bool public isFunded;
    bool public isRepaid;

    // --- State for Specific Loan Types ---
    uint256 public dueDate; // Used by CreditLoan (and as final due date for PersonalLoan)
    uint256 public numberOfPayments; // Used by PersonalLoan (Installment)
    uint256 public paymentInterval; // Used by PersonalLoan (Installment)

    // --- Modifiers ---
    modifier onlyBorrower() {
        require(msg.sender == borrower, "LB: Caller is not the borrower");
        _;
    }

    modifier onlyLender() {
        require(msg.sender == lender, "LB: Caller is not the lender");
        _;
    }

    modifier notFunded() {
        require(!isFunded, "LB: Loan already funded");
        _;
    }

    /**
     * @notice A single, unified initializer for all loan contracts.
     * @param _dueDate Used by CreditLoan for its maturity date.
     * @param _numberOfPayments Used by PersonalLoan for its installment schedule.
     * @param _paymentInterval Used by PersonalLoan for its installment schedule.
     */
    function initialize(
        address _borrower,
        address _lender,
        IERC20 _token,
        uint256 _principal,
        uint256 _interestBps,
        uint256 _dueDate,
        uint256 _numberOfPayments,
        uint256 _paymentInterval,
        address _marketContract
    ) public virtual initializer {
        __Ownable_init_unchained(_marketContract);
        __ReentrancyGuard_init();

        borrower = _borrower;
        lender = _lender;
        token = _token;
        principalAmount = _principal;
        interestBps = _interestBps;
        dueDate = _dueDate;
        numberOfPayments = _numberOfPayments;
        paymentInterval = _paymentInterval;
        marketContract = _marketContract;
    }

    /**
     * @notice Returns the core state of the loan.
     */
    function state() external view override returns (address, address, uint256, uint256, uint256, bool, bool) {
        return (borrower, lender, principalAmount, interestBps, dueDate, isFunded, isRepaid);
    }
}
