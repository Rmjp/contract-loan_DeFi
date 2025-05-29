// SPDX-License-Identifier: UNLICENSED
//
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// Assuming your new Verifiable.sol is in the current directory
// And it correctly imports/defines UniversalVerifier from '@iden3/contracts/verifiers/UniversalVerifier.sol'
import { Verifiable } from "./Verifiable.sol";
import { UniversalVerifier } from "@iden3/contracts/verifiers/UniversalVerifier.sol"; // Import for the type

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
        uint256 maxInterest; // Borrower's max acceptable interest
        uint256 dueDate;
        address selectedLender;
        uint256 interest; // Actual interest agreed upon
        bool funded;
        bool repaid;
        Offer[] offers;
    }

    struct Lender {
        bool registered;
        uint64[] requiredRequestIds; // Lender sets these requestIds from UniversalVerifier
        uint256[] fundedLoans;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public loanCount;

    mapping(address => Lender) private lenders;

    // Tracks borrower applications to lenders
    // loanId => lenderAddress => applied (true/false)
    mapping(uint256 => mapping(address => bool)) public loanApplications;
    // Tracks if a lender has already reviewed/made an offer for a loan application
    // loanId => lenderAddress => reviewed (true/false)
    mapping(uint256 => mapping(address => bool)) private _reviewed;


    // --- Events ---
    event LenderRegistered(address indexed lender);
    event LenderRequiredProofsSet(address indexed lender, uint64[] requestIds); // New event
    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed token,
        uint256 amountRequested,
        uint256 maxInterest,
        uint256 dueDate
    );
    event LoanApplied(uint256 indexed loanId, address indexed borrower, address indexed lender); // Borrower has applied and (presumably) met ZKP requirements
    event LoanOfferSubmitted(uint256 indexed loanId, address indexed lender, uint256 interestOffered);
    event LoanOfferRejected(uint256 indexed loanId, address indexed lender);
    event LoanOfferAccepted(uint256 indexed loanId, address indexed lender, uint256 interestChosen);
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 amountFunded);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalRepaid);

    // --- Modifiers ---
    modifier onlyRegisteredLender() {
        require(lenders[msg.sender].registered, "LC: Not a registered lender");
        _;
    }

    modifier onlyBorrower(uint256 loanId) {
        require(loans[loanId].borrower == msg.sender, "LC: Caller is not the borrower of this loan");
        _;
    }

    // --- Constructor ---
    constructor(UniversalVerifier _universalVerifierAddress) Verifiable(_universalVerifierAddress) {
        // Ownable is initialized by Verifiable's Ownable parent if it inherits from it,
        // or you might need to initialize it here if LoanContract directly inherits OpenZeppelin's Ownable separately.
        // Assuming Verifiable handles Ownable initialization or you add it:
        // _transferOwnership(msg.sender); // If LoanContract is directly Ownable and Verifiable isn't
    }


    // --- Lender API ---
    function registerLender() external {
        require(!lenders[msg.sender].registered, "LC: Lender already registered");
        lenders[msg.sender].registered = true;
        emit LenderRegistered(msg.sender);
    }

    /// @notice Lender sets the ZKP request IDs required for borrowers to apply.
    /// These request IDs should correspond to requests set up by the lender in the UniversalVerifier.
    function setRequiredProofs(uint64[] calldata requestIds) external onlyRegisteredLender {
        require(requestIds.length > 0, "LC: No request IDs provided");
        lenders[msg.sender].requiredRequestIds = requestIds;
        emit LenderRequiredProofsSet(msg.sender, requestIds);
    }

    /// @notice Returns the list of ZKP request IDs a given lender requires.
    function getRequiredProofs(address lenderAddr)
        external
        view
        returns (uint64[] memory)
    {
        require(lenders[lenderAddr].registered, "LC: Lender not registered");
        return lenders[lenderAddr].requiredRequestIds;
    }


    // --- Borrower API ---
    /// @notice Borrower initiates a loan request outlining their needs.
    function requestLoan(
        IERC20 token,
        uint256 amountRequested,
        uint256 maxInterest, // Max interest rate (e.g., basis points, 500 = 5%) borrower is willing to pay
        uint256 dueDate // Timestamp for loan repayment
    ) external returns (uint256) {
        require(amountRequested > 0, "LC: Loan amount must be greater than zero");
        require(dueDate > block.timestamp, "LC: Due date must be in the future");
        // maxInterest validation can be added if needed (e.g., <= 10000 for 100%)

        loanCount++;
        Loan storage newLoan = loans[loanCount];
        newLoan.borrower = msg.sender;
        newLoan.token = token;
        newLoan.amountRequested = amountRequested;
        newLoan.maxInterest = maxInterest;
        newLoan.dueDate = dueDate;
        // funded and repaid are false by default
        // selectedLender and interest are zero by default

        emit LoanRequested(loanCount, msg.sender, address(token), amountRequested, maxInterest, dueDate);
        return loanCount;
    }

    /// @notice Borrower applies to a specific lender for a loan.
    /// This function assumes the borrower has already submitted the required ZKPs
    /// to the UniversalVerifier for the request IDs specified by the lender.
    /// The 'target' for isVerified modifier will be the borrower (msg.sender).
    function applyForLoan(
        uint256 loanId,
        address lenderAddr
        // We no longer pass VPs here. The function will check UniversalVerifier.
        // Instead, we will iterate over the lender's required proofs.
    )
        external
        onlyBorrower(loanId)
        // The isVerified modifier will be applied in a loop
    {
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(lenders[lenderAddr].registered, "LC: Target lender is not registered");
        require(!loanApplications[loanId][lenderAddr], "LC: Already applied to this lender for this loan");

        uint64[] memory requiredIds = lenders[lenderAddr].requiredRequestIds;
        require(requiredIds.length > 0, "LC: Lender has not specified required proofs");

        for (uint i = 0; i < requiredIds.length; i++) {
            // Here we use a require statement to call the isVerified logic.
            // The isVerified modifier needs to be adapted or called as a view function.
            // For simplicity, assuming Verifiable.sol has a public view function like:
            // function checkProof(uint64 requestId, address target) internal view returns (bool) {
            //     return verifier.getProofStatus(target, requestId).isVerified;
            // }
            // If Verifiable.sol has the modifier as in your example:
            // modifier isVerified(uint64 requestId, address target) {
            //   require(verifier.getProofStatus(target, requestId).isVerified, 'target is not verified');
            //   _;
            // }
            // You can't directly use a modifier in a loop like this.
            // So, Verifiable.sol should expose a view function or this contract needs to call
            // `verifier.getProofStatus` directly. Let's assume direct call for clarity:
            UniversalVerifier.ProofStatus memory proofStatus = verifier.getProofStatus(msg.sender, requiredIds[i]);
            require(proofStatus.isVerified, "LC: Required ZKP not verified by UniversalVerifier");
        }

        loanApplications[loanId][lenderAddr] = true;
        emit LoanApplied(loanId, msg.sender, lenderAddr);
    }


    /// @notice Lender reviews an application and submits an offer or rejects.
    function reviewApplicationAndSubmitOffer(
        uint256 loanId,
        uint256 interestOffered // Lender's proposed interest rate
    ) external onlyRegisteredLender nonReentrant {
        require(loanApplications[loanId][msg.sender], "LC: No application from borrower for this loan to you");
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(!_reviewed[loanId][msg.sender], "LC: Application already reviewed by you");

        _reviewed[loanId][msg.sender] = true;

        // Lender makes an offer
        require(interestOffered <= currentLoan.maxInterest, "LC: Interest offered is higher than borrower's max");
        currentLoan.offers.push(Offer({ lender: msg.sender, interestOffered: interestOffered }));
        emit LoanOfferSubmitted(loanId, msg.sender, interestOffered);
    }

    function reviewApplicationAndReject(uint256 loanId) external onlyRegisteredLender nonReentrant {
        require(loanApplications[loanId][msg.sender], "LC: No application from borrower for this loan to you");
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(!_reviewed[loanId][msg.sender], "LC: Application already reviewed by you");

        _reviewed[loanId][msg.sender] = true;
        emit LoanOfferRejected(loanId, msg.sender);
    }


    /// @notice Retrieves all offers made for a specific loan.
    function getOffers(uint256 loanId) external view returns (Offer[] memory) {
        require(loans[loanId].borrower != address(0), "LC: Loan does not exist"); // Basic check
        return loans[loanId].offers;
    }

    /// @notice Borrower reviews received offers and accepts one.
    function acceptOffer(uint256 loanId, uint256 offerIndex) external onlyBorrower(loanId) nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded or offer accepted");
        require(currentLoan.selectedLender == address(0), "LC: An offer has already been accepted");
        require(offerIndex < currentLoan.offers.length, "LC: Invalid offer index");

        Offer memory selectedOffer = currentLoan.offers[offerIndex];
        // Ensure the lender of the offer is still registered (optional, but good practice)
        require(lenders[selectedOffer.lender].registered, "LC: Selected lender is no longer registered");

        currentLoan.selectedLender = selectedOffer.lender;
        currentLoan.interest = selectedOffer.interestOffered;

        emit LoanOfferAccepted(loanId, selectedOffer.lender, selectedOffer.interestOffered);
    }

    /// @notice The lender selected by the borrower funds the loan.
    function fundLoan(uint256 loanId) external onlyRegisteredLender nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.selectedLender == msg.sender, "LC: You are not the selected lender for this loan");
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(currentLoan.borrower != address(0), "LC: Invalid loan or borrower");

        // Lender transfers the loan amount to the borrower
        currentLoan.token.safeTransferFrom(msg.sender, currentLoan.borrower, currentLoan.amountRequested);
        currentLoan.funded = true;
        lenders[msg.sender].fundedLoans.push(loanId);

        emit LoanFunded(loanId, msg.sender, currentLoan.amountRequested);
    }

    /// @notice Borrower repays the loan amount plus the agreed interest to the lender.
    function repayLoan(uint256 loanId) external onlyBorrower(loanId) nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.funded, "LC: Loan was not funded");
        require(!currentLoan.repaid, "LC: Loan has already been repaid");
        // Due date check can be handled off-chain or with penalties if desired
        // require(block.timestamp <= currentLoan.dueDate, "LC: Loan is past its due date");

        uint256 totalDue = currentLoan.amountRequested + currentLoan.interest;
        // Borrower needs to have approved the LoanContract to spend their tokens
        currentLoan.token.safeTransferFrom(msg.sender, currentLoan.selectedLender, totalDue);
        currentLoan.repaid = true;

        emit LoanRepaid(loanId, msg.sender, totalDue);
    }
}