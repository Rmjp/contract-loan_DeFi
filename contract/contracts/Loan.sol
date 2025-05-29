// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {Verifiable} from "./Verifiable.sol"; // Assuming Verifiable.sol is in the same directory and is upgradeable
import {UniversalVerifier} from "@iden3/contracts/verifiers/UniversalVerifier.sol";

contract LoanContract is
    Initializable,
    Verifiable,
    ReentrancyGuardUpgradeable,
    Ownable2StepUpgradeable, // This is the direct parent for ownership
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    struct Offer {
        address lender;
        uint256 interestOffered; // e.g., basis points: 500 = 5%
    }

    struct Loan {
        address borrower;
        IERC20 token; // Use upgradeable interface
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
        uint64[] requiredRequestIds;
        uint256[] fundedLoans;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public loanCount;

    mapping(address => Lender) private lenders;
    mapping(uint256 => mapping(address => bool)) public loanApplications;
    mapping(uint256 => mapping(address => bool)) private _reviewed;

    // --- Events ---
    event LenderRegistered(address indexed lender);
    event LenderRequiredProofsSet(address indexed lender, uint64[] requestIds);
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
        require(lenders[msg.sender].registered, "LC: Not a registered lender");
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

    function initialize(address universalVerifierAddress) public initializer {
        // Call unchained initializers for the full Ownable2Step hierarchy
        // This ensures each part of the inheritance is explicitly initialized.
        __Context_init_unchained();         // For ContextUpgradeable (base of OwnableUpgradeable)
        __Ownable_init_unchained(_msgSender());         // For OwnableUpgradeable (base of Ownable2StepUpgradeable)
                                            // This will set the initial owner to _msgSender()
        __Ownable2Step_init_unchained();    // For Ownable2StepUpgradeable specific logic

        // Initialize other direct parents
        __Verifiable_init(universalVerifierAddress); // Assuming Verifiable.sol has this internal initializer
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
    }

    // Required for UUPS
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    // --- Lender API ---
    function registerLender() external {
        require(!lenders[_msgSender()].registered, "LC: Lender already registered");
        lenders[_msgSender()].registered = true;
        emit LenderRegistered(_msgSender());
    }

    function setRequiredProofs(uint64[] calldata requestIds) external onlyRegisteredLender {
        require(requestIds.length > 0, "LC: No request IDs provided");
        lenders[_msgSender()].requiredRequestIds = requestIds;
        emit LenderRequiredProofsSet(_msgSender(), requestIds);
    }

    function getRequiredProofs(address lenderAddr)
        external
        view
        returns (uint64[] memory)
    {
        require(lenders[lenderAddr].registered, "LC: Lender not registered");
        return lenders[lenderAddr].requiredRequestIds;
    }

    // --- Borrower API ---
    function requestLoan(
        IERC20 token, // Use upgradeable interface
        uint256 amountRequested,
        uint256 maxInterest,
        uint256 dueDate
    ) external returns (uint256) {
        require(amountRequested > 0, "LC: Loan amount must be greater than zero");
        require(dueDate > block.timestamp, "LC: Due date must be in the future");

        loanCount++;
        Loan storage newLoan = loans[loanCount];
        newLoan.borrower = _msgSender();
        newLoan.token = token;
        newLoan.amountRequested = amountRequested;
        newLoan.maxInterest = maxInterest;
        newLoan.dueDate = dueDate;

        emit LoanRequested(loanCount, _msgSender(), address(token), amountRequested, maxInterest, dueDate);
        return loanCount;
    }

    function applyForLoan(
        uint256 loanId,
        address lenderAddr
    )
        external
        onlyBorrower(loanId)
    {
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(lenders[lenderAddr].registered, "LC: Target lender is not registered");
        require(!loanApplications[loanId][lenderAddr], "LC: Already applied to this lender for this loan");

        uint64[] memory requiredIds = lenders[lenderAddr].requiredRequestIds;
        require(requiredIds.length > 0, "LC: Lender has not specified required proofs");

        for (uint i = 0; i < requiredIds.length; i++) {
            // Using the public view function from Verifiable.sol
            require(checkProofIsVerified(requiredIds[i], _msgSender()), "LC: Required ZKP not verified");
        }

        loanApplications[loanId][lenderAddr] = true;
        emit LoanApplied(loanId, _msgSender(), lenderAddr);
    }

    function reviewApplicationAndSubmitOffer(
        uint256 loanId,
        uint256 interestOffered
    ) external onlyRegisteredLender nonReentrant {
        require(loanApplications[loanId][_msgSender()], "LC: No application from borrower for this loan to you");
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(!_reviewed[loanId][_msgSender()], "LC: Application already reviewed by you");

        _reviewed[loanId][_msgSender()] = true;

        require(interestOffered <= currentLoan.maxInterest, "LC: Interest offered is higher than borrower's max");
        currentLoan.offers.push(Offer({ lender: _msgSender(), interestOffered: interestOffered }));
        emit LoanOfferSubmitted(loanId, _msgSender(), interestOffered);
    }

    function reviewApplicationAndReject(uint256 loanId) external onlyRegisteredLender nonReentrant {
        require(loanApplications[loanId][_msgSender()], "LC: No application from borrower for this loan to you");
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(!_reviewed[loanId][_msgSender()], "LC: Application already reviewed by you");

        _reviewed[loanId][_msgSender()] = true;
        emit LoanOfferRejected(loanId, _msgSender());
    }

    function getOffers(uint256 loanId) external view returns (Offer[] memory) {
        require(loans[loanId].borrower != address(0), "LC: Loan does not exist");
        return loans[loanId].offers;
    }

    function acceptOffer(uint256 loanId, uint256 offerIndex) external onlyBorrower(loanId) nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(!currentLoan.funded, "LC: Loan has already been funded or offer accepted");
        require(currentLoan.selectedLender == address(0), "LC: An offer has already been accepted");
        require(offerIndex < currentLoan.offers.length, "LC: Invalid offer index");

        Offer memory selectedOffer = currentLoan.offers[offerIndex];
        require(lenders[selectedOffer.lender].registered, "LC: Selected lender is no longer registered");

        currentLoan.selectedLender = selectedOffer.lender;
        currentLoan.interest = selectedOffer.interestOffered;

        emit LoanOfferAccepted(loanId, selectedOffer.lender, selectedOffer.interestOffered);
    }

    function fundLoan(uint256 loanId) external onlyRegisteredLender nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.selectedLender == _msgSender(), "LC: You are not the selected lender for this loan");
        require(!currentLoan.funded, "LC: Loan has already been funded");
        require(currentLoan.borrower != address(0), "LC: Invalid loan or borrower");

        currentLoan.token.safeTransferFrom(_msgSender(), currentLoan.borrower, currentLoan.amountRequested);
        currentLoan.funded = true;
        lenders[_msgSender()].fundedLoans.push(loanId);

        emit LoanFunded(loanId, _msgSender(), currentLoan.amountRequested);
    }

    function repayLoan(uint256 loanId) external onlyBorrower(loanId) nonReentrant {
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.funded, "LC: Loan was not funded");
        require(!currentLoan.repaid, "LC: Loan has already been repaid");

        uint256 totalDue = currentLoan.amountRequested + currentLoan.interest;
        currentLoan.token.safeTransferFrom(_msgSender(), currentLoan.selectedLender, totalDue);
        currentLoan.repaid = true;

        emit LoanRepaid(loanId, _msgSender(), totalDue);
    }
}
