// BorrowerView.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useContractWrite, useContractRead, useContractEvent, usePublicClient } from 'wagmi';

import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI, WALLET_URL, TOKEN_ADDRESS_LIST  } from '@/config/contract';
import { CREDIT_LOAN_ABI } from '@/config/creditloan_abi';
import { parseEther, formatEther, isAddress, Address } from 'viem';


const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
);

type LoanDetailsFromMapping = [
    Address, // 0: borrower
    Address, // 1: token
    bigint,  // 2: amountRequested
    bigint,  // 3: maxInterestBps
    bigint,  // 4: requestedDueDate
    Address | bigint, // 5: selectedLender
    bigint,  // 6: amountAgreed
    bigint,  // 7: interestBpsAgreed
    bigint,  // 8: agreedDueDate
    boolean, // 9: funded
    boolean  // 10: repaid
];


type Offer = {
    lender: Address;
    amountOffered: bigint;
    paybackTimeOffered: bigint;
    interestBpsOffered: bigint;
};

type UserLoanSummary = {
    id: string;
    amountRequested: string; 
    requestedDueDate: string; 
    status: string;
    tokenAddress: Address; 
    rawBorrowerAddress: Address; 
};


function BorrowerView() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [message, setMessage] = useState<string>('');

    const [selectedToken, setSelectedToken] = useState<string>(TOKEN_ADDRESS_LIST.length > 0 ? TOKEN_ADDRESS_LIST[0].address : '');
    const [customTokenAddress, setCustomTokenAddress] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [maxInterest, setMaxInterest] = useState<string>('');
    const [dueDateInput, setDueDateInput] = useState<string>('');
    
    const [selectedLoanId, setSelectedLoanId] = useState<string>(''); 
    
    const [lenderToApply, setLenderToApply] = useState<string>('');

    const [offersForLoan, setOffersForLoan] = useState<Offer[]>([]);
    const [currentLoanDetails, setCurrentLoanDetails] = useState<LoanDetailsFromMapping | null>(null);

    const [lenderRequiredProofIds, setLenderRequiredProofIds] = useState<bigint[]>([]);
    const [isLoadingLenderProofs, setIsLoadingLenderProofs] = useState<boolean>(false);
    const [lenderProofsError, setLenderProofsError] = useState<string>('');

    const [tokenToApprove, setTokenToApprove] = useState<Address | string>(''); // Used for approval section
    const [amountToApprove, setAmountToApprove] = useState<string>(''); // Used for approval section
    const [currentBorrowerAllowance, setCurrentBorrowerAllowance] = useState<string>('0'); // NEW: For displaying allowance

    const [credentialRequestIdsInput, setCredentialRequestIdsInput] = useState('');
    const [processedRequestIds, setProcessedRequestIds] = useState<string[]>([]);
    const [clickedRequestIds, setClickedRequestIds] = useState<Set<string>>(new Set());
    const [isGeneratingCredential, setIsGeneratingCredential] = useState<string | null>(null);

    const [userLoans, setUserLoans] = useState<UserLoanSummary[]>([]);
    const [isLoadingUserLoans, setIsLoadingUserLoans] = useState<boolean>(false);

    const [processingOfferIndex, setProcessingOfferIndex] = useState<number | null>(null);

    const finalTokenAddress = selectedToken === 'custom' ? customTokenAddress : selectedToken;

    useEffect(() => {
        if (message) {
            // console.log("Message updated:", message); // Keep for debugging if needed
        }
    }, [message]);

    // --- Contract Reads ---

    const { data: loanRequestCount, refetch: refetchLoanRequestCount, isLoading: isLoadingLoanRequestCount } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'loanRequestCount',
        watch: true,
    });

    // Fetch user loan summaries
    useEffect(() => {
        const fetchUserLoanSummaries = async () => {
            if (!loanRequestCount || Number(loanRequestCount) === 0 || !address || !publicClient) {
                setUserLoans([]);
                return;
            }
            setIsLoadingUserLoans(true);
            // setMessage("Fetching your loan summaries..."); // Message handling can be more subtle
            const summaries: UserLoanSummary[] = [];
            try {
                for (let i = 1; i <= Number(loanRequestCount); i++) {
                    try {
                        const loanData = await publicClient.readContract({
                            address: CONTRACT_ADDRESS as Address,
                            abi: CONTRACT_ABI, 
                            functionName: 'loanRequests',
                            args: [BigInt(i)],
                        }) as LoanDetailsFromMapping; 

                        if (loanData && loanData[0].toLowerCase() === address.toLowerCase()) {
                            const [
                                borrower, token, amountReq, , reqDueDate, 
                                selectedLenderRaw, , , , fundedStatus, repaidStatus 
                            ] = loanData;

                            let status = "Requested";
                            if (repaidStatus) status = "Repaid";
                            else if (fundedStatus) status = "Funded";
                            else if (!isZeroAddressValue(selectedLenderRaw)) { // Check if selectedLender is not zero
                                status = "Offer Accepted";
                            }

                            summaries.push({
                                id: i.toString(),
                                amountRequested: formatEther(amountReq),
                                requestedDueDate: new Date(Number(reqDueDate) * 1000).toLocaleDateString(),
                                status: status,
                                tokenAddress: token,
                                rawBorrowerAddress: borrower,
                            });
                        }
                    } catch (error) {
                        // console.warn(`Error fetching summary for loan ID ${i}:`, error);
                    }
                }
                setUserLoans(summaries.reverse()); 
                // setMessage(summaries.length > 0 ? "Your loan summaries loaded." : "No loans found for your address.");
            } catch (error: any) {
                // console.error("Error fetching user loan summaries:", error);
                setMessage(`Error loading your loans: ${error.message}`);
                setUserLoans([]);
            }
            setIsLoadingUserLoans(false);
        };

        fetchUserLoanSummaries();
    }, [loanRequestCount, address, publicClient]);

    // Fetch details for a selected loan
    const { data: loanDetailsDataFromMapping, refetch: fetchLoanDetails, isLoading: isLoadingLoanDetails, error: loanDetailsError } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'loanRequests',
        args: selectedLoanId && /^\d+$/.test(selectedLoanId) ? [BigInt(selectedLoanId)] : undefined,
        enabled: !!selectedLoanId && /^\d+$/.test(selectedLoanId), 
        onSuccess: (data) => {
            const typedData = data as LoanDetailsFromMapping;
            if (typedData && typedData[0] && address && typedData[0].toLowerCase() === address.toLowerCase()) {
                setCurrentLoanDetails(typedData);
                setMessage(`Details loaded for Your Loan ID: ${selectedLoanId}`);
                if (typedData[1] && isAddress(typedData[1])) { 
                    setTokenToApprove(typedData[1]); // Set token for approval section
                }
                // Automatically set amountToApprove if loan is funded and not repaid (for repayment context)
                if (typedData[9] && !typedData[10] && typedData[6]) { // funded, not repaid, amountAgreed exists
                    // Calculate total repayment: amountAgreed + (amountAgreed * interestBpsAgreed / 10000)
                    const principal = typedData[6];
                    const interestBps = typedData[7];
                    const interestAmount = (principal * interestBps) / 10000n; // 10000 because interestBps is out of 10000 (e.g. 500 for 5%)
                    const totalRepayment = principal + interestAmount;
                    setAmountToApprove(formatEther(totalRepayment));
                } else {
                    // Clear if not in repayment context or details missing
                   // setAmountToApprove(''); // Or keep it if user manually entered
                }

            } else if (typedData && typedData[0]) {
                setCurrentLoanDetails(null); 
                setMessage(`Details for Loan ID ${selectedLoanId} loaded, but it does not belong to you.`);
                setTokenToApprove(''); setAmountToApprove('');
            } else {
                setCurrentLoanDetails(null);
                setMessage(`Could not load valid details for Loan ID: ${selectedLoanId}.`);
                setTokenToApprove(''); setAmountToApprove('');
            }
        },
        onError: (error) => {
            setMessage(`Error fetching details for loan ${selectedLoanId}: ${error.message.substring(0,100)}...`);
            setCurrentLoanDetails(null);
            setTokenToApprove(''); setAmountToApprove('');
        }
    });

    // Fetch Lender's Required Proofs for application step
    const { data: fetchedLenderProofs, refetch: refetchLenderProofs, isLoading: isLoadingLenderProofsHook, error: lenderProofsFetchError } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'getRequiredProofs',
        args: lenderToApply && isAddress(lenderToApply) ? [lenderToApply as Address] : undefined,
        enabled: !!lenderToApply && isAddress(lenderToApply),
        onSuccess: (data) => {
            setLenderRequiredProofIds(data as bigint[]);
            setLenderProofsError('');
            // setMessage( (data as bigint[]).length > 0 ? "Lender's required proof IDs loaded." : "This lender does not require specific proofs.");
        },
        onError: (error) => {
            setLenderRequiredProofIds([]);
            if (error.message.toLowerCase().includes("lender not registered")) {
                setLenderProofsError("This address is not a registered lender.");
            } else {
                setLenderProofsError(`Error fetching lender's proofs: ${error.message.substring(0, 100)}...`);
            }
            // setMessage('');
        }
    });
     useEffect(() => {
        if (lenderToApply && isAddress(lenderToApply)) {
            setIsLoadingLenderProofs(isLoadingLenderProofsHook);
        } else {
            setIsLoadingLenderProofs(false);
            setLenderRequiredProofIds([]);
            setLenderProofsError('');
        }
    }, [lenderToApply, isLoadingLenderProofsHook]);

    // Fetch offers for the selected loan
    const { data: offersData, refetch: fetchOffersForLoan, isLoading: isLoadingOffers } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'getOffers', 
        args: selectedLoanId && /^\d+$/.test(selectedLoanId) ? [BigInt(selectedLoanId)] : undefined,
        enabled: !!selectedLoanId && /^\d+$/.test(selectedLoanId) && !!currentLoanDetails && !!address && currentLoanDetails[0].toLowerCase() === address.toLowerCase(),
        onSuccess: (data) => setOffersForLoan(data as Offer[]),
        onError: (error) => {
            setMessage(`Error fetching offers for loan ${selectedLoanId}: ${error.message}`);
            setOffersForLoan([]);
        }
    });

    // NEW: Fetch ERC20 Allowance for the borrower
    const { 
        data: borrowerAllowanceData, 
        refetch: refetchBorrowerAllowance, 
        isLoading: isLoadingBorrowerAllowance 
    } = useContractRead({
        address: tokenToApprove && isAddress(tokenToApprove) ? tokenToApprove as Address : undefined,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && tokenToApprove && isAddress(tokenToApprove) 
            ? [address, CONTRACT_ADDRESS as Address] // owner (borrower), spender (main contract)
            : undefined,
        enabled: !!address && !!tokenToApprove && isAddress(tokenToApprove) && !!CONTRACT_ADDRESS,
        watch: true, 
        onSuccess: (data) => {
            if (typeof data === 'bigint') {
                setCurrentBorrowerAllowance(formatEther(data));
            } else {
                setCurrentBorrowerAllowance('0');
            }
        },
        onError: (error) => {
            // console.error("Error fetching borrower allowance:", error);
            setCurrentBorrowerAllowance('Error');
        }
    });


    // --- Contract Writes ---
    const { write: requestLoanWrite, isLoading: isRequestingLoan, error: requestLoanError } = useContractWrite({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'requestLoan',
        onSuccess: (data) => {
            setMessage(`Loan request submitted! Tx: ${data.hash.slice(0, 10)}...`);
            if(refetchLoanCount) refetchLoanCount(); 
            setSelectedToken(TOKEN_ADDRESS_LIST.length > 0 ? TOKEN_ADDRESS_LIST[0].address : ''); 
            setCustomTokenAddress(''); setAmount(''); setMaxInterest(''); setDueDateInput('');
        },
        onError: (error) => setMessage(`Request Loan Error: ${error.message.substring(0,150)}...`),
    });

    const { write: sendLoanApplicationWrite, isLoading: isApplyingForLoan, error: sendApplicationError } = useContractWrite({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'sendLoanApplication',
        onSuccess: (data) => setMessage(`Successfully sent application for loan ${selectedLoanId}! Tx: ${data.hash.slice(0, 10)}...`),
        onError: (error) => setMessage(`Send Application Error: ${error.message.substring(0,150)}...`),
    });

    const { write: acceptOfferWrite, isLoading: isAcceptingOffer, error: acceptOfferError } = useContractWrite({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'acceptOffer',
        onSuccess: (data) => {
            setMessage(`Offer ${processingOfferIndex ?? 'selected'} for loan ${selectedLoanId} acceptance submitted! Tx: ${data.hash.slice(0, 10)}...`);
            if (fetchLoanDetails) fetchLoanDetails();
             setProcessingOfferIndex(null); 
        },
        onError: (error) => {
            setMessage(`Accept Offer Error (for index ${processingOfferIndex}): ${error.message.substring(0,150)}...`);
            setProcessingOfferIndex(null); 
        },
    });

    const { data: deployedLoanAddress } = useContractRead({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        functionName: 'deployedLoans',
        args: selectedLoanId && /^\d+$/.test(selectedLoanId) ? [BigInt(selectedLoanId)] : undefined,
        enabled: !!selectedLoanId && /^\d+$/.test(selectedLoanId),
    });

    const { write: repayLoanWrite, isLoading: isRepayingLoan, error: repayLoanError } = useContractWrite({
        address: deployedLoanAddress as Address,
        abi: CREDIT_LOAN_ABI,
        functionName: 'repay',
        onSuccess: (data) => {
            setMessage(`Loan ${selectedLoanId} repaid successfully! Tx: ${data.hash.slice(0, 10)}...`);
            if (fetchLoanDetails) fetchLoanDetails();
            if (refetchBorrowerAllowance) refetchBorrowerAllowance(); // Also refresh allowance
        },
        onError: (error) => setMessage(`Repay Loan Error: ${error.message.substring(0,150)}...`),
    });

    const { write: approveTokenWrite, isLoading: isApprovingToken, error: approveError } = useContractWrite({
        abi: ERC20_ABI, 
        functionName: 'approve',
        onSuccess: (data) => {
            setMessage(`Token approval successful for ${amountToApprove} tokens! Tx: ${data.hash.slice(0, 10)}...`);
            if (refetchBorrowerAllowance) refetchBorrowerAllowance(); // NEW: Refetch allowance after approval
        },
        onError: (error) => setMessage(`Token Approval Error: ${error.message.substring(0,150)}...`),
    });


    // --- Event Listeners ---
    useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LoanRequested',
        listener(logs: any[]) {
            const eventData = logs[0].args;
            if (eventData.borrower === address) {
                setMessage(`Tx Confirmed: Your new Loan (ID: ${eventData.loanId?.toString()}) is on-chain!`);
                if(refetchLoanCount) refetchLoanCount(); 
            }
        },
    });
     useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LoanApplicationSent',
        listener(logs: any[]) {
            const eventData = logs[0].args;
            if (eventData.borrower === address && selectedLoanId && BigInt(selectedLoanId) === eventData.loanId) {
                setMessage(`Tx Confirmed: Application for Loan ID ${eventData.loanId.toString()} sent to lender ${eventData.lender?.slice(0,6)}...`);
            }
        },
    });

    useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LoanOfferAcceptedByBorrower',
        listener(logs: any[]) {
            const eventData = logs[0].args;
            if (selectedLoanId && eventData.loanId !== undefined && BigInt(selectedLoanId) === eventData.loanId && eventData.borrower === address) {
                setMessage(`Tx Confirmed: Offer accepted for Your Loan ID ${eventData.loanId.toString()} from lender ${eventData.lender?.slice(0, 6)}...`);
                if (fetchLoanDetails) fetchLoanDetails();
                if(refetchLoanCount) refetchLoanCount(); 
            }
        },
    });

    useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LoanFunded',
        listener(logs: any[]) {
            const eventData = logs[0].args;
             if (selectedLoanId && eventData.loanId !== undefined && BigInt(selectedLoanId) === eventData.loanId && currentLoanDetails && currentLoanDetails[0] === address) {
                setMessage(`Tx Confirmed: Your Loan (ID: ${eventData.loanId.toString()}) has been funded by ${eventData.lender?.slice(0, 6)}...!`);
                if (fetchLoanDetails) fetchLoanDetails();
                if(refetchLoanCount) refetchLoanCount();
            }
        },
    });

    useContractEvent({
        address: CONTRACT_ADDRESS as Address,
        abi: CONTRACT_ABI,
        eventName: 'LoanRepaid',
        listener(logs: any[]) {
            const eventData = logs[0].args;
            if (selectedLoanId && eventData.loanId !== undefined && BigInt(selectedLoanId) === eventData.loanId && eventData.borrower === address) {
                setMessage(`Tx Confirmed: Your Loan (ID: ${eventData.loanId.toString()}) has been successfully repaid!`);
                if (fetchLoanDetails) fetchLoanDetails();
                if(refetchLoanCount) refetchLoanCount();
                 if (refetchBorrowerAllowance) refetchBorrowerAllowance(); // Refresh allowance after repayment too
            }
        },
    });


    // --- Handlers ---
    const handleRequestLoan = () => {
        if (!isAddress(finalTokenAddress)) { setMessage("Invalid Token Address."); return; }
        if (!amount || parseFloat(amount) <= 0) { setMessage("Amount must be greater than 0."); return; }
        if (!maxInterest || parseFloat(maxInterest) < 0 || parseFloat(maxInterest) > 1000 ) { setMessage("Max Interest must be between 0 and 1000%."); return; }
        if (!dueDateInput) { setMessage("A due date is required."); return; }

        const dateParts = dueDateInput.split('-'); 
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; 
        const day = parseInt(dateParts[2]);
        
        const dueDateObj = new Date(Date.UTC(year, month, day, 12, 0, 0, 0)); 
        const dueDateInSeconds = BigInt(Math.floor(dueDateObj.getTime() / 1000));
        const nowInSeconds = BigInt(Math.floor(Date.now() / 1000));

        if (dueDateInSeconds <= nowInSeconds) {
            setMessage(`Due date (${dueDateObj.toLocaleDateString()}) must be in the future.`);
            return;
        }
        
        const interestBps = BigInt(Math.round(parseFloat(maxInterest) * 100));
        requestLoanWrite({ args: [
            finalTokenAddress as Address,
            parseEther(amount),
            interestBps,
            1n,
            dueDateInSeconds,
            0n,
            0n
        ] });
    };

    const handleApplyForLoan = () => {
        if (!selectedLoanId || !/^\d+$/.test(selectedLoanId)) { setMessage("A valid Loan ID must be selected from the list first."); return; }
        if (!isAddress(lenderToApply)) { setMessage("Invalid Lender Address."); return; }
        if (!currentLoanDetails || !address || currentLoanDetails[0].toLowerCase() !== address.toLowerCase()) {
             setMessage("Selected loan does not belong to you or details not loaded."); return;
        }
        if (lenderProofsError && lenderProofsError.includes("not a registered lender")) {
            setMessage("Cannot apply: The entered address is not a registered lender.");
            return;
        }
        sendLoanApplicationWrite({ args: [BigInt(selectedLoanId), lenderToApply as Address] });
    };

    const handleAcceptOffer = (offerIndex: number) => { 
        if (!selectedLoanId || !/^\d+$/.test(selectedLoanId)) { setMessage("A valid Loan ID must be selected."); return; }
        if (offerIndex < 0 || offerIndex >= offersForLoan.length) { setMessage("Invalid Offer Index provided."); return; } 
        if (!currentLoanDetails || !address || currentLoanDetails[0].toLowerCase() !== address.toLowerCase()) {
             setMessage("Selected loan does not belong to you or details not loaded."); return;
        }
        setProcessingOfferIndex(offerIndex); 
        acceptOfferWrite({ args: [BigInt(selectedLoanId), BigInt(offerIndex)] });
    };

    const handleRepayLoan = () => {
        if (!selectedLoanId || !/^\d+$/.test(selectedLoanId)) { setMessage("A valid Loan ID must be selected to repay."); return; }
        if (!currentLoanDetails || !currentLoanDetails[1] || !address || currentLoanDetails[0].toLowerCase() !== address.toLowerCase()) {
            setMessage("Loan details not loaded for your loan. Please select your loan from the list first.");
            return;
        }
        const funded = currentLoanDetails[9]; 
        const repaid = currentLoanDetails[10]; 
        if (!funded) { setMessage("Loan is not funded yet."); return; }
        if (repaid) { setMessage("Loan has already been repaid."); return; }

        setMessage("Ensure you have approved enough tokens for repayment. Proceeding with repay transaction...");
        repayLoanWrite({ args: [parseEther(amountToApprove || '0')] });
    };

    const handleApproveToken = () => {
        if (!tokenToApprove || !isAddress(tokenToApprove)) { setMessage("Invalid Token Address for approval."); return; }
        if (!amountToApprove || parseFloat(amountToApprove) <= 0) { setMessage("Amount to approve must be greater than 0."); return; }
        approveTokenWrite({
            address: tokenToApprove as Address, 
            args: [CONTRACT_ADDRESS as Address, parseEther(amountToApprove)]
        });
    };
    
    const handleLoanSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLoanId = event.target.value;
        setSelectedLoanId(newLoanId); 
        setCurrentLoanDetails(null); 
        setOffersForLoan([]); 
        setTokenToApprove(''); // Clear previous token for approval
        setAmountToApprove(''); // Clear previous amount for approval
        setCurrentBorrowerAllowance('0'); // Reset allowance display

        if (newLoanId) {
            const selectedSummary = userLoans.find(loan => loan.id === newLoanId);
            if (selectedSummary && isAddress(selectedSummary.tokenAddress)) {
                setTokenToApprove(selectedSummary.tokenAddress); // Set for approval section based on summary
                // Amount to approve will be set in loanDetails onSuccess if repaying
            }
            // setMessage(`Fetching details for Loan ID: ${newLoanId}...`); // Details will be fetched by useContractRead
        } else {
            // setMessage("Select a loan to see details.");
        }
    };

    const handleRefreshLoanData = () => {
        if (!selectedLoanId) {
            setMessage("Please select a loan from the dropdown first to refresh.");
            return;
        }
        setMessage(`Refreshing data for Loan ID: ${selectedLoanId}...`);
        if (fetchLoanDetails) fetchLoanDetails(); 
        if (refetchBorrowerAllowance) refetchBorrowerAllowance(); // Also refresh allowance
    };

    const handleSendCredential = useCallback(async (requestId: string) => {
        if (!requestId) return;
        setIsGeneratingCredential(requestId);
        setMessage(`Generating credential for request ID: ${requestId}...`);
        try {
            if (!WALLET_URL) throw new Error("Wallet URL is not configured.");
            const response = await fetch(`/privado_payload/${requestId}.json`);
            if (!response.ok) {
                 if (response.status === 404) throw new Error(`Credential data file '/privado_payload/${requestId}.json' not found.`);
                 throw new Error(`Failed to fetch credential data for ID: ${requestId}. Status: ${response.status}`);
            }
            const payload = await response.json();
            const encodedPayload = btoa(JSON.stringify(payload)); 
            const url = `${WALLET_URL}${encodedPayload}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            setClickedRequestIds(prev => new Set(prev).add(requestId));
            setMessage(`Credential for ${requestId} opened in new tab. Please check your wallet.`);
        } catch (error: any) {
            setMessage(`Credential Generation Error: ${error.message}`);
        } finally {
            setIsGeneratingCredential(null);
        }
    }, [WALLET_URL]); 

    const handleProcessRequestIds = () => {
        const ids = credentialRequestIdsInput.split(',').map(id => id.trim()).filter(Boolean);
        setProcessedRequestIds(ids);
        setClickedRequestIds(new Set()); 
        if (ids.length > 0) {
            setMessage(`Generated ${ids.length} credential link(s). Click each to send to wallet.`);
        } else {
            setMessage("No request IDs entered.");
        }
    };

    const isZeroAddressValue = (addrValue: Address | bigint | null | undefined): boolean => {
        const ZERO_ADDRESS_STRING = '0x0000000000000000000000000000000000000000';
        if (addrValue === null || typeof addrValue === 'undefined') return true;
        if (typeof addrValue === 'bigint') return addrValue === 0n;
        return addrValue.toLowerCase() === ZERO_ADDRESS_STRING;
    };


    const renderLoanDetailsCard = (loanData: LoanDetailsFromMapping | null) => {
        if (!loanData || !loanData[0] || isZeroAddressValue(loanData[0] as Address)) { 
            if (selectedLoanId && !isLoadingLoanDetails) { 
                 return <p className="text-slate-400 mt-2">No details found for Loan ID {selectedLoanId}, or it's not your loan.</p>;
            }
            return null;
        }
        if (!address || loanData[0].toLowerCase() !== address.toLowerCase()){
            return <p className="text-orange-400 mt-2">Loan ID {selectedLoanId} does not belong to your connected address.</p>;
        }

        const [borrower, token, amountRequested, maxInterestBps, requestedDueDate, selectedLender, amountAgreed, interestBpsAgreed, agreedDueDate, funded, repaid] = loanData;
        
        const statusText = funded
            ? (repaid ? <span className="text-green-400 font-semibold">Repaid</span> : <span className="text-sky-400 font-semibold">Funded (Awaiting Repayment)</span>)
            : (!isZeroAddressValue(selectedLender) ? <span className="text-purple-400 font-semibold">Offer Accepted (Pending Funding)</span> : <span className="text-yellow-400 font-semibold">Offer Stage / Pending Application</span>);

        return (
            <div className="mt-4 p-4 bg-slate-700 rounded-lg shadow space-y-2 text-sm">
                <h4 className="text-md font-semibold text-sky-300">Details for Your Loan ID: {selectedLoanId}</h4>
                <p><strong>Status:</strong> {statusText}</p>
                <p><strong>Borrower:</strong> <span className="font-mono text-xs break-all">{borrower} (You)</span></p>
                <p><strong>Token:</strong> <span className="font-mono text-xs break-all">{token}</span></p>
                <p><strong>Amount Requested:</strong> {formatEther(amountRequested)} Tokens</p>
                <p><strong>Your Max Interest:</strong> {Number(maxInterestBps) / 100}%</p>
                <p><strong>Requested Due Date:</strong> {new Date(Number(requestedDueDate) * 1000).toLocaleDateString()}</p>
                
                {!isZeroAddressValue(selectedLender) && (
                    <div className="pt-2 mt-2 border-t border-slate-600">
                        <p><strong>Selected Lender:</strong> <span className="font-mono text-xs break-all">{typeof selectedLender === 'bigint' ? (selectedLender === 0n ? 'None' : selectedLender.toString()) : selectedLender}</span></p>
                        <p><strong>Agreed Amount:</strong> {formatEther(amountAgreed)} Tokens</p>
                        <p><strong>Agreed Interest:</strong> {Number(interestBpsAgreed) / 100}%</p>
                        <p><strong>Agreed Due Date:</strong> {new Date(Number(agreedDueDate) * 1000).toLocaleDateString()}</p>
                    </div>
                )}
            </div>
        );
    };

    const renderOffersList = (offers: Offer[]) => { 
        if (!currentLoanDetails || !address || currentLoanDetails[0].toLowerCase() !== address.toLowerCase()) return null; 

        if (isLoadingOffers) return <p className="text-slate-400">Loading offers for loan {selectedLoanId}...</p>;
        if (!offers || offers.length === 0) return <p className="text-slate-400">No offers yet for loan {selectedLoanId}.</p>;

        return (
            <div className="space-y-3 mt-4">
                <h4 className="text-md font-semibold text-sky-300">Offers Received for Loan ID: {selectedLoanId}</h4>
                {offers.map((offer, index) => (
                    <div key={index} className="p-3 bg-slate-700 rounded-lg shadow">
                        <p><strong>Offer Index: <span className="font-mono text-purple-300">{index}</span></strong></p>
                        <p>Lender: <span className="font-mono text-xs break-all">{offer.lender}</span></p>
                        <p>Amount Offered: {formatEther(offer.amountOffered)} Tokens</p>
                        <p>Interest Offered: {Number(offer.interestBpsOffered) / 100}%</p>
                        <p>Payback Date Offered: {new Date(Number(offer.paybackTimeOffered) * 1000).toLocaleDateString()}</p>
                        <button
                            onClick={() => handleAcceptOffer(index)}
                            disabled={isAcceptingOffer || !canAcceptOffer} 
                            className={`${buttonClass(isAcceptingOffer && processingOfferIndex === index, !canAcceptOffer || isAcceptingOffer)} mt-3 w-full`}
                        >
                            {isAcceptingOffer && processingOfferIndex === index ? 'Accepting...' : `Accept Offer (Index ${index})`}
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    const inputClass = "mt-1 block w-full rounded-md bg-slate-700 border-slate-600 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-500 focus:ring-opacity-50 text-gray-200 py-2 px-3 placeholder-slate-400";
    const buttonClass = (loading: boolean = false, disabled: boolean = false) => `w-full bg-sky-600 text-white px-4 py-2.5 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed shadow-md ${(loading || disabled) ? 'opacity-70 cursor-not-allowed' : ''}`;
    const secondaryButtonClass = (loading: boolean = false, disabled: boolean = false) => `bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed ${(loading || disabled) ? 'opacity-70 cursor-not-allowed' : ''}`;
    const labelClass = "block text-sm font-medium text-sky-300";
    const cardClass = "bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700";

    const isUsersSelectedLoan = !!currentLoanDetails && !!address && currentLoanDetails[0].toLowerCase() === address.toLowerCase();
    // Can accept offer if it's user's loan, no lender selected yet (still in offer stage), and not funded
    const canAcceptOffer = isUsersSelectedLoan && currentLoanDetails && isZeroAddressValue(currentLoanDetails[5]) && !currentLoanDetails[9];
    // Can repay if it's user's loan, it's funded, and not yet repaid
    const canRepay = isUsersSelectedLoan && currentLoanDetails && currentLoanDetails[9] && !currentLoanDetails[10]; 
    // Can apply to a lender if it's user's loan, not funded, and no offer has been accepted yet (selectedLender is zero)
    const canApply = isUsersSelectedLoan && currentLoanDetails && !currentLoanDetails[9] && isZeroAddressValue(currentLoanDetails[5]);


    return (
        <div className="space-y-8 p-4 md:p-8 max-w-4xl mx-auto">
            <h2 className="text-3xl font-semibold text-center text-sky-400">Borrower Dashboard</h2>
            <div className="text-center text-slate-400">
                <p>Connected: <span className="font-mono text-sky-300">{address ? `${address.slice(0,6)}...${address.slice(-4)}` : "Not Connected"}</span></p>
                <p>Total Loan Requests on Platform: {isLoadingLoanRequestCount ? 'Loading...' : (loanRequestCount?.toString() || '0')}</p>
            </div>

            {message && (
                 <div className={`p-3 rounded-md text-center text-sm ${
                       requestLoanError || sendApplicationError || acceptOfferError || repayLoanError || approveError || loanDetailsError || lenderProofsFetchError ? 'bg-red-800 text-red-200' 
                       : message.toLowerCase().includes("error") || message.toLowerCase().includes("failed") || message.toLowerCase().includes("denied") ? 'bg-red-800 text-red-200' 
                       : message.toLowerCase().includes("success") || message.toLowerCase().includes("confirmed") || message.toLowerCase().includes("loaded") ? 'bg-green-800 text-green-200' 
                       : 'bg-slate-700 text-sky-200'
                 } border ${
                       requestLoanError || sendApplicationError || acceptOfferError || repayLoanError || approveError || loanDetailsError || lenderProofsFetchError ? 'border-red-600' 
                       : message.toLowerCase().includes("error") || message.toLowerCase().includes("failed") || message.toLowerCase().includes("denied") ? 'border-red-600' 
                       : message.toLowerCase().includes("success") || message.toLowerCase().includes("confirmed") || message.toLowerCase().includes("loaded") ? 'border-green-600' 
                       : 'border-slate-600'
                 }`}>
                    {message}
                </div>
            )}


            {/* Section 1: Request a New Loan */}
            <div className={cardClass}>
                <h3 className="text-xl font-semibold mb-4 text-sky-400">1. Request a New Loan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="tokenAddressB" className={labelClass}>Token Address (ERC20)</label>
                        <select id="tokenAddressB" value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} className={inputClass}>
                            {TOKEN_ADDRESS_LIST.map(token => (
                                <option key={token.name} value={token.address}>
                                    {token.name} ({token.address.slice(0,6)}...)
                                </option>
                            ))}
                            <option value="custom">Custom Address</option>
                        </select>
                        {selectedToken === 'custom' && (
                            <input type="text" value={customTokenAddress} onChange={(e) => setCustomTokenAddress(e.target.value)} placeholder="Enter custom token address (0x...)" className={`${inputClass} mt-2`} />
                        )}
                    </div>
                    <div>
                        <label htmlFor="amountB" className={labelClass}>Amount to Borrow</label>
                        <input id="amountB" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 100" className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="maxInterestB" className={labelClass}>Max Interest You'll Pay (%)</label>
                        <input id="maxInterestB" type="number" value={maxInterest} onChange={(e) => setMaxInterest(e.target.value)} placeholder="e.g., 5.25 for 5.25%" className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="dueDateB" className={labelClass}>Preferred Due Date</label>
                        <input id="dueDateB" type="date" value={dueDateInput} onChange={(e) => setDueDateInput(e.target.value)} className={inputClass} />
                    </div>
                </div>
                <button 
                    onClick={handleRequestLoan} 
                    disabled={isRequestingLoan || !finalTokenAddress || !isAddress(finalTokenAddress) || !amount || !maxInterest || !dueDateInput} 
                    className={`${buttonClass(isRequestingLoan, !finalTokenAddress || !isAddress(finalTokenAddress) || !amount || !maxInterest || !dueDateInput)} mt-6`}
                >
                    {isRequestingLoan ? 'Submitting Request...' : 'Request Loan'}
                </button>
            </div>

            {/* Section 2: Manage Your Existing Loans */}
            <div className={cardClass}>
                <h3 className="text-xl font-semibold mb-4 text-sky-400">2. Manage Your Existing Loans</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
                    <div className="md:col-span-2">
                        <label htmlFor="selectLoanIdB" className={labelClass}>Select Your Loan</label>
                        <select 
                            id="selectLoanIdB" 
                            value={selectedLoanId} 
                            onChange={handleLoanSelectionChange}
                            className={inputClass}
                            disabled={isLoadingUserLoans || userLoans.length === 0}
                        >
                            <option value="">{isLoadingUserLoans ? "Loading your loans..." : userLoans.length === 0 ? "No loans found" : "-- Select a Loan --"}</option>
                            {userLoans.map(loan => (
                                <option key={loan.id} value={loan.id}>
                                    ID: {loan.id} - {loan.amountRequested} Tokens ({loan.tokenAddress.slice(0,6)}...), Due: {loan.requestedDueDate}, Status: {loan.status}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={handleRefreshLoanData} 
                        disabled={isLoadingLoanDetails || !selectedLoanId} 
                        className={`${buttonClass(isLoadingLoanDetails, !selectedLoanId)}`}
                    >
                        {isLoadingLoanDetails ? "Loading..." : "Refresh Loan Data"}
                    </button>
                </div>
                {isLoadingLoanDetails && selectedLoanId && <p className="text-slate-400 mt-2">Loading details for Loan ID: {selectedLoanId}...</p>}
                {renderLoanDetailsCard(currentLoanDetails)}
                {!selectedLoanId && !isLoadingLoanDetails && <p className="text-slate-400 mt-2">Select a loan to view details and actions.</p>}
            </div>

            {/* Conditional Sections based on selected loan state */}
            {isUsersSelectedLoan && currentLoanDetails && (
                 <div className="space-y-8"> 
                    {/* Section 3a: Send Application to Lender */}
                    {canApply && (
                        <div className={cardClass}>
                            <h3 className="text-xl font-semibold mb-4 text-sky-400">3a. Send Application to a Lender (for Loan ID: {selectedLoanId})</h3>
                            
                            <div>
                                <label htmlFor="lenderApplyB" className={labelClass}>Lender's Wallet Address</label>
                                <input 
                                    id="lenderApplyB" 
                                    type="text" 
                                    value={lenderToApply} 
                                    onChange={(e) => {
                                        setLenderToApply(e.target.value);
                                        setLenderRequiredProofIds([]);
                                        setLenderProofsError('');
                                    }} 
                                    placeholder="Enter Lender's Address (0x...) to see their requirements" 
                                    className={inputClass} 
                                />
                            </div>

                            {lenderToApply && isAddress(lenderToApply) && (
                                <div className="mt-4 p-3 bg-slate-700 rounded-md">
                                    {isLoadingLenderProofs && <p className="text-sky-300">Loading lender's requirements...</p>}
                                    {lenderProofsError && <p className="text-red-400">{lenderProofsError}</p>}
                                    {!isLoadingLenderProofs && !lenderProofsError && (
                                        <>
                                            <h5 className="text-md font-medium text-sky-300">Lender's Required ZKP Request IDs:</h5>
                                            {lenderRequiredProofIds.length > 0 ? (
                                                <ul className="list-disc list-inside text-slate-300 text-sm">
                                                    {lenderRequiredProofIds.map((id, index) => (
                                                        <li key={index} className="font-mono">{id.toString()}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-slate-400 text-sm">This lender does not require any specific ZKP requests.</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Credential Preparation */}
                            <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                                <h4 className="text-lg font-medium text-sky-300">Step 1 (Optional): Prepare Credentials via Wallet</h4>
                                <p className="text-sm text-yellow-300 bg-yellow-700 bg-opacity-40 border border-yellow-600 p-3 rounded-md my-4 flex items-start">
                                    <InfoIcon /> <span><strong>Important:</strong> If the lender requires specific Request IDs, use this to generate links to import corresponding credentials into your wallet.</span>
                                </p>
                                <div>
                                    <label htmlFor="credentialIds" className={labelClass}>Your Credential Request IDs (comma-separated)</label>
                                    <div className="flex flex-col md:flex-row gap-4 mt-1">
                                        <input id="credentialIds" type="text" value={credentialRequestIdsInput} onChange={(e) => setCredentialRequestIdsInput(e.target.value)} placeholder="e.g. 1234,5678" className={inputClass + ' flex-grow'} />
                                        <button onClick={handleProcessRequestIds} className={`${buttonClass(false)} md:w-auto`}>
                                            Generate Credential Links
                                        </button>
                                    </div>
                                </div>
                                {processedRequestIds.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {processedRequestIds.map(id => (
                                            <button key={id} onClick={() => handleSendCredential(id)} disabled={clickedRequestIds.has(id) || isGeneratingCredential !== null} className={`${secondaryButtonClass(isGeneratingCredential === id, clickedRequestIds.has(id) || isGeneratingCredential !== null)} w-full text-left p-2.5`}>
                                                {isGeneratingCredential === id ? `Generating for ${id}...` : clickedRequestIds.has(id) ? `✅ Link Opened (ID: ${id})` : `🚀 Send Credential for ID: ${id}`}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 pt-6 border-t border-slate-700">
                                <h4 className="text-lg font-medium text-sky-300">Step 2: Submit On-Chain Application</h4>
                                <p className="text-xs text-slate-400 mb-2">Ensure the Lender Address is correct. The contract checks for proofs.</p>
                                <button 
                                    onClick={handleApplyForLoan} 
                                    disabled={isApplyingForLoan || !lenderToApply || !isAddress(lenderToApply) || !!lenderProofsError} 
                                    className={`${buttonClass(isApplyingForLoan, !lenderToApply || !isAddress(lenderToApply) || !!lenderProofsError )} mt-6`}
                                >
                                    {isApplyingForLoan ? 'Submitting Application...' : `Apply to Lender for Loan ${selectedLoanId}`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Section 3b: View & Accept Offers */}
                     {canAcceptOffer && (
                        <div className={cardClass}>
                            <h3 className="text-xl font-semibold mb-4 text-sky-400">3b. View & Accept Offers (for Loan ID: {selectedLoanId})</h3>
                            {renderOffersList(offersForLoan)}
                        </div>
                    )}
                     {/* Message if loan is not in a state for applying or accepting offers */}
                     {isUsersSelectedLoan && currentLoanDetails && (!canApply && !canAcceptOffer && !currentLoanDetails[9]) && (
                         <div className={cardClass}>
                            <p className="text-slate-400 mt-4">
                                This loan (ID: {selectedLoanId}) is not currently in a stage for new applications or accepting offers. It might have an accepted offer pending funding.
                            </p>
                        </div>
                     )}


                </div> 
            )}
            
            {/* Section 4: Token Approval & Loan Repayment */}
            {/* This section is shown if a loan is selected AND it belongs to the user, regardless of its specific state, 
                as approval might be needed before repayment, or user might want to check allowance.
                The repay button itself will be enabled/disabled based on canRepay. */}
            {selectedLoanId && isUsersSelectedLoan && (
                <div className={cardClass}>
                    <h3 className="text-xl font-semibold mb-4 text-sky-400">4. Token Approval & Loan Repayment (for Loan ID: {selectedLoanId})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 4a: Approve Tokens */}
                        <div className="space-y-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                            <h4 className="text-lg font-medium text-sky-300">Step 4a: Approve Tokens</h4>
                            <p className="text-xs text-yellow-300 flex items-start"><InfoIcon/>Before repaying, approve the contract to spend your tokens. Token address should match the loan. Amount should cover principal + interest.</p>
                            <div>
                                <label htmlFor="tokenApproveB" className={labelClass}>Token Address to Approve</label>
                                <input 
                                    id="tokenApproveB" 
                                    type="text" 
                                    value={tokenToApprove} 
                                    onChange={(e) => setTokenToApprove(e.target.value)} 
                                    placeholder="Loan's Token Address (0x...)" 
                                    className={inputClass} 
                                    disabled={!isUsersSelectedLoan} // Only allow editing if it's their loan
                                />
                            </div>
                            <div>
                                <label htmlFor="amountApproveB" className={labelClass}>Amount to Approve</label>
                                <input 
                                    id="amountApproveB" 
                                    type="number" 
                                    value={amountToApprove} 
                                    onChange={(e) => setAmountToApprove(e.target.value)} 
                                    placeholder="e.g., Agreed Amount + Interest" 
                                    className={inputClass} 
                                    disabled={!isUsersSelectedLoan || !tokenToApprove}
                                />
                            </div>
                            {isUsersSelectedLoan && tokenToApprove && isAddress(tokenToApprove) && (
                                <p className="text-sm text-slate-300 mt-2 bg-slate-700 p-2 rounded-md">
                                    Current Allowance: <span className="font-semibold text-purple-300">{isLoadingBorrowerAllowance ? "Loading..." : `${currentBorrowerAllowance} tokens`}</span>
                                    <br /> for contract <span className="font-mono text-xs">{CONTRACT_ADDRESS.slice(0,6)}...{CONTRACT_ADDRESS.slice(-4)}</span> to spend.
                                </p>
                            )}
                            <button 
                                onClick={handleApproveToken} 
                                disabled={isApprovingToken || !tokenToApprove || !isAddress(tokenToApprove) || !amountToApprove || parseFloat(amountToApprove) <=0 || !isUsersSelectedLoan} 
                                className={`${buttonClass(isApprovingToken, !tokenToApprove || !isAddress(tokenToApprove) || !amountToApprove || parseFloat(amountToApprove) <=0 || !isUsersSelectedLoan)}`}
                            >
                                {isApprovingToken ? 'Approving...' : 'Approve Tokens'}
                            </button>
                        </div>
                        {/* 4b: Repay Loan */}
                        <div className="space-y-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                            <h4 className="text-lg font-medium text-sky-300">Step 4b: Repay Your Loan</h4>
                            <p className="text-xs text-yellow-300 flex items-start"><InfoIcon />Repay if loan is funded & not yet repaid. Ensure tokens are approved first.</p>
                            <button onClick={handleRepayLoan} disabled={!canRepay || isRepayingLoan} className={`${buttonClass(isRepayingLoan, !canRepay)}`}>
                                {isRepayingLoan ? 'Repaying Loan...' : `Repay Loan ${selectedLoanId || ''}`}
                            </button>
                            {isUsersSelectedLoan && currentLoanDetails && (
                                <>
                                    {currentLoanDetails[10] && <p className="text-green-400 mt-2 font-semibold">Loan ID: {selectedLoanId} has been repaid.</p>}
                                    {currentLoanDetails[9] && !currentLoanDetails[10] && <p className="text-sky-400 mt-2 font-semibold">Ready to repay Loan ID: {selectedLoanId}.</p>}
                                    {!currentLoanDetails[9] && !currentLoanDetails[10] && <p className="text-yellow-400 mt-2">Loan ID: {selectedLoanId} is not funded yet for repayment.</p>}
                                </>
                            )}
                             {!selectedLoanId && <p className="text-slate-400 mt-2">Select your loan to manage repayment.</p>}
                             {selectedLoanId && !isUsersSelectedLoan && !isLoadingLoanDetails &&
                                 <p className="text-red-400 mt-2">Selected loan is not yours.</p>
                             }
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}

export default BorrowerView;
