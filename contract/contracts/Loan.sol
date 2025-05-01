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
        IERC20 token;
        uint256 amountRequested;
        uint256 maxInterest;
        uint256 dueDate;
        address selectedLender;
        uint256 interest;
        bool funded;
        bool repaid;
        Offer[] offers;
    }

    struct Lender {
        bool registered;
        address[] verifyProofs;
        uint256[] fundedLoans;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public loanCount;

    mapping(address => Lender) private lenders;

    // Tracks borrower applications to lenders
    mapping(uint256 => mapping(address => bool)) public loanApplications;
    mapping(uint256 => mapping(address => bool)) private _reviewed;

    // --- Events ---
    event LenderRegistered(address indexed lender);
    event ProofContractAdded(address indexed lender, address proofContract);
    event ProofContractRemoved(address indexed lender, address proofContract);
    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed token,
        uint256 amountRequested,
        uint256 maxInterest,
        uint256 dueDate
    );
    event LoanApplied(uint256 indexed loanId, address indexed borrower, address indexed lender);
    event LoanOfferSubmitted(uint256 indexed loanId, address indexed lender, uint256 interestOffered);
    event LoanOfferRejected(uint256 indexed loanId, address indexed lender);
    event LoanOfferAccepted(uint256 indexed loanId, address indexed lender, uint256 interestChosen);
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 amountFunded);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalRepaid);

    // --- Modifiers ---
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

    /// @notice Remove a verify proof contract from the lender's list
    function removeVerifyProof(address proofContract) external onlyRegisteredLender {
        address[] storage proofs = lenders[msg.sender].verifyProofs;
        bool found = false;
        for (uint256 i = 0; i < proofs.length; i++) {
            if (proofs[i] == proofContract) {
                // Move the last element to the current position
                proofs[i] = proofs[proofs.length - 1];
                // Remove the last element
                proofs.pop();
                found = true;
                break;
            }
        }
        require(found, "Proof contract not found");
        emit ProofContractRemoved(msg.sender, proofContract);
    }

    /// @notice Returns the list of proof‐contract addresses that a given lender has registered
    function getVerifyProofs(address lenderAddr)
        external
        view
        returns (address[] memory)
    {
        require(lenders[lenderAddr].registered, "Lender not registered");
        return lenders[lenderAddr].verifyProofs;
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
        ln.maxInterest = maxInterest;
        ln.dueDate = dueDate;

        emit LoanRequested(loanCount, msg.sender, address(token), amountRequested, maxInterest, dueDate);
        return loanCount;
    }

    /// @notice Borrower applies to a specific lender with all required VPs
    function applyForLoan(
        uint256 loanId,
        address lenderAddr,
        VP[] calldata vps
    ) external onlyBorrower(loanId) {
        Loan storage ln = loans[loanId];
        require(!ln.funded, "Loan already funded");
        require(lenders[lenderAddr].registered, "Lender not registered");

        address[] storage proofs = lenders[lenderAddr].verifyProofs;
        require(vps.length == proofs.length, "Incorrect VP count");
        for (uint256 i = 0; i < proofs.length; i++) {
            require(verify(proofs[i], vps[i]), "VP verification failed");
        }

        loanApplications[loanId][lenderAddr] = true;
        emit LoanApplied(loanId, msg.sender, lenderAddr);
    }

    /// @notice Lender reviews an application and accepts or rejects
    function reviewApplication(
        uint256 loanId,
        bool accept,
        uint256 interestOffered
    ) external onlyRegisteredLender {
        require(loanApplications[loanId][msg.sender], "No application");
        Loan storage ln = loans[loanId];
        require(!ln.funded, "Loan already funded");
        require(!_reviewed[loanId][msg.sender], "Already reviewed");

        _reviewed[loanId][msg.sender] = true;

        if (accept) {
            require(interestOffered <= ln.maxInterest, "Offer too high");
            ln.offers.push(Offer({ lender: msg.sender, interestOffered: interestOffered }));
            emit LoanOfferSubmitted(loanId, msg.sender, interestOffered);
        } else {
            emit LoanOfferRejected(loanId, msg.sender);
        }
    }

    function getOffers(uint256 loanId) external view returns (Offer[] memory) {
        return loans[loanId].offers;
    }

    /// @notice Borrower selects one of the lender offers
    function acceptOffer(uint256 loanId, uint256 offerIndex) external onlyBorrower(loanId) {
        Loan storage ln = loans[loanId];
        require(!ln.funded, "Already funded");
        require(offerIndex < ln.offers.length, "Invalid offer index");

        Offer memory ofr = ln.offers[offerIndex];
        ln.selectedLender = ofr.lender;
        ln.interest = ofr.interestOffered;

        emit LoanOfferAccepted(loanId, ofr.lender, ofr.interestOffered);
    }

    /// @notice Selected lender funds the loan
    function fundLoan(uint256 loanId) external nonReentrant onlyRegisteredLender {
        Loan storage ln = loans[loanId];
        require(ln.selectedLender == msg.sender, "Not selected lender");
        require(!ln.funded, "Already funded");

        ln.token.safeTransferFrom(msg.sender, ln.borrower, ln.amountRequested);
        ln.funded = true;
        lenders[msg.sender].fundedLoans.push(loanId);

        emit LoanFunded(loanId, msg.sender, ln.amountRequested);
    }

    /// @notice Borrower repays the loan plus interest
    function repayLoan(uint256 loanId) external nonReentrant onlyBorrower(loanId) {
        Loan storage ln = loans[loanId];
        require(ln.funded, "Not funded");
        require(!ln.repaid, "Already repaid");
        require(block.timestamp <= ln.dueDate, "Past due date");

        uint256 totalDue = ln.amountRequested + ln.interest;
        ln.token.safeTransferFrom(msg.sender, ln.selectedLender, totalDue);
        ln.repaid = true;

        emit LoanRepaid(loanId, msg.sender, totalDue);
    }
}
