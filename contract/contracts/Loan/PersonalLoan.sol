// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LoanBase.sol";
import "./InterestCalculator.sol";

/**
 * @title PersonalLoan
 * @notice A loan with fixed, scheduled installment payments over a term.
 * @dev This contract now inherits its initializer directly from LoanBase.
 */
contract PersonalLoan is LoanBase {
    // --- State Variables for Installments ---
    uint256 public installmentAmount;
    uint256 public paymentsMade;
    uint256 public nextDueDate;
    
    // --- Events ---
    event LoanFunded(address indexed lender, address indexed borrower, uint256 amount, uint256 installmentAmount);
    event PaymentMade(address indexed borrower, uint256 paymentNumber, uint256 amount);
    event LoanSettled(address indexed borrower);

    // NOTE: No custom initializer is needed. It uses the one from LoanBase.

    /**
     * @notice Lender sends the principal to the borrower and activates the loan schedule.
     */
    function fundLoan() external override onlyLender notFunded {
        isFunded = true;
        nextDueDate = block.timestamp + paymentInterval;
        
        installmentAmount = InterestCalculator.calculateInstallmentPayment(
            principalAmount,
            interestBps,
            numberOfPayments,
            paymentInterval
        );
        
        require(token.transferFrom(lender, borrower, principalAmount), "PL: Funding transfer failed");

        emit LoanFunded(lender, borrower, principalAmount, installmentAmount);
    }

    /**
     * @notice Borrower makes a scheduled installment payment.
     */
    function makeInstallmentPayment() external onlyBorrower nonReentrant {
        require(isFunded, "PL: Loan not funded");
        require(paymentsMade < numberOfPayments, "PL: All payments already made");
        require(block.timestamp <= nextDueDate, "PL: Payment is past due");

        uint256 interestPortion = InterestCalculator.calculateAccruedInterest(
            principalAmount, 
            interestBps, 
            paymentInterval
        );

        uint256 principalPortion = installmentAmount > interestPortion 
            ? installmentAmount - interestPortion 
            : 0;

        paymentsMade++;
        
        if (paymentsMade == numberOfPayments) {
            principalAmount = 0;
            isRepaid = true;
            emit LoanSettled(borrower);
        } else {
            principalAmount -= principalPortion;
            nextDueDate += paymentInterval;
        }

        require(token.transferFrom(borrower, lender, installmentAmount), "PL: Payment transfer failed");
        
        emit PaymentMade(borrower, paymentsMade, installmentAmount);
    }
}
