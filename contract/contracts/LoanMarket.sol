// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LoanBase} from "./Loan/LoanBase.sol";
import {Verifiable} from "./Verifiable.sol";

/**
 * @title LoanMarket
 * @notice A fully implemented marketplace for borrowers and lenders to negotiate and deploy loans,
 *         with ZKP-based identity verification for borrower applications.
 * @dev This contract acts as a factory, deploying individual loan contracts as proxies.
 */
contract LoanMarket is
    Initializable,
    ReentrancyGuardUpgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable,
    Verifiable
{
    // --- Structs ---
    struct Offer {
        address lender;
        uint256 amountOffered;
        uint256 interestBpsOffered;
        uint256 paymentIntervalOffered;
        uint256 paymentsOffered;
        uint256 dueDateOffered;
    }

    struct LoanRequest {
        address borrower;
        IERC20 token;
        uint256 amountRequested;
        uint256 maxInterestBps;
        LoanType loanType;
        Offer[] offers;
        uint256 requestedPayments;
        uint256 requestedPaymentInterval;
        uint256 requestedDueDate;
    }

    struct LenderInfo {
        bool isRegistered;
        uint64[] requiredRequestIds;
    }

    enum LoanType { Personal, Credit }

    // --- State Variables ---
    address public personalLoanImplementation;
    address public creditLoanImplementation;

    mapping(uint256 => LoanRequest) public loanRequests;
    uint256 public loanRequestCount;

    mapping(uint256 => address) public deployedLoans;
    mapping(address => LenderInfo) private lenders;
    mapping(uint256 => mapping(address => bool)) public loanApplications;
    mapping(uint256 => mapping(address => bool)) private _offerSubmitted;

    // --- Events ---
    event LenderRegistered(address indexed lender);
    event LenderRequiredProofsSet(address indexed lender, uint64[] requestIds);
    event LoanRequested(uint256 indexed requestId, address indexed borrower, LoanType loanType, uint256 amount);
    event LoanApplicationSent(uint256 indexed requestId, address indexed borrower, address indexed lender);
    event LoanOfferSubmitted(uint256 indexed requestId, address indexed lender, uint256 amount, uint256 interestBps);
    event LoanCreated(uint256 indexed requestId, LoanType loanType, address indexed loanContract, address indexed borrower, address lender);

    // --- Modifiers ---
    modifier onlyRegisteredLender() {
        require(lenders[msg.sender].isRegistered, "LM: Not a registered lender");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the LoanMarket and Verifiable modules.
     * @param _personalLoanImpl Address of the PersonalLoan implementation
     * @param _creditLoanImpl Address of the CreditLoan implementation
     * @param verifierAddress Address of the UniversalVerifier contract
     */
    function initialize(
        address _personalLoanImpl,
        address _creditLoanImpl,
        address verifierAddress
    ) public initializer {
        __Ownable_init_unchained(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __Verifiable_init(verifierAddress);

        personalLoanImplementation = _personalLoanImpl;
        creditLoanImplementation = _creditLoanImpl;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- Lender Management ---
    function registerLender() external {
        require(!lenders[msg.sender].isRegistered, "LM: Lender already registered");
        lenders[msg.sender].isRegistered = true;
        emit LenderRegistered(msg.sender);
    }

    function setRequiredProofs(uint64[] calldata requestIds) external onlyRegisteredLender {
        require(requestIds.length > 0, "LM: No proof IDs provided");
        lenders[msg.sender].requiredRequestIds = requestIds;
        emit LenderRequiredProofsSet(msg.sender, requestIds);
    }

    function getRequiredProofs(address lenderAddr) external view returns (uint64[] memory) {
        require(lenders[lenderAddr].isRegistered, "LM: Lender not registered");
        return lenders[lenderAddr].requiredRequestIds;
    }

    function isLenderRegistered(address lenderAddr) external view returns (bool) {
        return lenders[lenderAddr].isRegistered;
    }

    // --- Loan Lifecycle ---
    function requestLoan(
        IERC20 token,
        uint256 amount,
        uint256 maxInterestBps,
        LoanType loanType,
        uint256 dueDate,
        uint256 numPayments,
        uint256 paymentInterval
    ) external returns (uint256 requestId) {
        loanRequestCount++;
        requestId = loanRequestCount;
        LoanRequest storage newRequest = loanRequests[requestId];

        newRequest.borrower = msg.sender;
        newRequest.token = token;
        newRequest.amountRequested = amount;
        newRequest.maxInterestBps = maxInterestBps;
        newRequest.loanType = loanType;
        newRequest.requestedDueDate = dueDate;
        newRequest.requestedPayments = numPayments;
        newRequest.requestedPaymentInterval = paymentInterval;

        emit LoanRequested(requestId, msg.sender, loanType, amount);
    }

    /**
     * @notice Borrower sends their loan request to a lender, with ZKP verification if required.
     */
    function sendLoanApplication(uint256 requestId, address lenderAddr) external {
        LoanRequest storage request_ = loanRequests[requestId];
        require(request_.borrower == msg.sender, "LM: Not your loan request");
        require(lenders[lenderAddr].isRegistered, "LM: Lender not registered");

        uint64[] storage proofs = lenders[lenderAddr].requiredRequestIds;
        if (proofs.length > 0) {
            for (uint i = 0; i < proofs.length; i++) {
                require(
                    checkProofIsVerified(proofs[i], msg.sender),
                    "LM: Missing or unverified ZKP proof for lender requirements"
                );
            }
        }

        loanApplications[requestId][lenderAddr] = true;
        emit LoanApplicationSent(requestId, msg.sender, lenderAddr);
    }

    function submitOffer(
        uint256 requestId,
        uint256 amountOffered,
        uint256 interestBpsOffered,
        uint256 dueDateOffered,
        uint256 paymentsOffered,
        uint256 paymentIntervalOffered
    ) external onlyRegisteredLender nonReentrant {
        LoanRequest storage request_ = loanRequests[requestId];
        require(loanApplications[requestId][msg.sender], "LM: No application for this request");
        require(!_offerSubmitted[requestId][msg.sender], "LM: Offer already submitted");
        require(interestBpsOffered <= request_.maxInterestBps, "LM: Interest too high");

        _offerSubmitted[requestId][msg.sender] = true;
        request_.offers.push(Offer({
            lender: msg.sender,
            amountOffered: amountOffered,
            interestBpsOffered: interestBpsOffered,
            paymentIntervalOffered: paymentIntervalOffered,
            paymentsOffered: paymentsOffered,
            dueDateOffered: dueDateOffered
        }));

        emit LoanOfferSubmitted(requestId, msg.sender, amountOffered, interestBpsOffered);
    }

    function acceptOffer(uint256 requestId, uint256 offerIndex) external nonReentrant {
        LoanRequest storage request_ = loanRequests[requestId];
        require(request_.borrower == msg.sender, "LM: Not your loan request");
        require(deployedLoans[requestId] == address(0), "LM: Loan already created");
        require(offerIndex < request_.offers.length, "LM: Invalid offer index");

        Offer memory sel = request_.offers[offerIndex];
        address implementation;
        bytes memory initData;

        if (request_.loanType == LoanType.Personal) {
            implementation = personalLoanImplementation;
            initData = abi.encodeWithSelector(
                LoanBase.initialize.selector,
                request_.borrower,
                sel.lender,
                request_.token,
                sel.amountOffered,
                sel.interestBpsOffered,
                0,
                sel.paymentsOffered,
                sel.paymentIntervalOffered,
                address(this)
            );
        } else {
            implementation = creditLoanImplementation;
            initData = abi.encodeWithSelector(
                LoanBase.initialize.selector,
                request_.borrower,
                sel.lender,
                request_.token,
                sel.amountOffered,
                sel.interestBpsOffered,
                sel.dueDateOffered,
                0,
                0,
                address(this)
            );
        }

        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        deployedLoans[requestId] = address(proxy);
        emit LoanCreated(requestId, request_.loanType, address(proxy), request_.borrower, sel.lender);
        delete loanRequests[requestId];
    }
}
