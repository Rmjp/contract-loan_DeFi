// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Verifiable} from "./Verifiable.sol";

contract LoanContract is Verifiable {

    struct LenderOffer {
        address lender;
        uint256 amount;
        uint256 interest;
    }

    struct Loan {
        address borrower;
        address lender;
        LenderOffer[] lender_offers;
        uint256 amount_request;
        uint256 amount;
        uint256 interest;
        uint256 dueDate;
        bool funded;
        bool repaid;
    }

    struct Lender {
        address addr;
        uint256[] loans;
        address[] verify_proofs;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public loanCount;
    mapping(address => Lender) public lenders;

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

    event LoanRequestApproved(
      uint256 indexed loanId,
      address indexed lender,
      uint256 interestOffered
    );

    event LoanRequestRejected(
      uint256 indexed loanId,
      address indexed lender
    );

    function registerLender() public {
        require(!lenders[msg.sender].addr);
        
        lenders[msg.sender].addr = msg.sender;
    }

    function addVerify(address verify_proof) public {
        require(!lenders[msg.sender].addr);
        lenders[msg.sender].verify_proofs.push(verify_proof);
    }
    
    /**
     * @dev Get loan count of a given lender. 
     */
    function getLenderLoans(address _lenderAddr) public view returns (uint256[] memory ) {
        Lender storage lender = lenders[_lenderAddr];
        
        return lender.loans;
    }

    function requestLoan(uint256 amount_request) public {
        
    }
    
}
