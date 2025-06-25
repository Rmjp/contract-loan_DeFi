// LenderView.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useContractWrite, useContractRead, useContractEvent, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI } from '@/config/contract'; // Ensure ERC20_ABI has 'allowance'
import { parseEther, formatEther, isAddress, Address } from 'viem';

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block ml-1 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
);

// Type for the raw loan data fetched from the public 'loans' mapping
type LoanDataFromMapping = [
    Address,        // 0: borrower
    Address,        // 1: token
    bigint,         // 2: amountRequested
    bigint,         // 3: maxInterestBps
    bigint,         // 4: requestedDueDate
    Address | bigint, // 5: selectedLender (can be 0n if not selected, or address)
    bigint,         // 6: amountAgreed
    bigint,         // 7: interestBpsAgreed
    bigint,         // 8: agreedDueDate
    boolean,        // 9: funded
    boolean         // 10: repaid
];

// Summary for loans that a lender can review
type ReviewableLoanApplicationSummary = {
    loanId: string;
    borrower: Address;
    amountRequested: string; // Formatted
    tokenAddress: Address;
    requestedDueDate: string; // Formatted
};

// Summary for loans that a lender can fund
type FundableLoanSummary = {
    loanId: string;
    borrower: Address;
    tokenAddress: Address;
    amountAgreed: string; // Formatted (e.g., "100.0")
    rawAmountAgreed: bigint; // For contract interaction & prefill
    agreedDueDate: string; // Formatted
};


function LenderView() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [message, setMessage] = useState('');

    // Section Visibility State
    const [activeSection, setActiveSection] = useState<'setup' | 'review' | 'fund'>('setup');

    // Lender State
    const [requiredProofIdsInput, setRequiredProofIdsInput] = useState('');

    // Loan Interaction State
    const [loanIdToReview, setLoanIdToReview] = useState('');
    const [loanIdToFund, setLoanIdToFund] = useState('');

    const [amountOffer, setAmountOffer] = useState('');
    const [paybackTimeOffer, setPaybackTimeOffer] = useState('');
    const [interestOffer, setInterestOffer] = useState('');
    const [isRejectingApplication, setIsRejectingApplication] = useState(false);
    const [isFundingLoan, setIsFundingLoan] = useState(false);

    // Data display
    const [isLenderActuallyRegistered, setIsLenderActuallyRegistered] = useState(false);
    const [currentRequiredProofs, setCurrentRequiredProofs] = useState<bigint[]>([]);
    const [loanDetailsForAction, setLoanDetailsForAction] = useState<LoanDataFromMapping | null>(null);

    const [reviewableApplications, setReviewableApplications] = useState<ReviewableLoanApplicationSummary[]>([]);
    const [isLoadingReviewableApps, setIsLoadingReviewableApps] = useState<boolean>(false);

    const [fundableLoans, setFundableLoans] = useState<FundableLoanSummary[]>([]);
    const [isLoadingFundableLoans, setIsLoadingFundableLoans] = useState<boolean>(false);

    // ERC20 Approval State
    const [tokenToApproveL, setTokenToApproveL] = useState<Address | ''>('');
    const [amountToApproveL, setAmountToApproveL] = useState('');
    const [currentAllowance, setCurrentAllowance] = useState<string>('0'); // Stores formatted allowance


    useEffect(() => {
        // console.log("Current message:", message); 
    }, [message]);

    // --- Contract Reads ---
    const { data: isRegisteredData, refetch: refetchIsRegistered } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'isLenderRegistered',
        args: address ? [address] : undefined,
        enabled: !!address,
        watch: true,
        onSuccess: (data) => {
            setIsLenderActuallyRegistered(!!data);
        }
    });

    const { data: requiredProofsData, refetch: refetchRequiredProofs, isLoading: isLoadingProofs } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'getRequiredProofs',
        args: address ? [address] : undefined,
        enabled: !!address && isLenderActuallyRegistered,
        watch: true,
        onSuccess: (data) => {
            setCurrentRequiredProofs((data as bigint[]) || []);
        },
        onError: (error) => {
            setCurrentRequiredProofs([]);
            // console.error("Error fetching required proofs:", error);
        }
    });
    
    const { data: loanRequestCount, isLoading: isLoadingLoanRequestCount, refetch: refetchLoanRequestCount } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'loanRequestCount',
        watch: true,
    });

    // Fetch ERC20 Allowance for the token to be approved
    const {
        data: allowanceData,
        refetch: refetchAllowance,
        isLoading: isLoadingAllowance
    } = useContractRead({
        address: tokenToApproveL ? tokenToApproveL : undefined, // The ERC20 token contract address
        abi: ERC20_ABI, // Make sure ERC20_ABI includes the 'allowance' function
        functionName: 'allowance',
        args: address && tokenToApproveL && isAddress(tokenToApproveL)
            ? [address, CONTRACT_ADDRESS as Address] // owner, spender
            : undefined,
        enabled: !!address && !!tokenToApproveL && isAddress(tokenToApproveL) && !!CONTRACT_ADDRESS,
        watch: true, // Automatically refetch on relevant block changes or if args change
        onSuccess: (data) => {
            if (typeof data === 'bigint') {
                setCurrentAllowance(formatEther(data));
            } else {
                setCurrentAllowance('0'); // Or handle as error/unknown
            }
        },
        onError: (error) => {
            // console.error("Error fetching allowance:", error);
            setCurrentAllowance('Error'); // Indicate error or unknown
        }
    });


    const fetchReviewableApplications = useCallback(async () => {
        if (!isLenderActuallyRegistered || !address || !publicClient || typeof loanRequestCount === 'undefined') {
            setReviewableApplications([]);
            return;
        }
        setIsLoadingReviewableApps(true);
        // setMessage("Fetching loan applications for your review..."); // Message handled by effect
        const apps: ReviewableLoanApplicationSummary[] = [];
        try {
            for (let i = 1; i <= Number(loanRequestCount); i++) {
                try {
                    const hasApplication = await publicClient.readContract({
                        address: CONTRACT_ADDRESS as Address,
                        abi: CONTRACT_ABI,
                        functionName: 'loanApplications',
                        args: [BigInt(i), address as Address],
                    }) as boolean;

                    if (hasApplication) {
                        const loanData = await publicClient.readContract({
                            address: CONTRACT_ADDRESS as Address,
                            abi: CONTRACT_ABI,
                            functionName: 'loanRequests',
                            args: [BigInt(i)],
                        }) as LoanDataFromMapping;
                        
                        if (loanData && !loanData[9] && isZeroAddressValue(loanData[5]) && !loanData[10]) {
                            apps.push({
                                loanId: i.toString(),
                                borrower: loanData[0],
                                amountRequested: formatEther(loanData[2]),
                                tokenAddress: loanData[1],
                                requestedDueDate: new Date(Number(loanData[4]) * 1000).toLocaleDateString(),
                            });
                        }
                    }
                } catch (error) {
                    // console.warn(`Skipping loan ID ${i} while fetching reviewable apps:`, error);
                }
            }
            setReviewableApplications(apps.reverse());
            // setMessage(apps.length > 0 ? `${apps.length} loan application(s) ready for your review.` : "No pending loan applications for you to review at the moment.");
        } catch (error: any) {
            // console.error("Error fetching reviewable applications:", error);
            setMessage(`Error loading applications for review: ${error.message}`);
            setReviewableApplications([]);
        }
        setIsLoadingReviewableApps(false);
    }, [isLenderActuallyRegistered, address, publicClient, loanRequestCount]); // Removed setMessage

    useEffect(() => {
        if (isLenderActuallyRegistered && address && typeof loanRequestCount !== 'undefined') {
            fetchReviewableApplications();
        }
    }, [fetchReviewableApplications, isLenderActuallyRegistered, address, loanRequestCount]);

    const fetchFundableLoans = useCallback(async () => {
        if (!isLenderActuallyRegistered || !address || !publicClient || typeof loanRequestCount === 'undefined') {
            setFundableLoans([]);
            return;
        }
        setIsLoadingFundableLoans(true);
        // setMessage("Fetching loans you can fund..."); // Message handled by effect
        const loansToFund: FundableLoanSummary[] = [];
        try {
            for (let i = 1; i <= Number(loanRequestCount); i++) {
                try {
                    const loanData = await publicClient.readContract({
                        address: CONTRACT_ADDRESS as Address,
                        abi: CONTRACT_ABI,
                        functionName: 'loanRequests',
                        args: [BigInt(i)],
                    }) as LoanDataFromMapping;

                    if (loanData &&
                        typeof loanData[5] === 'string' && loanData[5].toLowerCase() === address.toLowerCase() &&
                        !loanData[9] &&
                        !loanData[10]
                    ) {
                        loansToFund.push({
                            loanId: i.toString(),
                            borrower: loanData[0],
                            tokenAddress: loanData[1],
                            amountAgreed: formatEther(loanData[6]),
                            rawAmountAgreed: loanData[6],
                            agreedDueDate: new Date(Number(loanData[8]) * 1000).toLocaleDateString(),
                        });
                    }
                } catch (error) {
                    // console.warn(`Skipping loan ID ${i} while fetching fundable loans:`, error);
                }
            }
            setFundableLoans(loansToFund.reverse());
            // setMessage(loansToFund.length > 0 ? `${loansToFund.length} loan(s) ready for you to fund.` : "No loans currently ready for you to fund.");
        } catch (error: any) {
            // console.error("Error fetching fundable loans:", error);
            setMessage(`Error loading fundable loans: ${error.message}`);
            setFundableLoans([]);
        }
        setIsLoadingFundableLoans(false);
    }, [isLenderActuallyRegistered, address, publicClient, loanRequestCount]); // Removed setMessage
    
    useEffect(() => {
        if (isLenderActuallyRegistered && address && typeof loanRequestCount !== 'undefined') {
            fetchFundableLoans();
        }
    }, [fetchFundableLoans, isLenderActuallyRegistered, address, loanRequestCount]);

    const activeLoanIdForDetails = loanIdToFund || loanIdToReview;

    const { data: loanDetailsDataLender, refetch: fetchLoanDetailsForLender, isLoading: isLoadingLoanDetailsLender } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'loanRequests',
        args: activeLoanIdForDetails && /^\d+$/.test(activeLoanIdForDetails) ? [BigInt(activeLoanIdForDetails)] : undefined,
        enabled: !!activeLoanIdForDetails && /^\d+$/.test(activeLoanIdForDetails),
        onSuccess: (data) => {
            setLoanDetailsForAction(data as LoanDataFromMapping | null);
            if (data) {
                const loan = data as LoanDataFromMapping;
                const currentDetailLoanId = activeLoanIdForDetails ? BigInt(activeLoanIdForDetails) : -1n;

                if (loanIdToFund && BigInt(loanIdToFund) === currentDetailLoanId) {
                    if (loan[1] && isAddress(loan[1])) setTokenToApproveL(loan[1]);
                    if (loan[6]) setAmountToApproveL(formatEther(loan[6]));
                } else if (loanIdToReview && BigInt(loanIdToReview) === currentDetailLoanId) {
                    if (loan[1] && isAddress(loan[1])) setTokenToApproveL(loan[1]);
                    setAmountToApproveL('');
                } else { // Neither loanIdToFund nor loanIdToReview matches, or one is not set
                    if (loanIdToReview && loan[1] && isAddress(loan[1])) { // Fallback to review if it's set
                         setTokenToApproveL(loan[1]);
                         setAmountToApproveL('');
                    } else if (loanIdToFund && loan[1] && isAddress(loan[1])) { // Fallback to fund if it's set
                         setTokenToApproveL(loan[1]);
                         if (loan[6]) setAmountToApproveL(formatEther(loan[6]));
                    } else { // Clear if no active selection context matches
                        setTokenToApproveL('');
                        setAmountToApproveL('');
                    }
                }
            } else { // No data, clear approval fields
                 setTokenToApproveL('');
                 setAmountToApproveL('');
            }
        },
        onError: () => {
            setLoanDetailsForAction(null);
            setMessage("Failed to fetch details for the selected loan.");
            setTokenToApproveL('');
            setAmountToApproveL('');
        }
    });

    const { write: registerLenderWrite, isLoading: isRegisteringLender } = useContractWrite({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'registerLender',
        onSuccess: (data) => {
            setMessage(`Registration as Lender submitted! Tx: ${data.hash.slice(0, 10)}...`);
        },
        onError: (error) => setMessage(`Lender Registration Error: ${error.message}`),
    });

    const { write: setRequiredProofsWrite, isLoading: isSettingProofs } = useContractWrite({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'setRequiredProofs',
        onSuccess: (data) => {
            setMessage(`Required proofs updated! Tx: ${data.hash.slice(0, 10)}...`);
        },
        onError: (error) => setMessage(`Set Required Proofs Error: ${error.message}`),
    });

    const { write: submitOfferWrite, isLoading: isSubmittingOffer } = useContractWrite({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'submitOffer',
        onSuccess: (data) => {
            setMessage(`Offer for loan ${loanIdToReview} submitted! Tx: ${data.hash.slice(0, 10)}...`);
            if (fetchLoanDetailsForLender) fetchLoanDetailsForLender();
            fetchReviewableApplications();
        },
        onError: (error) => setMessage(`Submit Offer Error: ${error.message}`),
    });


    const { write: approveTokenWriteL, isLoading: isApprovingTokenL } = useContractWrite({
        abi: ERC20_ABI,
        functionName: 'approve',
        onSuccess: (data) => {
            setMessage(`Token approval successful for ${amountToApproveL} tokens! Tx: ${data.hash.slice(0, 10)}... Checking new allowance.`);
            if (refetchAllowance) refetchAllowance(); // Refetch allowance after successful approval
        },
        onError: (error) => setMessage(`Token Approval Error: ${error.message}`),
    });

    useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LenderRegistered',
        listener(log: any[]) {
            const eventData = log[0].args;
            if (eventData.lender === address) {
                setMessage(`Congratulations! You are now confirmed as a registered lender.`);
                setIsLenderActuallyRegistered(true);
                if (refetchRequiredProofs) refetchRequiredProofs();
                refetchLoanCount();
            }
        },
    });

    useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LenderRequiredProofsSet',
        listener(log: any[]) {
            const eventData = log[0].args;
            if (eventData.lender === address) {
                setMessage(`Your required proof IDs have been updated on-chain.`);
                setCurrentRequiredProofs(eventData.requestIds || []);
            }
        },
    });
    
    useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LoanApplicationSent',
        listener(log: any[]) {
            const eventData = log[0].args;
            if (eventData.lender === address) {
                setMessage(`New loan application (ID: ${eventData.loanId}) received for your review! Refreshing list...`);
                fetchReviewableApplications();
            }
        },
    });
    
    useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LoanOfferSubmitted',
        listener(log: any[]) {
            const eventData = log[0].args;
            if (eventData.lender === address && eventData.loanId.toString() === loanIdToReview) {
                setMessage(`Your offer for Loan ID ${eventData.loanId} has been confirmed on-chain.`);
                fetchReviewableApplications();
            }
        },
    });
    
     useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LoanOfferAcceptedByBorrower',
        listener(log: any[]) {
            const eventData = log[0].args;
            if (eventData.lender === address) {
                setMessage(`Borrower accepted your offer for Loan ID: ${eventData.loanId}! You can now fund it.`);
                fetchFundableLoans();
                fetchReviewableApplications();
                if (eventData.loanId.toString() === loanIdToFund && fetchLoanDetailsForLender) {
                    fetchLoanDetailsForLender();
                }
                 // If the accepted loan was the one currently selected for review, clear review selection
                if (eventData.loanId.toString() === loanIdToReview) {
                    setLoanIdToReview('');
                }
            }
        },
    });

    const handleRegisterLender = () => {
        registerLenderWrite();
    };

    const handleSetRequiredProofs = () => {
        if (!requiredProofIdsInput) {
            setMessage("Please enter comma-separated proof request IDs (numbers).");
            return;
        }
        try {
            const ids = requiredProofIdsInput.split(',').map(id => BigInt(id.trim()));
             if (ids.some(id => isNaN(Number(id)))) throw new Error("Invalid number in IDs.");
            setRequiredProofsWrite({ args: [ids] });
        } catch (e) {
             setMessage("Invalid format for proof IDs. Please use comma-separated numbers (e.g., 1, 3, 4).");
        }
    };
    
    const handleSubmitOffer = () => {
        if (!loanIdToReview || !/^\d+$/.test(loanIdToReview)) { setMessage("Valid Loan ID from the list must be selected."); return; }
        if (!loanDetailsForAction) { setMessage("Loan details not loaded. Please select a loan and view details."); return;}
        if (!amountOffer || parseFloat(amountOffer) <= 0) { setMessage("A valid offer amount greater than zero is required."); return; }
        if (!paybackTimeOffer) { setMessage("A payback date is required."); return; }
        if (!interestOffer || parseFloat(interestOffer) < 0) { setMessage("A valid interest offer (e.g., 5.25 for 5.25%) is required."); return; }
    
        const dateParts = paybackTimeOffer.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        const paybackDateObj = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
        const paybackTimestamp = BigInt(Math.floor(paybackDateObj.getTime() / 1000));

        if (paybackTimestamp <= Math.floor(Date.now() / 1000)) {
            setMessage("Payback date must be in the future.");
            return;
        }
    
        const interestBps = BigInt(Math.round(parseFloat(interestOffer) * 100));
        const borrowerMaxInterestBps = loanDetailsForAction[3];

        if (interestBps > borrowerMaxInterestBps) {
            setMessage(`Your interest offer (${interestOffer}%) exceeds the borrower's maximum of ${Number(borrowerMaxInterestBps) / 100}%.`);
            return;
        }
    
        submitOfferWrite({
            args: [
                BigInt(loanIdToReview),
                parseEther(amountOffer),
                interestBps,
                paybackTimestamp,
                0n,
                0n
            ]
        });
    };

    const handleRejectApplication = () => {
        setIsRejectingApplication(true);
        setMessage('Rejecting applications is not supported with the new contract.');
        setTimeout(() => setIsRejectingApplication(false), 500);
    };

    const handleFundLoan = () => {
        setIsFundingLoan(true);
        setMessage('Funding loans is handled directly on the deployed loan contract.');
        setTimeout(() => setIsFundingLoan(false), 500);
    };

    const handleApproveTokenL = () => {
        if (!tokenToApproveL || !isAddress(tokenToApproveL)) { setMessage("Invalid Token Address for approval."); return; }
        if (!amountToApproveL || parseFloat(amountToApproveL) <= 0) { setMessage("Amount to approve must be greater than 0."); return; }

        approveTokenWriteL({
            address: tokenToApproveL as Address,
            args: [CONTRACT_ADDRESS as Address, parseEther(amountToApproveL)]
        });
    };
    
    const handleReviewLoanSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLoanId = event.target.value;
        setLoanIdToReview(newLoanId);
        setLoanIdToFund('');
        if (newLoanId) {
            // setMessage(`Fetching details for Loan ID ${newLoanId} to review...`); // Let useContractRead handle its loading state
            const selectedApp = reviewableApplications.find(app => app.loanId === newLoanId);
            if (selectedApp && isAddress(selectedApp.tokenAddress)) {
                setTokenToApproveL(selectedApp.tokenAddress);
                setAmountToApproveL('');
            } else {
                 setTokenToApproveL('');
                 setAmountToApproveL('');
            }
        } else {
            setLoanDetailsForAction(null);
            setTokenToApproveL('');
            setAmountToApproveL('');
            // setMessage("Select a loan application to review.");
        }
    };

    const handleFundableLoanSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLoanId = event.target.value;
        setLoanIdToFund(newLoanId);
        setLoanIdToReview('');
        if (newLoanId) {
            // setMessage(`Fetching details for Loan ID ${newLoanId} to fund...`); // Let useContractRead handle its loading state
            const selectedFundableLoan = fundableLoans.find(loan => loan.loanId === newLoanId);
            if (selectedFundableLoan && isAddress(selectedFundableLoan.tokenAddress)) {
                setTokenToApproveL(selectedFundableLoan.tokenAddress);
                setAmountToApproveL(selectedFundableLoan.amountAgreed);
            } else {
                setTokenToApproveL('');
                setAmountToApproveL('');
            }
        } else {
            setLoanDetailsForAction(null);
            setTokenToApproveL('');
            setAmountToApproveL('');
            // setMessage("Select a loan to fund.");
        }
    };
    
    const isZeroAddressValue = (addrValue: Address | bigint | null | undefined): boolean => {
        const ZERO_ADDRESS_STRING = '0x0000000000000000000000000000000000000000';
        if (addrValue === null || typeof addrValue === 'undefined') return true;
        if (typeof addrValue === 'bigint') return addrValue === 0n;
        return addrValue.toLowerCase() === ZERO_ADDRESS_STRING;
    };
    
    const renderLenderRequiredProofsList = () => {
        if (isLoadingProofs) return <p className="text-slate-400 mt-2">Loading your required proofs...</p>;
        if (!currentRequiredProofs || currentRequiredProofs.length === 0) return <p className="text-slate-400 mt-2">You have not set any required proof IDs.</p>;

        return (
            <div className="mt-2 text-sm text-slate-300">
                <p className="font-semibold">Your current required proof IDs:</p>
                <ul className="list-disc list-inside bg-slate-700 p-2 rounded-md mt-1">
                    {currentRequiredProofs.map((id, index) => <li key={index}><span className="font-mono">{id.toString()}</span></li>)}
                </ul>
            </div>
        );
    };

    const renderLoanForActionCard = (loan: LoanDataFromMapping | null, actionContextLoanId: string) => {
        if (isLoadingLoanDetailsLender && actionContextLoanId && (actionContextLoanId === loanIdToReview || actionContextLoanId === loanIdToFund)) {
            return <p className="text-slate-400 mt-2">Loading loan details for ID: {actionContextLoanId}...</p>;
        }
        if (!loan || !loan[0] || isZeroAddressValue(loan[0] as Address)) {
            if (actionContextLoanId) {
                return <p className="text-slate-400 mt-2">No valid details found for Loan ID {actionContextLoanId}, or details not loaded yet.</p>;
            }
            return <p className="text-slate-400 mt-2">Select a loan to view its details.</p>;
        }
        
        const [borrower, token, amountRequested, maxInterestBps, requestedDueDate, selectedLenderRaw, amountAgreed, interestBpsAgreed, agreedDueDate, funded, repaid] = loan;
        const selectedLender = typeof selectedLenderRaw === 'bigint' ? (selectedLenderRaw === 0n ? '0x0000000000000000000000000000000000000000' : selectedLenderRaw.toString()) : selectedLenderRaw;

        return (
            <div className="mt-4 p-4 bg-slate-700 rounded-lg shadow space-y-2 text-sm">
                <h4 className="text-md font-semibold text-purple-300">Details for Loan ID: {actionContextLoanId}</h4>
                <p><strong>Borrower:</strong> <span className="font-mono text-xs">{borrower}</span></p>
                <p><strong>Token:</strong> <span className="font-mono text-xs">{token}</span></p>
                <p><strong>Amount Requested:</strong> {formatEther(amountRequested)} Tokens</p>
                <p><strong>Borrower's Max Interest:</strong> {Number(maxInterestBps) / 100}%</p>
                <p><strong>Requested Due Date:</strong> {new Date(Number(requestedDueDate) * 1000).toLocaleDateString()}</p>
                
                {!isZeroAddressValue(selectedLender) && (
                    <>
                        <p><strong>Selected Lender:</strong> <span className="font-mono text-xs">{selectedLender} {(typeof selectedLender === 'string' && selectedLender.toLowerCase()) === address?.toLowerCase() ? <span className="text-purple-300">(You)</span> : ""}</span></p>
                        <p><strong>Amount Agreed:</strong> {formatEther(amountAgreed)} Tokens</p>
                        <p><strong>Interest Agreed:</strong> {Number(interestBpsAgreed) / 100}%</p>
                        <p><strong>Agreed Due Date:</strong> {new Date(Number(agreedDueDate) * 1000).toLocaleDateString()}</p>
                    </>
                )}

                <p><strong>Status:</strong>
                    {funded ? (<span className="text-green-400 font-semibold">Funded</span>)
                           : (<span className="text-yellow-400 font-semibold">Not Funded</span>)}
                    {repaid && <span className="text-green-400 font-semibold ml-2">(Repaid)</span>}
                </p>
            </div>
        );
    };

    const inputClass = "mt-1 block w-full rounded-md bg-slate-700 border-slate-600 shadow-sm focus:border-purple-500 focus:ring focus:ring-purple-500 focus:ring-opacity-50 text-gray-200 py-2 px-3 placeholder-slate-400 disabled:bg-slate-800 disabled:cursor-not-allowed";
    const buttonClass = (loading: boolean = false, disabled: boolean = false) => `w-full bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed shadow-md ${(loading || disabled) ? 'opacity-70 cursor-not-allowed' : ''}`;
    const labelClass = "block text-sm font-medium text-purple-300";
    const cardClass = "bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700";
    
    const menuButtonClass = (section: 'setup' | 'review' | 'fund', disabled: boolean = false) => {
        const baseClass = "px-6 py-2.5 rounded-lg font-semibold transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed";
        if (activeSection === section) {
            return `${baseClass} bg-purple-600 text-white`;
        } else {
            return `${baseClass} bg-slate-700 text-slate-300 hover:bg-slate-600`;
        }
    };

    const canFundSelectedLoan = !!loanIdToFund && !!loanDetailsForAction &&
        typeof loanDetailsForAction[5] === 'string' && loanDetailsForAction[5].toLowerCase() === address?.toLowerCase() &&
        !loanDetailsForAction[9] &&
        !loanDetailsForAction[10];


    return (
        <div className="space-y-8 p-4 md:p-8 max-w-4xl mx-auto">
            <h2 className="text-3xl font-semibold text-center text-purple-400">Lender Dashboard</h2>
            <div className="text-center text-slate-400">
                <p>Connected: <span className="font-mono text-purple-300">{address ? `${address.slice(0,6)}...${address.slice(-4)}` : "Not Connected"}</span></p>
            </div>
            
            {message && (
                <div className={`p-3 rounded-md text-center text-sm ${
                    message.toLowerCase().includes("error") || message.toLowerCase().includes("failed") ? 'bg-red-800 text-red-200 border-red-600'
                    : message.toLowerCase().includes("success") || message.toLowerCase().includes("confirmed") || message.toLowerCase().includes("submitted") || message.toLowerCase().includes("updated") || message.toLowerCase().includes("loaded") || message.toLowerCase().includes("ready") || message.toLowerCase().includes("checking") ? 'bg-green-800 text-green-200 border-green-600'
                    : 'bg-slate-700 text-sky-200 border-slate-600'
                }` }>
                    {message}
                </div>
            )}

            {/* --- Menu Buttons --- */}
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <button onClick={() => setActiveSection('setup')} className={menuButtonClass('setup')}>
                    1. Lender Setup
                </button>
                <button onClick={() => setActiveSection('review')} className={menuButtonClass('review', !isLenderActuallyRegistered)} disabled={!isLenderActuallyRegistered}>
                    2. Review & Offer
                </button>
                <button onClick={() => setActiveSection('fund')} className={menuButtonClass('fund', !isLenderActuallyRegistered)} disabled={!isLenderActuallyRegistered}>
                    3. Approve & Fund
                </button>
            </div>

            {/* Section 1: Lender Setup */}
            {activeSection === 'setup' && (
                <div className={cardClass}>
                    <h3 className="text-xl font-semibold mb-4 text-purple-400">1. Lender Setup</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg">
                            <p className={labelClass}>Your Registration Status:</p>
                            {isLenderActuallyRegistered ?
                                <span className="font-bold text-green-400">Registered</span> :
                                <span className="font-bold text-yellow-400">Not Registered</span>
                            }
                        </div>

                        {!isLenderActuallyRegistered && (
                            <div>
                                <p className="text-sm text-slate-300 mb-2">Become a lender on the platform to start offering and funding loans.</p>
                                <button onClick={handleRegisterLender} disabled={isRegisteringLender || !address} className={buttonClass(isRegisteringLender, !address)}>
                                    {isRegisteringLender ? 'Registering...' : 'Register as Lender'}
                                </button>
                            </div>
                        )}
                        
                        {isLenderActuallyRegistered && (
                            <div>
                                <label htmlFor="proofIdsL" className={labelClass}>
                                    Set Your Required Proof IDs
                                    <InfoIcon />
                                    <span className="text-xs text-slate-400 font-normal block mt-1">
                                        Define which proofs a borrower must satisfy. Comma-separated numbers (e.g., 1, 3, 4).
                                    </span>
                                </label>
                                <input id="proofIdsL" type="text" value={requiredProofIdsInput} onChange={(e) => setRequiredProofIdsInput(e.target.value)} placeholder="1, 3, 4" className={inputClass} />
                                <button onClick={handleSetRequiredProofs} disabled={isSettingProofs || !requiredProofIdsInput} className={`${buttonClass(isSettingProofs, !requiredProofIdsInput)} mt-3`}>
                                    {isSettingProofs ? 'Updating...' : 'Set Required Proofs'}
                                </button>
                                {renderLenderRequiredProofsList()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Section 2: Review Loan Application & Make Offer */}
            {activeSection === 'review' && (
                <div className={cardClass}>
                    <h3 className="text-xl font-semibold mb-4 text-purple-400">2. Review Loan Application & Make Offer</h3>
                    {!isLenderActuallyRegistered && (
                        <p className="text-sm text-yellow-500 -mt-2 mb-4">You must be a registered lender to review applications or make offers.</p>
                    )}
                    <p className="text-sm text-slate-400 mb-4">Select a loan application sent to you. Review the borrower's request and decide.</p>
                    
                    <div>
                        <label htmlFor="loanIdReviewSelectL" className={labelClass}>Select Loan Application to Review</label>
                        <select
                            id="loanIdReviewSelectL"
                            value={loanIdToReview}
                            onChange={handleReviewLoanSelectionChange}
                            className={inputClass}
                            disabled={!isLenderActuallyRegistered || isLoadingReviewableApps || reviewableApplications.length === 0}
                        >
                            <option value="">
                                {isLoadingReviewableApps ? "Loading applications..." :
                                 !isLenderActuallyRegistered ? "Register first" :
                                 reviewableApplications.length === 0 ? "No applications to review" :
                                 "-- Select an Application --"}
                            </option>
                            {reviewableApplications.map(app => (
                                <option key={app.loanId} value={app.loanId}>
                                    ID: {app.loanId} - Borrower: {app.borrower.slice(0,6)}... - {app.amountRequested} Tokens ({app.tokenAddress.slice(0,6)}...)
                                </option>
                            ))}
                        </select>
                    </div>

                    {loanIdToReview && renderLoanForActionCard(loanDetailsForAction, loanIdToReview)}

                    {loanIdToReview && loanDetailsForAction &&
                        !loanDetailsForAction[9] &&
                        isZeroAddressValue(loanDetailsForAction[5]) &&
                        !loanDetailsForAction[10] &&
                        isLenderActuallyRegistered &&
                        (
                            <div className="mt-6 pt-4 border-t border-slate-700 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label htmlFor="amountOfferL" className={labelClass}>Your Amount Offer</label>
                                        <input id="amountOfferL" type="number" value={amountOffer} onChange={(e) => setAmountOffer(e.target.value)} placeholder={`e.g., ${loanDetailsForAction ? formatEther(loanDetailsForAction[2]) : '0.0'}`} className={inputClass} />
                                    </div>
                                    <div>
                                        <label htmlFor="paybackTimeOfferL" className={labelClass}>Your Payback Date</label>
                                        <input id="paybackTimeOfferL" type="date" value={paybackTimeOffer} onChange={(e) => setPaybackTimeOffer(e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label htmlFor="interestOfferL" className={labelClass}>Your Interest Offer (%)</label>
                                        <input id="interestOfferL" type="number" value={interestOffer} onChange={(e) => setInterestOffer(e.target.value)} placeholder={`e.g., 5.25 (max ${loanDetailsForAction ? Number(loanDetailsForAction[3])/100 : 0}%)`} className={inputClass} />
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mt-4">
                                    <button onClick={handleSubmitOffer} disabled={isSubmittingOffer || !interestOffer || !amountOffer || !paybackTimeOffer} className={`${buttonClass(isSubmittingOffer, !interestOffer || !amountOffer || !paybackTimeOffer)} flex-1`}>
                                        {isSubmittingOffer ? 'Submitting Offer...' : 'Submit Offer'}
                                    </button>
                                    <button onClick={handleRejectApplication} disabled={isRejectingApplication} className={`w-full sm:w-auto bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors disabled:bg-slate-500 shadow-md flex-1 ${isRejectingApplication ? 'opacity-70 cursor-wait' : ''}`}>
                                        {isRejectingApplication ? 'Rejecting...' : 'Reject Application'}
                                    </button>
                                </div>
                                {loanDetailsForAction && loanDetailsForAction[3] && interestOffer && (parseFloat(interestOffer) * 100 > Number(loanDetailsForAction[3])) &&
                                    <p className="text-xs text-red-400 mt-1">Your interest offer exceeds borrower's max of {Number(loanDetailsForAction[3]) / 100}%.</p>
                                }
                            </div>
                        )}
                        {loanIdToReview && loanDetailsForAction && (loanDetailsForAction[9] || !isZeroAddressValue(loanDetailsForAction[5]) || loanDetailsForAction[10]) &&
                            <p className="text-sm text-slate-400 mt-4">This loan is either funded, repaid, or an offer is accepted. No further review actions.</p>
                        }
                </div>
            )}

            {/* Section 3: Token Approval & Fund Accepted Loan */}
            {activeSection === 'fund' && (
                <div className={cardClass}>
                    <h3 className="text-xl font-semibold mb-4 text-purple-400">3. Token Approval & Fund Accepted Loan</h3>
                    {!isLenderActuallyRegistered && (
                        <p className="text-sm text-yellow-500 -mt-2 mb-4">You must be a registered lender to approve tokens or fund loans.</p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 3A: Approve Contract to Spend */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-medium text-purple-300">A. Approve Contract to Spend</h4>
                            <p className="text-sm text-slate-400">Approve the loan contract to handle tokens. Select a loan to fund in section B to pre-fill details, or a loan to review in section 2.</p>
                            <div>
                                <label htmlFor="tokenApproveLInput" className={labelClass}>Token Address to Approve</label>
                                <input
                                    id="tokenApproveLInput"
                                    type="text"
                                    value={tokenToApproveL}
                                    onChange={(e) => {
                                        const newAddr = e.target.value;
                                        if (isAddress(newAddr)) {
                                            setTokenToApproveL(newAddr as Address);
                                        } else {
                                            setTokenToApproveL(''); // Or keep invalid input and show error
                                        }
                                    }}
                                    placeholder="Token Address (0x...)"
                                    className={inputClass}
                                    disabled={!isLenderActuallyRegistered}
                                />
                            </div>
                            <div>
                                <label htmlFor="amountApproveL" className={labelClass}>Amount to Approve</label>
                                <input
                                    id="amountApproveL"
                                    type="number"
                                    value={amountToApproveL}
                                    onChange={(e) => setAmountToApproveL(e.target.value)}
                                    placeholder="Amount (e.g., 100.0)"
                                    className={inputClass}
                                    disabled={!isLenderActuallyRegistered || !tokenToApproveL}
                                />
                            </div>
                            {isLenderActuallyRegistered && tokenToApproveL && isAddress(tokenToApproveL) && (
                                <p className="text-sm text-slate-300 mt-2 bg-slate-700 p-2 rounded-md">
                                    Current Allowance: <span className="font-semibold text-purple-300">{isLoadingAllowance ? "Loading..." : `${currentAllowance} tokens`}</span>
                                    <br /> for contract <span className="font-mono text-xs">{CONTRACT_ADDRESS.slice(0,6)}...{CONTRACT_ADDRESS.slice(-4)}</span>
                                </p>
                            )}
                            <button
                                onClick={handleApproveTokenL}
                                disabled={
                                    !isLenderActuallyRegistered ||
                                    isApprovingTokenL ||
                                    !tokenToApproveL ||
                                    !isAddress(tokenToApproveL) ||
                                    !amountToApproveL ||
                                    parseFloat(amountToApproveL) <= 0
                                }
                                className={buttonClass(
                                    isApprovingTokenL,
                                    !isLenderActuallyRegistered || !tokenToApproveL || !isAddress(tokenToApproveL) || !amountToApproveL || parseFloat(amountToApproveL) <= 0
                                )}
                            >
                                {isApprovingTokenL ? 'Approving...' : 'Approve Tokens'}
                            </button>
                        </div>

                        {/* 3B: Fund an Accepted Loan */}
                        <div className="space-y-4">
                             <h4 className="text-lg font-medium text-purple-300">B. Fund an Accepted Loan</h4>
                            <p className="text-sm text-slate-400">Select a loan from the list below that the borrower has accepted your offer for.</p>
                            <div>
                                <label htmlFor="loanIdFundSelectL" className={labelClass}>Select Loan to Fund</label>
                                <select
                                    id="loanIdFundSelectL"
                                    value={loanIdToFund}
                                    onChange={handleFundableLoanSelectionChange}
                                    className={inputClass}
                                    disabled={!isLenderActuallyRegistered || isLoadingFundableLoans || fundableLoans.length === 0}
                                >
                                    <option value="">
                                        {isLoadingFundableLoans ? "Loading fundable loans..." :
                                         !isLenderActuallyRegistered ? "Register first" :
                                         fundableLoans.length === 0 ? "No loans to fund" :
                                         "-- Select a Loan to Fund --"}
                                    </option>
                                    {fundableLoans.map(loan => (
                                        <option key={loan.loanId} value={loan.loanId}>
                                             ID: {loan.loanId} - Borrower: {loan.borrower.slice(0,6)}... - {loan.amountAgreed} Tokens ({loan.tokenAddress.slice(0,6)}...)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            {loanIdToFund && renderLoanForActionCard(loanDetailsForAction, loanIdToFund)}
                            
                            {isLenderActuallyRegistered && loanIdToFund && canFundSelectedLoan && (
                                <button onClick={handleFundLoan} disabled={isFundingLoan} className={`${buttonClass(isFundingLoan)} mt-3`}>
                                    {isFundingLoan ? 'Funding Loan...' : `Fund Loan ${loanIdToFund}`}
                                </button>
                            )}
                             {isLenderActuallyRegistered && loanIdToFund && loanDetailsForAction && !canFundSelectedLoan && (
                                 <p className="text-sm text-slate-400 mt-2">
                                     { loanDetailsForAction[9] ? "This loan is already funded." :
                                       loanDetailsForAction[10] ? "This loan has been repaid." :
                                       (typeof loanDetailsForAction[5] !== 'string' || loanDetailsForAction[5].toLowerCase() !== address?.toLowerCase()) ? "You are not the selected lender." :
                                       "Cannot fund this loan. Ensure offer accepted, not funded/repaid."
                                     }
                                 </p>
                             )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LenderView;