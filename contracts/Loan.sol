// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Verifiable} from "./Verifiable.sol"

contract LoanContract is Verifiable {

    struct Loan {
        address borrower;
        address lender;
        address token;
        uint256 amount;
        uint256 interest;
        uint256 dueDate;
        bool funded;
        bool repaid;
    }
    mapping(uint256 => Loan) public loans;
    uint256 public loanCount;

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed lender,
        address token,
        uint256 amount,
        uint256 interest,
        uint256 dueDate
    );

    event LoanFunded(
        uint256 indexed loanId,
        address indexed lender,
        uint256 amount
    );

    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount
    );

    
}
