// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {Verifiable} from "./Verifiable.sol"; // Assuming Verifiable.sol is in the same directory and is upgradeable
// import {UniversalVerifier} from "@iden3/contracts/verifiers/UniversalVerifier.sol"; // Keep if Verifiable.sol needs it

contract LoanContract is
    Initializable,
    Verifiable, // Assumes Verifiable handles ZKP verification logic
    ReentrancyGuardUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // Represents an offer made by a lender for a specific loan request
    struct Offer {
        address lender;           // The address of the lender making the offer
        uint256 amountOffered;      // The loan amount proposed by the lender
        uint256 paybackTimeOffered; // The due date (timestamp) proposed by the lender
        uint256 interestBpsOffered; // The interest rate in basis points (e.g., 500 = 5%) proposed by the lender
    }

    // Represents a loan, from request through repayment
    struct Loan {
        address borrower;           // The address of the borrower
        IERC20 token;               // The ERC20 token for the loan
        uint256 amountRequested;    // Borrower's initial requested amount
        uint256 maxInterestBps;     // Borrower's maximum acceptable interest in BPS
        uint256 requestedDueDate;   // Borrower's preferred due date (timestamp)

        Offer[] offers;             // Array of offers from various lenders

        // Fields below are populated after a borrower accepts an offer
        address selectedLender;     // The lender whose offer was accepted
        uint256 amountAgreed;       // The final agreed-upon loan amount
        uint256 interestBpsAgreed;  // The final agreed-upon interest rate in BPS
        uint256 agreedDueDate;      // The final agreed-upon due date for repayment

        bool funded;                // True if the loan has been disbursed by the lender
        bool repaid;                // True if the loan has been fully repaid by the borrower
        // bool cancelled;          // Optional: Consider adding a cancellation mechanism
    }

    // Represents a lender registered on the platform
    struct Lender {
        bool registered;            // True if the lender is registered
        uint64[] requiredRequestIds; // Array of ZKP request IDs the lender requires from borrowers
        uint256[] fundedLoans;       // Array of loan IDs funded by this lender
    }

    mapping(uint256 => Loan) public loans; // Mapping from loan ID to Loan details
    uint256 public loanCount; // Counter for generating unique loan IDs

    mapping(address => Lender) private lenders; // Mapping from lender address to Lender details
    mapping(uint256 => mapping(address => bool)) public loanApplications; // Tracks if a borrower applied to a lender for a loan: loanId => lenderAddr => applied
    mapping(uint256 => mapping(address => bool)) private _reviewedApplication; // Tracks if a lender has reviewed an application: loanId => lenderAddr => reviewed

    // --- Events ---
    event LenderRegistered(address indexed lender);
    event LenderRequiredProofsSet(address indexed lender, uint64[] requestIds);
    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed token,
        uint256 amountRequested,
        uint256 maxInterestBps,
        uint256 requestedDueDate
    );
    event LoanApplicationSent(uint256 indexed loanId, address indexed borrower, address indexed lender); // Renamed from LoanApplied for clarity
    event LoanOfferSubmitted(
        uint256 indexed loanId,
        address indexed lender,
        uint256 amountOffered,
        uint256 paybackTimeOffered,
        uint256 interestBpsOffered
    );
    event LoanOfferRejectedByLender(uint256 indexed loanId, address indexed lender); // Renamed from LoanOfferRejected
    event LoanOfferAcceptedByBorrower( // Renamed from LoanOfferAccepted
        uint256 indexed loanId,
        address indexed lender,
        uint256 amountAgreed,
        uint256 agreedDueDate,
        uint256 interestBpsAgreed
    );
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 amountFunded);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalRepaid);

    // --- Modifiers ---
    modifier onlyRegisteredLender() {
        require(lenders[_msgSender()].registered, "LC: Caller is not a registered lender");
        _;
    }

    modifier onlyBorrower(uint256 loanId) {
        require(loans[loanId].borrower == _msgSender(), "LC: Caller is not the borrower of this loan");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract.
     * @param universalVerifierAddress The address of the UniversalVerifier contract (for Verifiable.sol).
     */
    function initialize(address universalVerifierAddress) public initializer {
        __Context_init_unchained();
        __Ownable_init_unchained(_msgSender()); // Sets deployer as initial owner
        __Ownable2Step_init_unchained();
        __Verifiable_init(universalVerifierAddress); // Initialize Verifiable parent
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
    }

    // Required for UUPS proxy pattern
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner // Only the owner can authorize an upgrade
    {}

    // --- Lender Management ---

    /**
     * @notice Allows an address to register as a lender.
     * @dev Lender must not be already registered.
     */
    function registerLender() external {
        require(!lenders[_msgSender()].registered, "LC: Lender already registered");
        lenders[_msgSender()].registered = true;
        emit LenderRegistered(_msgSender());
    }

    /**
     * @notice Allows a registered lender to set their required ZKP request IDs.
     * @dev These are the proofs a borrower must satisfy when applying to this lender.
     * @param requestIds Array of ZKP request IDs.
     */
    function setRequiredProofs(uint64[] calldata requestIds) external onlyRegisteredLender {
        require(requestIds.length > 0, "LC: No request IDs provided");
        lenders[_msgSender()].requiredRequestIds = requestIds;
        emit LenderRequiredProofsSet(_msgSender(), requestIds);
    }

    /**
     * @notice Retrieves the ZKP request IDs required by a specific lender.
     * @param lenderAddr The address of the lender.
     * @return An array of ZKP request IDs.
     */
    function getRequiredProofs(address lenderAddr)
        external
        view
        returns (uint64[] memory)
    {
        require(lenders[lenderAddr].registered, "LC: Lender not registered");
        return lenders[lenderAddr].requiredRequestIds;
    }

    /**
     * @notice Checks if a given address is registered as a lender.
     * @param lenderAddr The address to check.
     * @return True if the address is a registered lender, false otherwise.
     */
    function isLenderRegistered(address lenderAddr) external view returns (bool) {
        return lenders[lenderAddr].registered;
    }

    // --- Borrower Loan Lifecycle ---

    /**
     * @notice Allows a borrower to request a new loan.
     * @param tokenAddr The address of the ERC20 token for the loan.
     * @param amount The amount of tokens requested.
     * @param maxInterestBps The maximum interest rate (in BPS) the borrower is willing to pay.
     * @param dueDate The preferred due date (timestamp) for loan repayment.
     * @return The ID of the newly created loan request.
     */
    function requestLoan(
        IERC20 tokenAddr,
        uint256 amount,
        uint256 maxInterestBps,
        uint256 dueDate
    ) external returns (uint256) {
        require(amount > 0, "LC: Loan amount must be greater than zero");
        require(dueDate > block.timestamp, "LC: Due date must be in the future");
        require(address(tokenAddr) != address(0), "LC: Invalid token address");

        loanCount++;
        Loan storage newLoan = loans[loanCount];
        newLoan.borrower = _msgSender();
        newLoan.token = tokenAddr;
        newLoan.amountRequested = amount;
        newLoan.maxInterestBps = maxInterestBps;
        newLoan.requestedDueDate = dueDate;
        newLoan.funded = false;
        newLoan.repaid = false;
        newLoan.selectedLender = address(0); // Ensure selectedLender is zeroed out

        emit LoanRequested(loanCount, _msgSender(), address(tokenAddr), amount, maxInterestBps, dueDate);
        return loanCount;
    }

    /**
     * @notice Allows a borrower to send their loan application to a specific registered lender.
     * @dev The borrower must have already submitted and had verified the ZKPs required by this lender.
     * @param loanId The ID of the loan being applied for.
     * @param lenderAddr The address of the lender to apply to.
     */
    function sendLoanApplication(
        uint256 loanId,
        address lenderAddr
    )
        external
        onlyBorrower(loanId) // Ensures only the original borrower can send applications for their loan
    {
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.borrower != address(0), "LC: Loan does not exist");
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(currentLoan.selectedLender == address(0), "LC: An offer has already been accepted for this loan");
        require(lenders[lenderAddr].registered, "LC: Target lender is not registered"); // Check using the internal mapping value
        require(!loanApplications[loanId][lenderAddr], "LC: Already applied to this lender for this loan");

        uint64[] memory requiredProofIds = lenders[lenderAddr].requiredRequestIds;
        // If a lender requires no proofs, this check is skipped.
        // If they do, Verifiable.checkProofIsVerified must be called by the borrower beforehand for each.
        if (requiredProofIds.length > 0) {
            for (uint i = 0; i < requiredProofIds.length; i++) {
                // This check assumes Verifiable.sol stores verification status accessible by checkProofIsVerified
                // The borrower is responsible for submitting proofs to Verifiable.sol before calling this.
                require(checkProofIsVerified(requiredProofIds[i], _msgSender()), "LC: Required ZKP not verified or submitted for this lender");
            }
        }

        loanApplications[loanId][lenderAddr] = true;
        emit LoanApplicationSent(loanId, _msgSender(), lenderAddr);
    }

    // --- Lender Loan Lifecycle ---

    /**
     * @notice Allows a registered lender to review a loan application and submit an offer.
     * @param loanId The ID of the loan.
     * @param amountOffered The loan amount the lender is willing to provide.
     * @param paybackTimeOffered The due date (timestamp) the lender proposes.
     * @param interestBpsOffered The interest rate (in BPS) the lender is offering.
     */
    function reviewApplicationAndSubmitOffer(
        uint256 loanId,
        uint256 amountOffered,
        uint256 paybackTimeOffered,
        uint256 interestBpsOffered
    ) external onlyRegisteredLender nonReentrant {
        require(loanApplications[loanId][_msgSender()], "LC: No application from borrower for this loan to you");
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.borrower != address(0), "LC: Loan does not exist");
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(currentLoan.selectedLender == address(0), "LC: An offer has already been accepted for this loan");
        require(!_reviewedApplication[loanId][_msgSender()], "LC: Application already reviewed by you for this loan");

        require(amountOffered > 0, "LC: Offered amount must be greater than zero");
        require(paybackTimeOffered > block.timestamp, "LC: Offered payback time must be in the future");
        // Lender's offered interest must not exceed borrower's stated maximum.
        require(interestBpsOffered <= currentLoan.maxInterestBps, "LC: Interest offered is higher than borrower's max");

        _reviewedApplication[loanId][_msgSender()] = true; // Mark as reviewed to prevent multiple offers from same lender

        currentLoan.offers.push(Offer({
            lender: _msgSender(),
            amountOffered: amountOffered,
            paybackTimeOffered: paybackTimeOffered,
            interestBpsOffered: interestBpsOffered
        }));

        emit LoanOfferSubmitted(loanId, _msgSender(), amountOffered, paybackTimeOffered, interestBpsOffered);
    }

    /**
     * @notice Allows a registered lender to reject a loan application they received.
     * @param loanId The ID of the loan.
     */
    function reviewApplicationAndReject(uint256 loanId) external onlyRegisteredLender nonReentrant {
        require(loanApplications[loanId][_msgSender()], "LC: No application from borrower for this loan to you");
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.borrower != address(0), "LC: Loan does not exist");
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(currentLoan.selectedLender == address(0), "LC: An offer has already been accepted for this loan");
        require(!_reviewedApplication[loanId][_msgSender()], "LC: Application already reviewed by you for this loan");

        _reviewedApplication[loanId][_msgSender()] = true; // Mark as reviewed
        emit LoanOfferRejectedByLender(loanId, _msgSender());
    }

    // --- Borrower Post-Offer Actions ---

    /**
     * @notice Retrieves all offers submitted for a specific loan.
     * @param loanId The ID of the loan.
     * @return An array of Offer structs.
     */
    function getOffers(uint256 loanId) external view returns (Offer[] memory) {
        require(loans[loanId].borrower != address(0), "LC: Loan does not exist");
        // No specific borrower check here, as offers might be viewable publicly or by other potential participants.
        // If only the borrower should see offers before acceptance, add onlyBorrower(loanId) modifier.
        return loans[loanId].offers;
    }

    /**
     * @notice Allows the borrower to accept one of the offers made for their loan.
     * @param loanId The ID of the loan.
     * @param offerIndex The index of the offer in the loan's offers array.
     */
    function acceptOffer(uint256 loanId, uint256 offerIndex) external onlyBorrower(loanId) nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(currentLoan.selectedLender == address(0), "LC: An offer has already been accepted for this loan");
        require(offerIndex < currentLoan.offers.length, "LC: Invalid offer index");

        Offer memory selectedOffer = currentLoan.offers[offerIndex];
        require(lenders[selectedOffer.lender].registered, "LC: Selected lender is no longer registered"); // Ensure lender is still active

        currentLoan.selectedLender = selectedOffer.lender;
        currentLoan.amountAgreed = selectedOffer.amountOffered;
        currentLoan.interestBpsAgreed = selectedOffer.interestBpsOffered;
        currentLoan.agreedDueDate = selectedOffer.paybackTimeOffered;

        emit LoanOfferAcceptedByBorrower(
            loanId,
            selectedOffer.lender,
            selectedOffer.amountOffered,
            selectedOffer.paybackTimeOffered,
            selectedOffer.interestBpsOffered
        );
    }

    // --- Funding and Repayment ---

    /**
     * @notice Allows the selected lender to fund the loan after their offer was accepted.
     * @param loanId The ID of the loan to fund.
     */
    function fundLoan(uint256 loanId) external onlyRegisteredLender nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.selectedLender == _msgSender(), "LC: You are not the selected lender for this loan");
        require(currentLoan.borrower != address(0), "LC: Invalid loan or borrower");
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(currentLoan.amountAgreed > 0, "LC: Agreed amount is zero, cannot fund"); // Sanity check

        // Transfer agreed amount from lender to borrower
        currentLoan.token.safeTransferFrom(_msgSender(), currentLoan.borrower, currentLoan.amountAgreed);
        
        currentLoan.funded = true;
        lenders[_msgSender()].fundedLoans.push(loanId); // Track funded loan for the lender

        emit LoanFunded(loanId, _msgSender(), currentLoan.amountAgreed);
    }

    /**
     * @notice Allows the borrower to repay the funded loan.
     * @param loanId The ID of the loan to repay.
     */
    function repayLoan(uint256 loanId) external onlyBorrower(loanId) nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.funded, "LC: Loan was not funded");
        require(!currentLoan.repaid, "LC: Loan has already been repaid");
        require(currentLoan.selectedLender != address(0), "LC: No lender selected for repayment");
        require(block.timestamp <= currentLoan.agreedDueDate, "LC: Loan repayment is past due date (on-chain simple check, off-chain might handle penalties)"); // Basic due date check

        uint256 interestAmount = (currentLoan.amountAgreed * currentLoan.interestBpsAgreed) / 10000; // Calculate interest
        uint256 totalRepayment = currentLoan.amountAgreed + interestAmount;

        // Transfer total repayment from borrower to selected lender
        currentLoan.token.safeTransferFrom(_msgSender(), currentLoan.selectedLender, totalRepayment);
        
        currentLoan.repaid = true;

        emit LoanRepaid(loanId, _msgSender(), totalRepayment);
    }

    // --- Getter Functions ---

    /**
     * @notice Allows a borrower to view the details of their own loan.
     * @param loanId The ID of the loan.
     * @return The Loan struct containing all details of the specified loan.
     */
    function getLoanDetails(uint256 loanId) external view onlyBorrower(loanId) returns (Loan memory) {
        require(loans[loanId].borrower != address(0), "LC: Loan does not exist"); // Additional check
        return loans[loanId];
    }

    /**
     * @notice Retrieves the number of offers submitted for a specific loan.
     * @param loanId The ID of the loan.
     * @return The number of offers.
     */
    function getOfferCount(uint256 loanId) external view returns (uint256) {
        require(loans[loanId].borrower != address(0), "LC: Loan does not exist");
        return loans[loanId].offers.length;
    }

     /**
     * @notice Retrieves a specific offer by its index for a given loan.
     * @dev This can be used if fetching all offers at once is too gas-intensive or not needed.
     * @param loanId The ID of the loan.
     * @param offerIndex The index of the offer.
     * @return The Offer struct.
     */
    function getOfferByIndex(uint256 loanId, uint256 offerIndex) external view returns (Offer memory) {
        require(loans[loanId].borrower != address(0), "LC: Loan does not exist");
        require(offerIndex < loans[loanId].offers.length, "LC: Invalid offer index");
        return loans[loanId].offers[offerIndex];
    }

    /**
    * @notice Retrieves all loan IDs funded by a specific lender.
    * @param lenderAddr The address of the lender.
    * @return An array of loan IDs.
    */
    function getLenderFundedLoans(address lenderAddr) external view returns (uint256[] memory) {
        require(lenders[lenderAddr].registered, "LC: Lender not registered");
        return lenders[lenderAddr].fundedLoans;
    }
}
