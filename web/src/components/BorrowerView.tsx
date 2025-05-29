// BorrowerView.js
'use client'; 

import { useState, useEffect } from 'react';
import { useAccount, useContractWrite, useContractRead, useContractEvent } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI } from '@/config/contract'; // Adjust the import path as needed
import { parseEther, formatEther, isAddress, Address } from 'viem';

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block ml-1 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

// Define a type for the loan details array for better type safety
type LoanDetailsArray = [
  Address, // borrower
  Address, // token
  bigint,  // amountRequested
  bigint,  // maxInterest
  bigint,  // dueDate
  Address, // selectedLender
  bigint,  // interest
  boolean, // funded
  boolean  // repaid
];

type Offer = {
  lender: Address;
  interestOffered: bigint;
};

type BorrowerViewProps = {
  setGlobalMessage: (msg: string) => void;
};

function BorrowerView({ setGlobalMessage }: BorrowerViewProps) {
  const { address } = useAccount();
  const [message, setMessage] = useState<string>(''); 

  // Loan Request State
  const [tokenAddress, setTokenAddress] = useState<string>(''); 
  const [amount, setAmount] = useState<string>('');
  const [maxInterest, setMaxInterest] = useState<string>(''); 
  const [dueDateInput, setDueDateInput] = useState<string>(''); 

  // Loan Interaction State
  const [selectedLoanId, setSelectedLoanId] = useState<string>(''); 
  const [loanIdForOffers, setLoanIdForOffers] = useState<string>(''); 
  const [lenderToApply, setLenderToApply] = useState<string>('');
  const [selectedOfferIndex, setSelectedOfferIndex] = useState<string>('');
  
  const [offersForLoan, setOffersForLoan] = useState<Offer[]>([]);
  const [currentLoanDetails, setCurrentLoanDetails] = useState<LoanDetailsArray | null>(null);


  // ERC20 Approval State
  const [tokenToApprove, setTokenToApprove] = useState<Address | string>(''); // Can be string then parsed to Address
  const [amountToApprove, setAmountToApprove] = useState<string>('');


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
  const { data: loanCount, refetch: refetchLoanCount } = useContractRead({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'loanCount',
    watch: true, 
  });

  const { data: loanDetailsData, refetch: fetchLoanDetails, isLoading: isLoadingLoanDetails } = useContractRead({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'loans',
    args: selectedLoanId && /^\d+$/.test(selectedLoanId) ? [BigInt(selectedLoanId)] : undefined,
    enabled: !!selectedLoanId && /^\d+$/.test(selectedLoanId), 
    onSuccess: (data) => {
        console.log("Fetched loan details (raw array):", data); 
        setCurrentLoanDetails(data as LoanDetailsArray); 
    },
    onError: (error) => {
        setMessage(`Error fetching loan details: ${error.message || error.message}`);
        setCurrentLoanDetails(null);
        console.error("Error fetching loan details:", error);
    }
  });
  
  const { data: offersData, refetch: fetchOffersForLoan, isLoading: isLoadingOffers } = useContractRead({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'getOffers',
    args: loanIdForOffers && /^\d+$/.test(loanIdForOffers) ? [BigInt(loanIdForOffers)] : undefined,
    enabled: !!loanIdForOffers && /^\d+$/.test(loanIdForOffers),
    onSuccess: (data) => {
        setOffersForLoan(data as Offer[]);
    },
    onError: (error) => {
        setMessage(`Error fetching offers: ${error.message || error.message}`);
        setOffersForLoan([]);
    }
  });


  // --- Contract Writes ---
  const { write: requestLoanWrite, isLoading: isRequestingLoan } = useContractWrite({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'requestLoan',
    onSuccess: (data) => {
      setMessage(`Loan request submitted successfully! Tx: ${data.hash.slice(0,10)}... Awaiting confirmation.`);
      refetchLoanCount();
      setTokenAddress(''); setAmount(''); setMaxInterest(''); setDueDateInput('');
    },
    onError: (error) => setMessage(`Request Loan Error: ${error.message || error.message}`),
  });

  const { write: applyForLoanWrite, isLoading: isApplyingForLoan } = useContractWrite({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'applyForLoan',
    onSuccess: (data) => {
      setMessage(`Successfully applied for loan ${selectedLoanId}! Tx: ${data.hash.slice(0,10)}...`);
    },
    onError: (error) => setMessage(`Apply For Loan Error: ${error.message || error.message}`),
  });

  const { write: acceptOfferWrite, isLoading: isAcceptingOffer } = useContractWrite({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'acceptOffer',
    onSuccess: (data) => {
      setMessage(`Offer ${selectedOfferIndex} for loan ${selectedLoanId} accepted! Tx: ${data.hash.slice(0,10)}...`);
      if (selectedLoanId) fetchLoanDetails(); 
    },
    onError: (error) => setMessage(`Accept Offer Error: ${error.message || error.message}`),
  });

  const { write: repayLoanWrite, isLoading: isRepayingLoan } = useContractWrite({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'repayLoan',
    onSuccess: (data) => {
      setMessage(`Loan ${selectedLoanId} repaid successfully! Tx: ${data.hash.slice(0,10)}...`);
      if (selectedLoanId) fetchLoanDetails(); 
    },
    onError: (error) => setMessage(`Repay Loan Error: ${error.message || error.message}`),
  });

  const { write: approveTokenWrite, isLoading: isApprovingToken } = useContractWrite({
    address: tokenToApprove && isAddress(tokenToApprove) ? tokenToApprove : undefined,
    abi: ERC20_ABI,
    functionName: 'approve',
    onSuccess: (data) => {
      setMessage(`Token approval successful for ${formatEther(parseEther(amountToApprove))} tokens! Tx: ${data.hash.slice(0,10)}...`);
    },
    onError: (error) => setMessage(`Token Approval Error: ${error.message || error.message}`),
  });
  
  // --- Event Listeners ---
  useContractEvent({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    eventName: 'LoanRequested',
    listener(logs) {
      const eventData = logs[0].args;
      if (eventData.borrower === address) {
        setMessage(`Your new Loan (ID: ${eventData.loanId?.toString()}) has been confirmed on-chain!`);
      }
      refetchLoanCount(); 
    },
  });

  useContractEvent({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    eventName: 'LoanOfferAccepted',
    listener(logs) {
      const eventData = logs[0].args;
      if (selectedLoanId && eventData.loanId !== undefined && BigInt(selectedLoanId) === eventData.loanId) {
        setMessage(`Offer accepted for your Loan ID ${eventData.loanId.toString()} by lender ${eventData.lender?.slice(0,6)}...`);
        if (selectedLoanId) fetchLoanDetails(); 
      }
    },
  });

   useContractEvent({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    eventName: 'LoanFunded',
    listener(logs) {
      const eventData = logs[0].args;
      // currentLoanDetails is an array, access borrower (index 0)
      if (selectedLoanId && eventData.loanId !== undefined && BigInt(selectedLoanId) === eventData.loanId && currentLoanDetails && currentLoanDetails[0] === address) {
        setMessage(`Your Loan (ID: ${eventData.loanId.toString()}) has been funded by ${eventData.lender?.slice(0,6)}...!`);
        if (selectedLoanId) fetchLoanDetails(); 
      }
    },
  });

  useContractEvent({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    eventName: 'LoanRepaid',
    listener(logs) {
      const eventData = logs[0].args;
       if (selectedLoanId && eventData.loanId !== undefined && BigInt(selectedLoanId) === eventData.loanId && eventData.borrower === address) {
        setMessage(`Your Loan (ID: ${eventData.loanId.toString()}) has been successfully repaid!`);
        if (selectedLoanId) fetchLoanDetails(); 
      }
    },
  });


  // --- Handlers ---
  const handleRequestLoan = () => {
    if (!isAddress(tokenAddress)) { setMessage("Invalid Token Address."); return; }
    if (!amount || parseFloat(amount) <= 0) { setMessage("Amount must be greater than 0."); return; }
    if (!maxInterest || parseFloat(maxInterest) < 0) { setMessage("Max Interest cannot be negative."); return; } 
    if (!dueDateInput || parseInt(dueDateInput) <= 0) { setMessage("Due date must be in the future."); return; }

    const dueDateInSeconds = BigInt(Math.floor(Date.now() / 1000) + (parseInt(dueDateInput) * 24 * 60 * 60));
    requestLoanWrite({ args: [tokenAddress as Address, parseEther(amount), parseEther(maxInterest), dueDateInSeconds] });
  };

  const handleApplyForLoan = () => {
    if (!selectedLoanId || !/^\d+$/.test(selectedLoanId)) { setMessage("Valid Loan ID is required."); return; }
    if (!isAddress(lenderToApply)) { setMessage("Invalid Lender Address."); return; }
    applyForLoanWrite({ args: [BigInt(selectedLoanId), lenderToApply as Address] });
  };

  const handleAcceptOffer = () => {
    if (!selectedLoanId || !/^\d+$/.test(selectedLoanId)) { setMessage("Valid Loan ID is required."); return; }
    if (selectedOfferIndex === '' || parseInt(selectedOfferIndex) < 0) { setMessage("Valid Offer Index is required."); return; }
    acceptOfferWrite({ args: [BigInt(selectedLoanId), BigInt(selectedOfferIndex)] });
  };

  const handleRepayLoan = () => {
    if (!selectedLoanId || !/^\d+$/.test(selectedLoanId)) { setMessage("Valid Loan ID is required to repay."); return; }
    // currentLoanDetails is an array, token address is at index 1
    if (!currentLoanDetails || !currentLoanDetails[1]) {
        setMessage("Loan details not loaded or token address missing. Please view loan details first.");
        return;
    }
    setMessage("Ensure you have approved enough tokens for repayment. Proceeding with repay transaction...");
    repayLoanWrite({ args: [BigInt(selectedLoanId)] });
  };
  
  const handleApproveToken = () => {
    if (!tokenToApprove || !isAddress(tokenToApprove)) { setMessage("Invalid Token Address for approval."); return; }
    if (!amountToApprove || parseFloat(amountToApprove) <= 0) { setMessage("Amount to approve must be greater than 0."); return; }
    
    approveTokenWrite({ 
        args: [CONTRACT_ADDRESS as Address, parseEther(amountToApprove)] 
    });
  };

  const handleFetchOffers = () => {
    if (!loanIdForOffers || !/^\d+$/.test(loanIdForOffers)) {
        setMessage("Please enter a valid Loan ID to view offers.");
        setOffersForLoan([]);
        return;
    }
    fetchOffersForLoan();
  }

  const handleFetchLoanDetails = () => {
      if (!selectedLoanId || !/^\d+$/.test(selectedLoanId)) {
          setMessage("Please enter a valid Loan ID to view details.");
          setCurrentLoanDetails(null);
          return;
      }
      console.log("Fetching loan details for ID:", selectedLoanId);
      fetchLoanDetails();
  }

  // --- UI Rendering Functions ---
  const renderLoanDetailsCard = (loanArray: LoanDetailsArray | null) => {
    if (!loanArray || !loanArray[0] || loanArray[0] === '0x0000000000000000000000000000000000000000') {
        return <p className="text-slate-400 mt-2">Enter a valid Loan ID and click "View Details".</p>;
    }
    // Indices: 0:borrower, 1:token, 2:amountRequested, 3:maxInterest, 4:dueDate, 5:selectedLender, 6:interest, 7:funded, 8:repaid
    const borrower = loanArray[0];
    const token = loanArray[1];
    const amountRequested = loanArray[2];
    const maxInterestSet = loanArray[3];
    const dueDate = loanArray[4];
    const selectedLenderAddr = loanArray[5];
    const agreedInterest = loanArray[6];
    const isFunded = loanArray[7];
    const isRepaid = loanArray[8];

    return (
      <div className="mt-4 p-4 bg-slate-700 rounded-lg shadow space-y-2 text-sm">
        <h4 className="text-md font-semibold text-sky-300">Details for Loan ID: {selectedLoanId}</h4>
        <p><strong>Borrower:</strong> <span className="font-mono text-xs break-all">{borrower} {address && borrower.toLowerCase() === address.toLowerCase() ? "(You)" : ""}</span></p>
        <p><strong>Token:</strong> <span className="font-mono text-xs break-all">{token}</span></p>
        <p><strong>Amount Requested:</strong> {amountRequested ? formatEther(amountRequested) : 'N/A'} Tokens</p>
        <p><strong>Max Interest Set:</strong> {maxInterestSet ? formatEther(maxInterestSet) : 'N/A'} Tokens</p>
        <p><strong>Due Date:</strong> {dueDate ? new Date(Number(dueDate) * 1000).toLocaleDateString() : 'N/A'} {dueDate ? new Date(Number(dueDate) * 1000).toLocaleTimeString() : ''}</p>
        <p><strong>Selected Lender:</strong> <span className="font-mono text-xs break-all">{selectedLenderAddr === '0x0000000000000000000000000000000000000000' ? 'None / Pending Offer Acceptance' : selectedLenderAddr}</span></p>
        <p><strong>Agreed Interest:</strong> {agreedInterest ? formatEther(agreedInterest) : '0'} Tokens</p>
        <p><strong>Status:</strong> {isFunded ? (isRepaid ? <span className="text-green-400 font-semibold">Repaid</span> : <span className="text-sky-400 font-semibold">Funded (Awaiting Repayment)</span>) : <span className="text-yellow-400 font-semibold">Pending Funding / Offer Stage</span>}</p>
      </div>
    );
  };

  const renderOffersList = (offers: Offer[]) => {
    if (isLoadingOffers) return <p className="text-slate-400">Loading offers...</p>;
    if (!offers || offers.length === 0) return <p className="text-slate-400">No offers yet for Loan ID {loanIdForOffers}.</p>;
    return (
      <div className="space-y-3 mt-4">
        <h4 className="text-md font-semibold text-sky-300">Offers for Loan ID: {loanIdForOffers}</h4>
        {offers.map((offer, index) => (
          <div key={index} className="p-3 bg-slate-700 rounded-lg shadow">
            <p><strong>Offer Index: {index}</strong></p>
            <p>Lender: <span className="font-mono text-xs break-all">{offer.lender}</span></p>
            <p>Interest Offered: {offer.interestOffered ? formatEther(offer.interestOffered) : 'N/A'} Tokens</p>
          </div>
        ))}
      </div>
    );
  };

  const inputClass = "mt-1 block w-full rounded-md bg-slate-700 border-slate-600 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-500 focus:ring-opacity-50 text-gray-200 py-2 px-3 placeholder-slate-400";
  const buttonClass = (loading: boolean) => `w-full bg-sky-600 text-white px-4 py-2.5 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed shadow-md ${loading ? 'opacity-70 cursor-wait' : ''}`;
  const labelClass = "block text-sm font-medium text-sky-300";
  const cardClass = "bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700";

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-semibold text-center text-sky-400">Borrower Dashboard</h2>
      <p className="text-center text-slate-400">Total Loans on Platform: {loanCount?.toString() || 'Loading...'}</p>

      {/* Request Loan */}
      <div className={cardClass}>
        <h3 className="text-xl font-semibold mb-4 text-sky-400">1. Request a New Loan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tokenAddressB" className={labelClass}>Token Address (ERC20)</label>
            <input id="tokenAddressB" type="text" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} placeholder="0x..." className={inputClass} />
          </div>
          <div>
            <label htmlFor="amountB" className={labelClass}>Amount to Borrow (e.g., 100)</label>
            <input id="amountB" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" className={inputClass} />
          </div>
          <div>
            <label htmlFor="maxInterestB" className={labelClass}>Max Interest You'll Pay (e.g., 5)</label>
            <input id="maxInterestB" type="number" value={maxInterest} onChange={(e) => setMaxInterest(e.target.value)} placeholder="5" className={inputClass} />
          </div>
          <div>
            <label htmlFor="dueDateB" className={labelClass}>Due Date (days from now, e.g., 30)</label>
            <input id="dueDateB" type="number" value={dueDateInput} onChange={(e) => setDueDateInput(e.target.value)} placeholder="30" className={inputClass} />
          </div>
        </div>
        <button onClick={handleRequestLoan} disabled={isRequestingLoan || !tokenAddress || !amount || !maxInterest || !dueDateInput} className={`${buttonClass(isRequestingLoan)} mt-6`}>
          {isRequestingLoan ? 'Submitting Request...' : 'Request Loan'}
        </button>
      </div>

      {/* Apply for Loan */}
      <div className={cardClass}>
        <h3 className="text-xl font-semibold mb-4 text-sky-400">2. Apply for a Loan</h3>
        <p className="text-sm text-yellow-300 bg-yellow-700 bg-opacity-40 border border-yellow-600 p-3 rounded-md mb-4">
          <InfoIcon /> <strong>Important:</strong> Before applying, ensure you have submitted any required Zero-Knowledge Proofs to the `Verifiable.sol` contract as specified by the lender. This interface does not handle ZKP submission directly.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="loanIdApplyB" className={labelClass}>Loan ID to Apply For</label>
            <input id="loanIdApplyB" type="number" value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)} placeholder="Enter Loan ID" className={inputClass} />
          </div>
          <div>
            <label htmlFor="lenderApplyB" className={labelClass}>Lender's Address</label>
            <input id="lenderApplyB" type="text" value={lenderToApply} onChange={(e) => setLenderToApply(e.target.value)} placeholder="0x..." className={inputClass} />
          </div>
        </div>
        <button onClick={handleApplyForLoan} disabled={isApplyingForLoan || !selectedLoanId || !lenderToApply} className={`${buttonClass(isApplyingForLoan)} mt-6`}>
          {isApplyingForLoan ? 'Submitting Application...' : 'Apply for Loan'}
        </button>
      </div>
      
      {/* View Offers and Accept */}
      <div className={cardClass}>
        <h3 className="text-xl font-semibold mb-4 text-sky-400">3. View & Accept Offers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
            <div className="md:col-span-2">
                <label htmlFor="loanIdOffersB" className={labelClass}>Loan ID to View Offers</label>
                <input id="loanIdOffersB" type="number" value={loanIdForOffers} onChange={(e) => setLoanIdForOffers(e.target.value)} placeholder="Enter Loan ID" className={inputClass} />
            </div>
            <button onClick={handleFetchOffers} disabled={isLoadingOffers || !loanIdForOffers} className={`${buttonClass(isLoadingOffers)}`}>
             {isLoadingOffers ? "Loading..." : "View Offers"}
            </button>
        </div>
        {renderOffersList(offersForLoan)}
        
        {offersForLoan && offersForLoan.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-700">
                <h4 className="text-lg font-medium mb-2 text-sky-300">Accept an Offer for Loan ID: {loanIdForOffers}</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div> 
                        <label htmlFor="loanIdAcceptB" className={labelClass}>Confirm Loan ID for Offer</label>
                        <input id="loanIdAcceptB" type="number" value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)} placeholder="Must match viewed Loan ID" className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="offerIndexB" className={labelClass}>Offer Index (starts from 0)</label>
                        <input id="offerIndexB" type="number" value={selectedOfferIndex} onChange={(e) => setSelectedOfferIndex(e.target.value)} placeholder="e.g., 0" className={inputClass} />
                    </div>
                </div>
                <button onClick={handleAcceptOffer} disabled={isAcceptingOffer || !selectedLoanId || selectedOfferIndex === '' || selectedLoanId !== loanIdForOffers} className={`${buttonClass(isAcceptingOffer)} mt-6`}>
                {isAcceptingOffer ? 'Accepting Offer...' : 'Accept Selected Offer'}
                </button>
                {selectedLoanId !== loanIdForOffers && loanIdForOffers && selectedLoanId && <p className="text-xs text-red-400 mt-1">Loan ID for accepting must match Loan ID for which offers are shown.</p>}
            </div>
        )}
      </div>

      {/* Approve Tokens & Repay Loan */}
      <div className={cardClass}>
        <h3 className="text-xl font-semibold mb-4 text-sky-400">4. Token Approval & Loan Repayment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 bg-slate-750 rounded-lg border border-slate-600">
                <h4 className="text-lg font-medium text-sky-300">Step 4a: Approve Tokens</h4>
                <p className="text-xs text-yellow-300"><InfoIcon /> Approve the loan contract to spend your tokens for repayment. The token address should be the one used in your loan.</p>
                <div>
                    <label htmlFor="tokenApproveB" className={labelClass}>Token Address to Approve</label>
                    <input id="tokenApproveB" type="text" value={tokenToApprove} onChange={(e) => setTokenToApprove(e.target.value)} placeholder="Loan's Token Address (0x...)" className={inputClass} />
                </div>
                <div>
                    <label htmlFor="amountApproveB" className={labelClass}>Amount to Approve (e.g., total due)</label>
                    <input id="amountApproveB" type="number" value={amountToApprove} onChange={(e) => setAmountToApprove(e.target.value)} placeholder="e.g., 105" className={inputClass} />
                </div>
                <button onClick={handleApproveToken} disabled={isApprovingToken || !tokenToApprove || !amountToApprove} className={`${buttonClass(isApprovingToken)}`}>
                    {isApprovingToken ? 'Approving...' : 'Approve Tokens'}
                </button>
            </div>

            <div className="space-y-4 p-4 bg-slate-750 rounded-lg border border-slate-600">
                <h4 className="text-lg font-medium text-sky-300">Step 4b: Repay Loan</h4>
                <p className="text-xs text-yellow-300"><InfoIcon /> Ensure tokens are approved before repaying.</p>
                <div>
                    <label htmlFor="loanIdRepayB" className={labelClass}>Loan ID to Repay</label>
                    <input id="loanIdRepayB" type="number" value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)} placeholder="Enter Loan ID" className={inputClass} />
                </div>
                <button onClick={handleRepayLoan} disabled={isRepayingLoan || !selectedLoanId} className={`${buttonClass(isRepayingLoan)}`}>
                    {isRepayingLoan ? 'Repaying Loan...' : 'Repay Loan'}
                </button>
            </div>
        </div>
      </div>

      {/* View My Loan Details */}
      <div className={cardClass}>
        <h3 className="text-xl font-semibold mb-4 text-sky-400">View My Loan Details</h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
            <div className="md:col-span-2">
                <label htmlFor="loanIdDetailsB" className={labelClass}>Loan ID to View</label>
                <input id="loanIdDetailsB" type="number" value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)} placeholder="Enter Loan ID" className={inputClass} />
            </div>
            <button onClick={handleFetchLoanDetails} disabled={isLoadingLoanDetails || !selectedLoanId} className={`${buttonClass(isLoadingLoanDetails)}`}>
                {isLoadingLoanDetails ? "Loading..." : "View Details"}
            </button>
        </div>
        {isLoadingLoanDetails && <p className="text-slate-400 mt-2">Loading loan details...</p>}
        {currentLoanDetails && renderLoanDetailsCard(currentLoanDetails)}
        {!isLoadingLoanDetails && !currentLoanDetails && selectedLoanId && <p className="text-slate-400 mt-2">No details found for Loan ID {selectedLoanId}, or an error occurred.</p>}
      </div>
    </div>
  );
}

export default BorrowerView;

