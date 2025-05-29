// LenderView.js
'use client';

import { useState, useEffect, AwaitedReactNode, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from 'react';
import { useAccount, useContractWrite, useContractRead, useContractEvent } from 'wagmi';
// Ensure this path is correct based on your project structure
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI } from '@/config/contract'; 
import { parseEther, formatEther, isAddress } from 'viem';

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block ml-1 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

function LenderView({ setGlobalMessage }: { setGlobalMessage: (msg: string) => void }) {
  const { address } = useAccount();
  const [message, setMessage] = useState<any>('');

  // Lender State
  const [requiredProofIdsInput, setRequiredProofIdsInput] = useState<any>(''); 
  
  // Loan Interaction State
  const [loanIdToReview, setLoanIdToReview] = useState<any>('');
  const [interestOffer, setInterestOffer] = useState<any>(''); 
  const [loanIdToFund, setLoanIdToFund] = useState<any>('');

  // Data display
  const [isLenderActuallyRegistered, setIsLenderActuallyRegistered] = useState<any>(false);
  const [currentRequiredProofs, setCurrentRequiredProofs] = useState<any>([]);
  const [loanDetailsForAction, setLoanDetailsForAction] = useState<any>(null); // For review or fund

  // ERC20 Approval State
  const [tokenToApproveL, setTokenToApproveL] = useState<any>('');
  const [amountToApproveL, setAmountToApproveL] = useState<any>('');

  useEffect(() => {
    if (message) {
      setGlobalMessage(message);
      const timer = setTimeout(() => {
        setMessage('');
        setGlobalMessage(''); 
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [message, setGlobalMessage]);

  // --- Contract Reads ---
  // Check if lender is registered and get their required proofs
  const { data: requiredProofsData, refetch: refetchRequiredProofs, isLoading: isLoadingProofs } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getRequiredProofs',
    args: address ? [address] : undefined,
    enabled: !!address,
    watch: true, // Keep an eye on this
    onSuccess: (data) => {
        // If data is an array (even empty), and no error, assume registered or registration attempt was made.
        // A more robust check would be a specific `isRegistered` contract function.
        // For now, if `getRequiredProofs` doesn't revert for a connected address, we can infer some state.
        // If it returns a non-empty array, they've set proofs. If empty, they are registered but haven't set proofs.
        // If it reverts with "Lender not registered", then they are not. This hook doesn't easily tell us about reverts vs empty data.
        // We will rely on the LenderRegistered event or successful registerLenderWrite call to set isLenderActuallyRegistered.
        setCurrentRequiredProofs(data || []);
    },
    onError: (error) => {
        // This might indicate the lender is not registered if the contract reverts.
        // However, wagmi's useContractRead might not clearly distinguish "not found" from "error".
        // console.warn("Error fetching required proofs (could mean not registered):", error.shortMessage);
        setCurrentRequiredProofs([]);
        setIsLenderActuallyRegistered(false); // Assume not registered if there's an error fetching proofs
    }
  });

  // Fetch details for a specific loan to review/fund
  const { data: loanDetailsDataLender, refetch: fetchLoanDetailsForLender, isLoading: isLoadingLoanDetailsLender } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'loans',
    args: (loanIdToReview || loanIdToFund) ? [BigInt(loanIdToReview || loanIdToFund)] : undefined,
    enabled: !!(loanIdToReview || loanIdToFund) && /^\d+$/.test(loanIdToReview || loanIdToFund),
    onSuccess: (data) => {
        setLoanDetailsForAction(data);
    },
    onError: () => {
        setLoanDetailsForAction(null);
    }
  });


  // --- Contract Writes ---
  const { write: registerLenderWrite, isLoading: isRegisteringLender } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'registerLender',
    onSuccess: (data) => {
      setMessage(`Registration as Lender submitted! Tx: ${data.hash.slice(0,10)}... Awaiting confirmation.`);
      // Event listener will confirm registration
    },
    onError: (error) => setMessage(`Lender Registration Error: ${error.message || error.message}`),
  });

  const { write: setRequiredProofsWrite, isLoading: isSettingProofs } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'setRequiredProofs',
    onSuccess: (data) => {
      setMessage(`Required proofs updated! Tx: ${data.hash.slice(0,10)}... Awaiting confirmation.`);
      // Event or watch on requiredProofsData will update UI
    },
    onError: (error) => setMessage(`Set Required Proofs Error: ${error.message || error.message}`),
  });

  const { write: submitOfferWrite, isLoading: isSubmittingOffer } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'reviewApplicationAndSubmitOffer',
    onSuccess: (data) => {
      setMessage(`Offer for loan ${loanIdToReview} submitted! Tx: ${data.hash.slice(0,10)}...`);
      fetchLoanDetailsForLender(); // Refresh details for the reviewed loan
    },
    onError: (error) => setMessage(`Submit Offer Error: ${error.message || error.message}`),
  });

  const { write: rejectApplicationWrite, isLoading: isRejectingApplication } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'reviewApplicationAndReject',
    onSuccess: (data) => {
      setMessage(`Application for loan ${loanIdToReview} rejected. Tx: ${data.hash.slice(0,10)}...`);
      fetchLoanDetailsForLender(); 
    },
    onError: (error) => setMessage(`Reject Application Error: ${error.message || error.message}`),
  });

  const { write: fundLoanWrite, isLoading: isFundingLoan } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'fundLoan',
    onSuccess: (data) => {
      setMessage(`Loan ${loanIdToFund} funded successfully! Tx: ${data.hash.slice(0,10)}...`);
      fetchLoanDetailsForLender(); 
    },
    onError: (error) => setMessage(`Fund Loan Error: ${error.message || error.message}`),
  });

  const { write: approveTokenWriteL, isLoading: isApprovingTokenL } = useContractWrite({
    address: tokenToApproveL || undefined,
    abi: ERC20_ABI,
    functionName: 'approve',
    onSuccess: (data) => {
      setMessage(`Token approval successful for ${formatEther(parseEther(amountToApproveL))} tokens! Tx: ${data.hash.slice(0,10)}...`);
    },
    onError: (error) => setMessage(`Token Approval Error: ${error.message || error.message}`),
  });

  // --- Event Listeners ---
  useContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'LenderRegistered',
    listener(log) {
      console.log("LenderRegistered event detected:", log);
        const eventData = log[0].args;
        if (eventData.lender === address) {
            setMessage(`Congratulations! You are now confirmed as a registered lender.`);
            setIsLenderActuallyRegistered(true);
            refetchRequiredProofs(); // Fetch initial (likely empty) proofs list
        }
    },
  });
  
  useContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'LenderRequiredProofsSet',
    listener(log) {
      const eventData = log[0].args;
      if (eventData.lender === address) {
        setMessage(`Your required proof IDs have been updated on-chain.`);
        setCurrentRequiredProofs(eventData.requestIds || []);
      }
    },
  });

  useContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'LoanOfferSubmitted',
    listener(log) {
      const eventData = log[0].args;
      if (eventData.lender === address && (loanIdToReview && BigInt(loanIdToReview) === eventData.loanId)) {
        setMessage(`Your offer for Loan ID ${eventData.loanId.toString()} has been confirmed on-chain.`);
        fetchLoanDetailsForLender(); 
      }
    },
  });

  // --- Handlers ---
  const handleRegisterLender = () => {
    registerLenderWrite();
  };

  const handleSetRequiredProofs = () => {
    if (!requiredProofIdsInput) {
      setMessage("Please enter comma-separated proof request IDs (numbers).");
      return;
    }
    const ids = requiredProofIdsInput.split(',').map((id: string) => {
        const num = BigInt(id.trim());
        if (!num) throw new Error("Invalid number in proof IDs.");
        return num;
    }).filter((id: null) => id !== null); // Filter out any potential nulls if parsing failed, though BigInt would throw

    if (ids.some((id: any) => typeof id !== 'bigint')) {
        setMessage("All proof IDs must be valid numbers.");
        return;
    }
    setRequiredProofsWrite({ args: [ids] });
  };

  const handleSubmitOffer = () => {
    if (!loanIdToReview || !/^\d+$/.test(loanIdToReview)) { setMessage("Valid Loan ID is required."); return; }
    if (parseFloat(interestOffer) < 0) { setMessage("Interest offer cannot be negative."); return; } // Can be 0
    submitOfferWrite({ args: [BigInt(loanIdToReview), parseEther(interestOffer)] });
  };

  const handleRejectApplication = () => {
    if (!loanIdToReview || !/^\d+$/.test(loanIdToReview)) { setMessage("Valid Loan ID is required to reject."); return; }
    rejectApplicationWrite({ args: [BigInt(loanIdToReview)] });
  };

  const handleFundLoan = () => {
    if (!loanIdToFund || !/^\d+$/.test(loanIdToFund)) { setMessage("Valid Loan ID is required to fund."); return; }
     if (!loanDetailsForAction || loanDetailsForAction.selectedLender.toLowerCase() !== address?.toLowerCase()) {
        setMessage("You are not the selected lender for this loan, or loan details are not loaded.");
        return;
    }
    if (loanDetailsForAction.funded) {
        setMessage("This loan has already been funded.");
        return;
    }
    setMessage("Ensure you have approved enough tokens for funding. Proceeding with fund transaction...");
    fundLoanWrite({ args: [BigInt(loanIdToFund)] });
  };

  const handleApproveTokenL = () => {
    if (!isAddress(tokenToApproveL)) { setMessage("Invalid Token Address for approval."); return; }
    if (parseFloat(amountToApproveL) <= 0) { setMessage("Amount to approve must be greater than 0."); return; }
    
    approveTokenWriteL({ 
        args: [CONTRACT_ADDRESS, parseEther(amountToApproveL)] 
    });
  };

  const handleFetchLoanDetailsForAction = (type: string) => {
      const id = type === 'review' ? loanIdToReview : loanIdToFund;
      if (!id || !/^\d+$/.test(id)) {
          setMessage(`Please enter a valid Loan ID for ${type}.`);
          setLoanDetailsForAction(null);
          return;
      }
      fetchLoanDetailsForLender(); // This will use either loanIdToReview or loanIdToFund based on which one is set
  }
  
  // --- UI Rendering Functions ---
  const renderLenderRequiredProofsList = () => {
    if (isLoadingProofs) return <p className="text-slate-400">Loading your proof requirements...</p>;
    if (!isLenderActuallyRegistered) return <p className="text-slate-400">Register first to set proof requirements.</p>;
    if (!currentRequiredProofs || currentRequiredProofs.length === 0) {
      return <p className="text-slate-400">You haven't set any required proof IDs yet.</p>;
    }
    return (
      <div className="mt-3 p-3 bg-slate-700 rounded-lg shadow">
        <p className="font-semibold text-purple-300">Your Current Required Proof IDs:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          {currentRequiredProofs.map((id: { toString: () => string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; }, index: Key | null | undefined) => <li key={index} className="font-mono text-sm">{id.toString()}</li>)}
        </ul>
      </div>
    );
  };

  const renderLoanForActionCard = (loan: { borrower: any; token: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; amountRequested: bigint; maxInterest: bigint; dueDate: any; funded: any; selectedLender: any; repaid: any; }, actionType: string) => { // actionType: 'review' or 'fund'
    if (isLoadingLoanDetailsLender && ( (actionType === 'review' && loanIdToReview) || (actionType === 'fund' && loanIdToFund) )) {
        return <p className="text-slate-400 mt-2">Loading loan details...</p>;
    }
    if (!loan || !loan.borrower || loan.borrower === '0x0000000000000000000000000000000000000000') {
        const id = actionType === 'review' ? loanIdToReview : loanIdToFund;
        return <p className="text-slate-400 mt-2">{id ? `No details found for Loan ID ${id}, or an error occurred.` : `Enter a Loan ID and click "View Details for ${actionType}"`}</p>;
    }
    return (
      <div className="mt-4 p-4 bg-slate-700 rounded-lg shadow space-y-2 text-sm">
        <h4 className="text-md font-semibold text-purple-300">Details for Loan ID: {actionType === 'review' ? loanIdToReview : loanIdToFund}</h4>
        <p><strong>Borrower:</strong> <span className="font-mono text-xs">{loan.borrower}</span></p>
        <p><strong>Token:</strong> <span className="font-mono text-xs">{loan.token}</span></p>
        <p><strong>Amount Requested:</strong> {formatEther(loan.amountRequested)} Tokens</p>
        <p><strong>Borrower's Max Interest:</strong> {formatEther(loan.maxInterest)} Tokens</p>
        <p><strong>Due Date:</strong> {new Date(Number(loan.dueDate) * 1000).toLocaleDateString()} {new Date(Number(loan.dueDate) * 1000).toLocaleTimeString()}</p>
        <p><strong>Status:</strong> {loan.funded ? (<span className="text-green-400 font-semibold">Funded</span>) : (<span className="text-yellow-400 font-semibold">Not Funded</span>)}</p>
        {loan.selectedLender !== '0x0000000000000000000000000000000000000000' && (
            <p><strong>Selected Lender:</strong> <span className="font-mono text-xs">{loan.selectedLender} {loan.selectedLender?.toLowerCase() === address?.toLowerCase() ? <span className="text-purple-300">(You)</span> : ""}</span></p>
        )}
        {loan.repaid && <p className="text-green-400 font-semibold">This loan has been repaid.</p>}
      </div>
    );
  };

  const inputClass = "mt-1 block w-full rounded-md bg-slate-700 border-slate-600 shadow-sm focus:border-purple-500 focus:ring focus:ring-purple-500 focus:ring-opacity-50 text-gray-200 py-2 px-3 placeholder-slate-400";
  const buttonClass = (loading: boolean) => `w-full bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed shadow-md ${loading ? 'opacity-70 cursor-wait' : ''}`;
  const labelClass = "block text-sm font-medium text-purple-300";
  const cardClass = "bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700";

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-semibold text-center text-purple-400">Lender Dashboard</h2>
      
      <div className={cardClass}>
        <h3 className="text-xl font-semibold mb-4 text-purple-400">1. Lender Setup</h3>
        {!isLenderActuallyRegistered ? (
            <button onClick={handleRegisterLender} disabled={isRegisteringLender} className={`${buttonClass(isRegisteringLender)} mb-4`}>
            {isRegisteringLender ? 'Registering...' : 'Register as Lender'}
            </button>
        ) : (
            <p className="text-green-400 font-semibold mb-4 p-3 bg-green-700 bg-opacity-30 rounded-md">You are registered as a lender.</p>
        )}
        
        {isLenderActuallyRegistered && (
            <>
            <div>
                <label htmlFor="proofIdsL" className={labelClass}>Set/Update Your Required Proof IDs (comma-separated numbers)</label>
                <input id="proofIdsL" type="text" value={requiredProofIdsInput} onChange={(e) => setRequiredProofIdsInput(e.target.value)} placeholder="e.g., 123, 456, 789" className={inputClass} />
                <button onClick={handleSetRequiredProofs} disabled={isSettingProofs || !requiredProofIdsInput} className={`${buttonClass(isSettingProofs)} mt-3`}>
                {isSettingProofs ? 'Updating Proofs...' : 'Set/Update Required Proofs'}
                </button>
            </div>
            {renderLenderRequiredProofsList()}
            </>
        )}
      </div>

      {isLenderActuallyRegistered && (
        <div className={cardClass}>
          <h3 className="text-xl font-semibold mb-4 text-purple-400">2. Review Loan Application & Make Offer</h3>
          <p className="text-sm text-yellow-300 bg-yellow-700 bg-opacity-40 border border-yellow-600 p-3 rounded-md mb-4">
            <InfoIcon /> <strong>Note:</strong> Borrowers must apply to you for a loan. You can then review applications by Loan ID. Ensure the borrower has met your ZKP requirements (verified via `Verifiable.sol`).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
            <div className="md:col-span-2">
                <label htmlFor="loanIdReviewL" className={labelClass}>Loan ID to Review</label>
                <input id="loanIdReviewL" type="number" value={loanIdToReview} onChange={(e) => setLoanIdToReview(e.target.value)} placeholder="Enter Loan ID" className={inputClass} />
            </div>
             <button onClick={() => handleFetchLoanDetailsForAction('review')} disabled={isLoadingLoanDetailsLender || !loanIdToReview} className={`${buttonClass(isLoadingLoanDetailsLender)}`}>
                {isLoadingLoanDetailsLender && loanIdToReview ? "Loading..." : "View Details for Review"}
            </button>
          </div>
          {loanIdToReview && renderLoanForActionCard(loanDetailsForAction, 'review')}
          
          {loanIdToReview && loanDetailsForAction && !loanDetailsForAction.funded && loanDetailsForAction.selectedLender === '0x0000000000000000000000000000000000000000' && (
            // Only show offer/reject if loan is not funded and no offer is accepted yet
            <div className="mt-6 pt-4 border-t border-slate-700 space-y-4">
              <div>
                <label htmlFor="interestOfferL" className={labelClass}>Your Interest Offer (e.g., 4.5)</label>
                <input id="interestOfferL" type="number" value={interestOffer} onChange={(e) => setInterestOffer(e.target.value)} placeholder="Amount, e.g. 4.5" className={inputClass} />
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button onClick={handleSubmitOffer} disabled={isSubmittingOffer || !interestOffer || parseFloat(interestOffer) < 0 || (loanDetailsForAction && parseEther(interestOffer) > loanDetailsForAction.maxInterest)} className={`${buttonClass(isSubmittingOffer)} flex-1`}>
                  {isSubmittingOffer ? 'Submitting Offer...' : 'Submit Offer'}
                </button>
                <button onClick={handleRejectApplication} disabled={isRejectingApplication} className={`w-full sm:w-auto bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors disabled:bg-slate-500 shadow-md flex-1 ${isRejectingApplication ? 'opacity-70 cursor-wait' : ''}`}>
                  {isRejectingApplication ? 'Rejecting...' : 'Reject Application'}
                </button>
              </div>
              {loanDetailsForAction && interestOffer && parseEther(interestOffer) > loanDetailsForAction.maxInterest && <p className="text-xs text-red-400 mt-1">Your offer exceeds borrower's max interest.</p>}
            </div>
          )}
           {loanIdToReview && loanDetailsForAction && loanDetailsForAction.funded && <p className="text-green-400 mt-2 font-semibold">This loan is already funded.</p>}
           {loanIdToReview && loanDetailsForAction && !loanDetailsForAction.funded && loanDetailsForAction.selectedLender !== '0x0000000000000000000000000000000000000000' && <p className="text-yellow-400 mt-2 font-semibold">An offer has already been accepted for this loan.</p>}
        </div>
      )}

      {isLenderActuallyRegistered && (
        <div className={cardClass}>
          <h3 className="text-xl font-semibold mb-4 text-purple-400">3. Token Approval & Fund Accepted Loan</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 bg-slate-750 rounded-lg border border-slate-600">
                <h4 className="text-lg font-medium text-purple-300">Step 3a: Approve Tokens</h4>
                 <p className="text-xs text-yellow-300"><InfoIcon /> Approve the loan contract to spend your tokens for funding. Token address and amount should match the loan you intend to fund.</p>
                <div>
                    <label htmlFor="tokenApproveL" className={labelClass}>Token Address to Approve</label>
                    <input id="tokenApproveL" type="text" value={tokenToApproveL} onChange={(e) => setTokenToApproveL(e.target.value)} placeholder="Loan's Token Address (0x...)" className={inputClass} />
                </div>
                <div>
                    <label htmlFor="amountApproveL" className={labelClass}>Amount to Approve (Loan Amount)</label>
                    <input id="amountApproveL" type="number" value={amountToApproveL} onChange={(e) => setAmountToApproveL(e.target.value)} placeholder="e.g., 100" className={inputClass} />
                </div>
                <button onClick={handleApproveTokenL} disabled={isApprovingTokenL || !tokenToApproveL || !amountToApproveL} className={`${buttonClass(isApprovingTokenL)}`}>
                    {isApprovingTokenL ? 'Approving...' : 'Approve Tokens'}
                </button>
            </div>
            <div className="space-y-4 p-4 bg-slate-750 rounded-lg border border-slate-600">
                <h4 className="text-lg font-medium text-purple-300">Step 3b: Fund Loan</h4>
                 <p className="text-xs text-yellow-300"><InfoIcon /> Ensure tokens are approved and your offer was accepted by the borrower.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2 items-end">
                    <div>
                        <label htmlFor="loanIdFundL" className={labelClass}>Loan ID to Fund</label>
                        <input id="loanIdFundL" type="number" value={loanIdToFund} onChange={(e) => setLoanIdToFund(e.target.value)} placeholder="Enter Loan ID" className={inputClass} />
                    </div>
                    <button onClick={() => handleFetchLoanDetailsForAction('fund')} disabled={isLoadingLoanDetailsLender || !loanIdToFund} className={`${buttonClass(isLoadingLoanDetailsLender)} h-fit`}>
                        {isLoadingLoanDetailsLender && loanIdToFund ? "Loading..." : "View Details for Funding"}
                    </button>
                </div>
                 {loanIdToFund && renderLoanForActionCard(loanDetailsForAction, 'fund')}
                <button 
                    onClick={handleFundLoan} 
                    disabled={isFundingLoan || !loanIdToFund || !loanDetailsForAction || loanDetailsForAction.selectedLender?.toLowerCase() !== address?.toLowerCase() || loanDetailsForAction.funded} 
                    className={`${buttonClass(isFundingLoan)} mt-3`}>
                    {isFundingLoan ? 'Funding Loan...' : 'Fund This Loan'}
                </button>
                {loanIdToFund && loanDetailsForAction && (loanDetailsForAction.selectedLender?.toLowerCase() !== address?.toLowerCase() && !loanDetailsForAction.funded) && <p className="text-xs text-red-400 mt-1">You are not the selected lender for this loan, or the borrower has not accepted your offer.</p>}
                {loanIdToFund && loanDetailsForAction && loanDetailsForAction.funded && <p className="text-xs text-green-400 mt-1 font-semibold">This loan is already funded.</p>}
            </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default LenderView; // Make sure to export
