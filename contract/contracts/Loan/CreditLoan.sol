// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LoanBase.sol";
import "./InterestCalculator.sol";

/**
 * @title CreditLoan
 * @notice A revolving line of credit where a borrower can draw and repay flexibly.
 * @dev Uses the InterestCalculator library for clean, reusable logic.
 */
contract CreditLoan is LoanBase {
    uint256 public outstandingBalance;
    uint256 public lastAccrualTimestamp;

    event LoanActivated(address indexed lender, uint256 creditLimit);
    event FundsDrawn(address indexed borrower, uint256 amount);
    event FundsRepaid(address indexed borrower, uint256 amount);
    
    /**
     * @notice Lender activates the credit line.
     */
    function fundLoan() external override onlyLender notFunded {
        isFunded = true;
        lastAccrualTimestamp = block.timestamp;
        emit LoanActivated(lender, principalAmount);
    }

    /**
     * @notice Accrues interest on the outstanding balance by calling the library.
     */
    function accrueInterest() public {
        if (outstandingBalance == 0) {
            lastAccrualTimestamp = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - lastAccrualTimestamp;
        
        uint256 interest = InterestCalculator.calculateAccruedInterest(
            outstandingBalance,
            interestBps,
            timeElapsed
        );

        outstandingBalance += interest;
        lastAccrualTimestamp = block.timestamp;
    }

    /**
     * @notice Borrower draws funds from their available credit limit.
     */
    function draw(uint256 amount) external onlyBorrower nonReentrant {
        require(isFunded, "CL: Credit line not active");
        require(block.timestamp <= dueDate, "CL: Credit line has expired");

        accrueInterest();

        uint256 availableCredit = principalAmount - outstandingBalance;
        require(amount <= availableCredit, "CL: Draw amount exceeds available credit");

        outstandingBalance += amount;
        
        require(token.transferFrom(lender, borrower, amount), "CL: Draw transfer failed");

        emit FundsDrawn(borrower, amount);
    }

    /**
     * @notice Borrower repays part or all of their outstanding balance.
     */
    function repay(uint256 amount) external onlyBorrower nonReentrant {
        require(isFunded, "CL: Credit line not active");
        
        accrueInterest();
        
        require(amount <= outstandingBalance, "CL: Repayment exceeds outstanding balance");

        outstandingBalance -= amount;

        if (block.timestamp > dueDate && outstandingBalance == 0) {
            isRepaid = true;
        }
        
        require(token.transferFrom(borrower, lender, amount), "CL: Repayment transfer failed");
        
        emit FundsRepaid(borrower, amount);
    }

    function getAvailableCredit() public view returns (uint256) {
        return principalAmount - outstandingBalance;
    }
}
