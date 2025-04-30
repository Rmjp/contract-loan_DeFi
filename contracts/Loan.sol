// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Verifiable, VP } from "./Verifiable.sol";

contract LoanContract is Verifiable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Offer {
        address lender;
        uint256 interestOffered;
    }

    struct Loan {
        address borrower;
        address lender;
        IERC20 token;
        uint256 amountRequested;
        uint256 interest;       // chosen interest rate
        uint256 dueDate;
        bool funded;
        bool repaid;
        Offer[] offers;         // offers from multiple lenders
    }

    struct Lender {
        bool registered;
        address[] verifyProofs;
        uint256[] fundedLoans;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public loanCount;

    mapping(address => Lender) private lenders;

    // --- Events ---
    event LenderRegistered(address indexed lender);
    event ProofContractAdded(address indexed lender, address proofContract);

    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed token,
        uint256 amountRequested,
        uint256 maxInterest,
        uint256 dueDate
    );
    event LoanOfferSubmitted(uint256 indexed loanId, address indexed lender, uint256 interestOffered);
    event LoanOfferAccepted(uint256 indexed loanId, address indexed lender, uint256 interestChosen);
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 amountFunded);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalRepaid);

    // --- Access modifiers ---
    modifier onlyRegisteredLender() {
        require(lenders[msg.sender].registered, "Not a lender");
        _;
    }

    modifier onlyBorrower(uint256 loanId) {
        require(loans[loanId].borrower == msg.sender, "Only borrower");
        _;
    }

    // --- Lender API ---
    function registerLender() external {
        require(!lenders[msg.sender].registered, "Already registered");
        lenders[msg.sender].registered = true;
        emit LenderRegistered(msg.sender);
    }

    function addVerifyProof(address proofContract) external onlyRegisteredLender {
        lenders[msg.sender].verifyProofs.push(proofContract);
        emit ProofContractAdded(msg.sender, proofContract);
    }

    function getFundedLoans(address lenderAddr) external view returns (uint256[] memory) {
        return lenders[lenderAddr].fundedLoans;
    }

    // --- Borrower API ---
    function requestLoan(
        IERC20 token,
        uint256 amountRequested,
        uint256 maxInterest,
        uint256 dueDate
    ) external returns (uint256) {
        require(amountRequested > 0, "Invalid amount");
        require(dueDate > block.timestamp, "Due date in past");

        loanCount++;
        Loan storage ln = loans[loanCount];
        ln.borrower = msg.sender;
        ln.token = token;
        ln.amountRequested = amountRequested;
        ln.interest = maxInterest;
        ln.dueDate = dueDate;

        emit LoanRequested(loanCount, msg.sender, address(token), amountRequested, maxInterest, dueDate);
        return loanCount;
    }

    function submitOffer(
        uint256 loanId,
        VP calldata vp,
        uint256 interestOffered
    ) external onlyRegisteredLender {
        Loan storage ln = loans[loanId];
        require(ln.borrower != address(0), "Loan not found");
        require(!ln.funded, "Loan already funded");
        require(interestOffered <= ln.interest, "Offer too high");

        // Verify VP against all trusted proof contracts
        address[] storage proofs = lenders[msg.sender].verifyProofs;
        for (uint256 i = 0; i < proofs.length; i++) {
            require(verify(proofs[i], vp), "VP verification failed");
        }

        ln.offers.push(Offer({lender: msg.sender, interestOffered: interestOffered}));
        emit LoanOfferSubmitted(loanId, msg.sender, interestOffered);
    }

    function getOffers(uint256 loanId) external view returns (Offer[] memory) {
        return loans[loanId].offers;
    }

    function acceptOffer(uint256 loanId, uint256 offerIndex)
        external onlyBorrower(loanId) nonReentrant
    {
        Loan storage ln = loans[loanId];
        require(!ln.funded, "Already funded");
        require(offerIndex < ln.offers.length, "Invalid offer index");

        Offer memory ofr = ln.offers[offerIndex];
        ln.lender = ofr.lender;
        ln.interest = ofr.interestOffered;
        ln.funded = true;

        // Transfer funds atomically
        ln.token.safeTransferFrom(ofr.lender, ln.borrower, ln.amountRequested);
        lenders[ofr.lender].fundedLoans.push(loanId);

        emit LoanOfferAccepted(loanId, ofr.lender, ofr.interestOffered);
        emit LoanFunded(loanId, ofr.lender, ln.amountRequested);
    }

    function repayLoan(uint256 loanId)
        external nonReentrant onlyBorrower(loanId)
    {
        Loan storage ln = loans[loanId];
        require(ln.funded, "Not funded");
        require(!ln.repaid, "Already repaid");
        require(block.timestamp <= ln.dueDate, "Past due date");

        uint256 totalDue = ln.amountRequested + ln.interest;
        ln.token.safeTransferFrom(msg.sender, ln.lender, totalDue);
        ln.repaid = true;

        emit LoanRepaid(loanId, msg.sender, totalDue);
    }
}
