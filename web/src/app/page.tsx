'use client';

import { useState, useEffect } from 'react';
import { useAccount, useContractWrite, useConnect, useContractRead, useContractEvent, useNetwork } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract';
import { parseEther, formatEther } from 'viem';
import { hardhat } from 'wagmi/chains';

interface Loan {
  borrower: string;
  token: string;
  amountRequested: bigint;
  maxInterest: bigint;
  dueDate: bigint;
  selectedLender: string;
  interest: bigint;
  funded: boolean;
  repaid: boolean;
  offers: Offer[];
}

interface Offer {
  lender: string;
  interestOffered: bigint;
}

interface Lender {
  registered: boolean;
  verifyProofs: string[];
  fundedLoans: bigint[];
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { connect, connectors } = useConnect({
    chainId: hardhat.id,
  });
  const [amount, setAmount] = useState('');
  const [maxInterest, setMaxInterest] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [loanIdNumber, setLoanIdNumber] = useState<bigint>(BigInt(0));
  const [offerInterest, setOfferInterest] = useState('');
  const [selectedOfferIndex, setSelectedOfferIndex] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [viewMode, setViewMode] = useState<'requests' | 'offers' | 'loans'>('requests');
  const [proofContract, setProofContract] = useState('');
  const [lastRequestedLoanId, setLastRequestedLoanId] = useState<string>('');
  const [lenderAddress, setLenderAddress] = useState<string>('');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [approveAmount, setApproveAmount] = useState('');

  // VP input states
  const [vpA1, setVpA1] = useState('');
  const [vpA2, setVpA2] = useState('');
  const [vpB11, setVpB11] = useState('');
  const [vpB12, setVpB12] = useState('');
  const [vpB21, setVpB21] = useState('');
  const [vpB22, setVpB22] = useState('');
  const [vpC1, setVpC1] = useState('');
  const [vpC2, setVpC2] = useState('');
  const [vpInput, setVpInput] = useState('');

  // ERC-20 ABI for transfer and approve
  const ERC20_ABI = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ] as const;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get loan count
  const { data: loanCount, error: loanCountError } = useContractRead({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'loanCount',
  });

  // Get current loan ID
  const currentLoanId = loanCount ? BigInt(loanCount) - BigInt(1) : BigInt(0);

  // Get all loans
  const { data: loansData, error: loansError } = useContractRead({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'loans',
    args: [loanCount ? BigInt(loanCount) - BigInt(1) : BigInt(0)],
    enabled: !!loanCount && loanCount > 0,
  });

  // Get offers for a loan
  const { data: offersData, error: offersError, refetch: refetchOffers } = useContractRead({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getOffers',
    args: [loanIdNumber],
    enabled: !!loanIdNumber && loanIdNumber > BigInt(0),
  });

  // Register as lender
  const { write: registerLender, isLoading: isRegistering } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'registerLender',
    onSuccess: () => {
      setMessage('Successfully registered as lender!');
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  // Add verify proof
  const { write: addVerifyProof, isLoading: isAddingProof } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'addVerifyProof',
    args: [proofContract as `0x${string}`],
    onSuccess: () => {
      setMessage('Successfully added verify proof!');
      setProofContract('');
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  // Remove verify proof
  const { write: removeVerifyProof, isLoading: isRemovingProof } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'removeVerifyProof',
    args: [proofContract as `0x${string}`],
    onSuccess: () => {
      setMessage('Successfully removed verify proof!');
      setProofContract('');
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  // Request loan
  const { write: requestLoan, isLoading: isRequesting } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'requestLoan',
    args: [
      tokenAddress as `0x${string}`,
      parseEther(amount || '0'),
      parseEther(maxInterest || '0'),
      BigInt(Math.floor(Date.now() / 1000) + (parseInt(dueDate || '0') * 24 * 60 * 60)),
    ],
    onSuccess: (data) => {
      // Get the transaction hash
      const txHash = data.hash;
      setLastRequestedLoanId(txHash);
      setMessage(`Transaction submitted! Hash: ${txHash.slice(0, 8)}...${txHash.slice(-6)}`);
      setAmount('');
      setMaxInterest('');
      setDueDate('');
      setTokenAddress('');
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  // Format loan ID for display
  const formatLoanId = (id: any) => {
    if (!id) return '';
    return id;
  };

  // Get loan details
  const { data: loanDetails, error: loanDetailsError } = useContractRead({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'loans',
    args: [loanIdNumber],
    enabled: !!loanIdNumber && loanIdNumber > BigInt(0),
  });

  // Get lender details
  const { data: lenderDetails, error: lenderError } = useContractRead({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getVerifyProofs',
    args: [lenderAddress as `0x${string}`],
    enabled: !!lenderAddress && lenderAddress.startsWith('0x'),
  });

  // Get verify proof list for lender
  const { data: verifyProofs, error: verifyProofsError } = useContractRead({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getVerifyProofs',
    args: [lenderAddress as `0x${string}`],
    enabled: !!lenderAddress && lenderAddress.startsWith('0x'),
  });

  // Get borrower address for the loan
  const { data: borrowerAddress, error: borrowerError } = useContractRead({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'loans',
    args: [loanIdNumber],
    enabled: !!loanIdNumber && loanIdNumber > BigInt(0),
  });

  // Check if loan is funded
  const { data: loanFunded, error: loanFundedError } = useContractRead({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'loans',
    args: [loanIdNumber],
    enabled: !!loanIdNumber && loanIdNumber > BigInt(0),
  });

  // Apply for loan
  const { write: applyForLoan, isLoading: isApplying } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'applyForLoan',
    args: [
      loanIdNumber,
      lenderAddress as `0x${string}`,
      [] // Empty array when there are no verify proofs
    ],
    onSuccess: () => {
      setMessage('Loan application submitted successfully!');
      // Clear VP inputs
      setVpA1('');
      setVpA2('');
      setVpB11('');
      setVpB12('');
      setVpB21('');
      setVpB22('');
      setVpC1('');
      setVpC2('');
      setVpInput('');
      setLenderAddress('');
    },
    onError: (error) => {
      console.error('Error details:', error);
      let errorMessage = `Error: ${error.message}`;
      
      // Check if borrower address matches
      if (borrowerAddress && address) {
        const isBorrower = borrowerAddress[0]?.toLowerCase() === address.toLowerCase();
        if (!isBorrower) {
          errorMessage += '\nYou are not the borrower of this loan.';
        }
      }
      
      // Check if lender is registered
      if (lenderDetails) {
        if (lenderDetails.length === 0) {
          errorMessage += '\nLender is not registered or has no proof contracts.';
        } else {
          errorMessage += `\nLender has ${lenderDetails.length} proof contracts.`;
        }
      }
      
      // Check if loan is funded
      if (loanFunded) {
        if (loanFunded[7]) { // funded field
          errorMessage += '\nLoan is already funded.';
        }
      }
      
      setMessage(errorMessage);
    }
  });

  // Review application
  const { write: reviewApplication, isLoading: isReviewing } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'reviewApplication',
    args: [
      loanIdNumber,
      true, // accept
      parseEther(offerInterest || '0'),
    ],
    onSuccess: () => {
      setMessage('Application reviewed successfully!');
      setOfferInterest('');
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  // Accept offer
  const { write: acceptOffer, isLoading: isAccepting } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'acceptOffer',
    args: [
      loanIdNumber,
      BigInt(selectedOfferIndex || '0'),
    ],
    onSuccess: () => {
      setMessage('Offer accepted successfully!');
      setSelectedOfferIndex('');
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  // Fund loan
  const { write: fundLoan, isLoading: isFunding } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'fundLoan',
    args: [loanIdNumber],
    onSuccess: () => {
      setMessage('Loan funded successfully!');
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  // Repay loan
  const { write: repayLoan, isLoading: isRepaying } = useContractWrite({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'repayLoan',
    args: [loanIdNumber],
    onSuccess: () => {
      setMessage('Loan repaid successfully!');
    },
    onError: (error) => {
      setMessage(`Error: ${error.message}`);
    }
  });

  // Transfer ERC-20 tokens
  const { write: transferTokens, isLoading: isTransferring } = useContractWrite({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [
      spenderAddress as `0x${string}`,
      parseEther(amount || '0')
    ],
    onSuccess: () => {
      setMessage('Tokens transferred successfully!');
      setAmount('');
      setSpenderAddress('');
    },
    onError: (error) => {
      setMessage(`Error transferring tokens: ${error.message}`);
    }
  });

  // Approve ERC-20 tokens
  const { write: approveTokens, isLoading: isApproving } = useContractWrite({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [
      spenderAddress as `0x${string}`,
      parseEther(approveAmount || '0')
    ],
    onSuccess: () => {
      setMessage('Tokens approved successfully!');
      setApproveAmount('');
      setSpenderAddress('');
    },
    onError: (error) => {
      setMessage(`Error approving tokens: ${error.message}`);
    }
  });

  // Listen for events
  useContractEvent({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    eventName: 'LoanRequested' as any,
    listener: () => {
      refetchOffers();
    }
  });

  useContractEvent({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    eventName: 'LoanOfferSubmitted' as any,
    listener: () => {
      refetchOffers();
    }
  });

  useEffect(() => {
    if (offersData) {
      setOffers(offersData as Offer[]);
    }
  }, [offersData]);

  useEffect(() => {
    if (loansData) {
      setLoans([loansData as any]);
    }
  }, [loansData]);

  useEffect(() => {
    if (lastRequestedLoanId) {
      console.log(lastRequestedLoanId);
    }
  }, [lastRequestedLoanId]);

  const handleLoanIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow both numeric input and transaction hash
    if (value.startsWith('0x')) {
      setSelectedLoanId(value);
      // For transaction hash, use the last 8 characters as a number
      const numericId = BigInt('0x' + value.slice(-8));
      setLoanIdNumber(numericId);
    } else if (!isNaN(Number(value))) {
      setSelectedLoanId(value);
      setLoanIdNumber(BigInt(value));
    } else {
      setSelectedLoanId('');
      setLoanIdNumber(BigInt(0));
    }
    refetchOffers();
  };

  if (!mounted) {
    return null;
  }

  const renderLoanDetails = (loan: any) => {
    if (!loan) return null;
    
    // Ensure all values are defined before formatting
    const amountRequested = loan.amountRequested ? formatEther(loan.amountRequested) : '0';
    const interest = loan.interest ? formatEther(loan.interest) : '0';
    const dueDate = loan.dueDate ? new Date(Number(loan.dueDate) * 1000).toLocaleDateString() : 'Not set';
    
    return (
      <div className="border p-4 rounded-lg space-y-2">
        <p className="font-medium">Loan Details</p>
        <p>Borrower: {loan.borrower || 'Not set'}</p>
        <p>Lender: {loan.selectedLender || 'Not set'}</p>
        <p>Token: {loan.token || 'Not set'}</p>
        <p>Amount: {amountRequested}</p>
        <p>Interest: {interest}</p>
        <p>Due Date: {dueDate}</p>
        <p>Status: {loan.funded ? (loan.repaid ? 'Repaid' : 'Funded') : 'Pending'}</p>
      </div>
    );
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Loan Platform</h1>
        
        {message && (
          <div className="mb-4 p-4 rounded-md bg-blue-100 text-blue-800">
            {message}
          </div>
        )}

        {!isConnected ? (
          <div className="text-center space-y-4">
            <p className="text-xl">Please connect your wallet to continue</p>
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : chain?.id !== hardhat.id ? (
          <div className="text-center space-y-4">
            <p className="text-xl">Please switch to Hardhat network</p>
            <p className="text-lg">Current network: {chain?.name || 'Unknown'}</p>
            <p className="text-sm text-gray-600">Required network: Hardhat (Chain ID: 31337)</p>
            <div className="mt-4 p-4 bg-yellow-100 rounded-lg text-left">
              <p className="font-semibold">To add Hardhat network to MetaMask:</p>
              <ol className="list-decimal list-inside mt-2 space-y-2">
                <li>Click the network dropdown in MetaMask</li>
                <li>Click "Add Network"</li>
                <li>Enter these details:
                  <ul className="list-disc list-inside ml-4 mt-2">
                    <li>Network Name: Hardhat</li>
                    <li>RPC URL: http://127.0.0.1:8545</li>
                    <li>Chain ID: 31337</li>
                    <li>Currency Symbol: ETH</li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Display errors */}
            {(loanCountError || loansError || offersError) && (
              <div className="mb-4 p-4 rounded-md bg-red-100 text-red-800">
                {loanCountError?.message || loansError?.message || offersError?.message}
              </div>
            )}

            {/* Display loan count */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Loan Statistics</h2>
              <div className="space-y-2">
                <p>Total Loans: {loanCount?.toString() || '0'}</p>
                {currentLoanId > BigInt(0) && (
                  <p className="text-sm text-gray-600">
                    Current Loan ID: <span className="font-mono">{currentLoanId.toString()}</span>
                  </p>
                )}
                {lastRequestedLoanId && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      Transaction Hash: <span className="font-mono">{lastRequestedLoanId.slice(0, 8)}...{lastRequestedLoanId.slice(-6)}</span>
                    </p>
                    <p className="text-xs text-yellow-600">Waiting for confirmation...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Display loans */}
            {loans.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold mb-4">Latest Loan</h2>
                {renderLoanDetails(loans[0])}
              </div>
            )}

            {/* Display offers */}
            {offers.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold mb-4">Loan Offers</h2>
                <div className="space-y-4">
                  {offers.map((offer, index) => (
                    <div key={index} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-600">Lender:</p>
                          <p className="font-mono">{offer.lender.slice(0, 6)}...{offer.lender.slice(-4)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Interest Offered:</p>
                          <p className="font-mono">{formatEther(offer.interestOffered)} ETH</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lender Registration */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Lender Registration</h2>
              <div className="space-y-4">
                <button
                  onClick={() => registerLender?.()}
                  disabled={isRegistering}
                  className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                >
                  {isRegistering ? 'Registering...' : 'Register as Lender'}
                </button>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Proof Contract Address</label>
                  <input
                    type="text"
                    value={proofContract}
                    onChange={(e) => setProofContract(e.target.value)}
                    placeholder="0x..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => addVerifyProof?.()}
                  disabled={isAddingProof}
                  className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                >
                  {isAddingProof ? 'Adding...' : 'Add Verify Proof'}
                </button>
                {verifyProofs && verifyProofs.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded">
                    <p className="text-sm text-blue-700 font-medium">Verify Proof Contracts:</p>
                    <ul className="mt-1 space-y-1">
                      {verifyProofs.map((proof, index) => (
                        <li key={index} className="flex items-center justify-between">
                          <span className="font-mono text-sm">{proof.slice(0, 6)}...{proof.slice(-4)}</span>
                          <button
                            onClick={() => {
                              setProofContract(proof);
                              removeVerifyProof?.();
                            }}
                            disabled={isRemovingProof}
                            className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Request Loan */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Request Loan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Token Address</label>
                  <input
                    type="text"
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    placeholder="0x..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Interest</label>
                  <input
                    type="number"
                    value={maxInterest}
                    onChange={(e) => setMaxInterest(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Due Date (days)</label>
                  <input
                    type="number"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => requestLoan?.()}
                  disabled={isRequesting}
                  className="w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-400"
                >
                  {isRequesting ? 'Requesting...' : 'Request Loan'}
                </button>
                {lastRequestedLoanId && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Last requested loan ID: <span className="font-mono">{formatLoanId(lastRequestedLoanId)}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Apply for Loan */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Apply for Loan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Loan ID</label>
                  <input
                    type="text"
                    value={selectedLoanId}
                    onChange={handleLoanIdChange}
                    placeholder="Enter loan ID or transaction hash"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Enter either the loan ID number or the transaction hash from the loan request
                  </p>
                  {loanDetailsError && (
                    <p className="mt-1 text-sm text-red-600">
                      Error loading loan details: {loanDetailsError.message}
                    </p>
                  )}
                  {loanDetails && (
                    <div className="mt-2 p-2 bg-green-50 rounded">
                      <p className="text-sm text-green-700">
                        Loan found! Amount: {formatEther(loanDetails[2])} tokens
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lender Address</label>
                  <input
                    type="text"
                    value={lenderAddress}
                    onChange={(e) => setLenderAddress(e.target.value)}
                    placeholder="0x..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  {lenderError && (
                    <p className="mt-1 text-sm text-red-600">
                      Error loading lender details: {lenderError.message}
                    </p>
                  )}
                  {lenderDetails && (
                    <div className="mt-2 p-2 bg-green-50 rounded">
                      <p className="text-sm text-green-700">
                        Lender found! Number of proof contracts: {lenderDetails.length}
                      </p>
                    </div>
                  )}
                  {verifyProofs && verifyProofs.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 rounded">
                      <p className="text-sm text-blue-700 font-medium">Verify Proof Contracts:</p>
                      <ul className="mt-1 space-y-1">
                        {verifyProofs.map((proof, index) => (
                          <li key={index} className="flex items-center justify-between">
                            <span className="font-mono text-sm">{proof.slice(0, 6)}...{proof.slice(-4)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {borrowerAddress && address && (
                    <div className="mt-2 p-2 bg-blue-50 rounded">
                      <p className="text-sm text-blue-700">
                        Borrower: {borrowerAddress[0]?.slice(0, 6)}...{borrowerAddress[0]?.slice(-4)}
                        {borrowerAddress[0]?.toLowerCase() === address.toLowerCase() ? 
                          ' (You)' : ' (Not you)'}
                      </p>
                    </div>
                  )}
                  {loanFunded && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded">
                      <p className="text-sm text-yellow-700">
                        Loan Status: {loanFunded[7] ? 'Funded' : 'Not Funded'}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Verifiable Proof (VP)</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">a[0]</label>
                      <input
                        type="text"
                        value={vpA1}
                        onChange={(e) => setVpA1(e.target.value)}
                        placeholder="Enter a[0]"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">a[1]</label>
                      <input
                        type="text"
                        value={vpA2}
                        onChange={(e) => setVpA2(e.target.value)}
                        placeholder="Enter a[1]"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">b[0][0]</label>
                    <input
                      type="text"
                      value={vpB11}
                      onChange={(e) => setVpB11(e.target.value)}
                      placeholder="Enter b[0][0]"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <label className="block text-sm font-medium text-gray-700">b[0][1]</label>
                    <input
                      type="text"
                      value={vpB12}
                      onChange={(e) => setVpB12(e.target.value)}
                      placeholder="Enter b[0][1]"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <label className="block text-sm font-medium text-gray-700">b[1][0]</label>
                    <input
                      type="text"
                      value={vpB21}
                      onChange={(e) => setVpB21(e.target.value)}
                      placeholder="Enter b[1][0]"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <label className="block text-sm font-medium text-gray-700">b[1][1]</label>
                    <input
                      type="text"
                      value={vpB22}
                      onChange={(e) => setVpB22(e.target.value)}
                      placeholder="Enter b[1][1]"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">c[0]</label>
                      <input
                        type="text"
                        value={vpC1}
                        onChange={(e) => setVpC1(e.target.value)}
                        placeholder="Enter c[0]"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">c[1]</label>
                      <input
                        type="text"
                        value={vpC2}
                        onChange={(e) => setVpC2(e.target.value)}
                        placeholder="Enter c[1]"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Input (comma-separated)</label>
                    <input
                      type="text"
                      value={vpInput}
                      onChange={(e) => setVpInput(e.target.value)}
                      placeholder="Enter comma-separated input values"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={() => applyForLoan?.()}
                  disabled={isApplying}
                  className="w-full bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors disabled:bg-gray-400"
                >
                  {isApplying ? 'Applying...' : 'Apply for Loan'}
                </button>
              </div>
            </div>

            {/* Review Application */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Review Application</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Loan ID</label>
                  <input
                    type="text"
                    value={selectedLoanId}
                    onChange={handleLoanIdChange}
                    placeholder="Enter loan ID"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Interest Offer</label>
                  <input
                    type="number"
                    value={offerInterest}
                    onChange={(e) => setOfferInterest(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => reviewApplication?.()}
                  disabled={isReviewing}
                  className="w-full bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors disabled:bg-gray-400"
                >
                  {isReviewing ? 'Reviewing...' : 'Review Application'}
                </button>
              </div>
            </div>

            {/* Accept Offer */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Accept Offer</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Loan ID</label>
                  <input
                    type="text"
                    value={selectedLoanId}
                    onChange={handleLoanIdChange}
                    placeholder="Enter loan ID"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Offer Index</label>
                  <input
                    type="number"
                    value={selectedOfferIndex}
                    onChange={(e) => setSelectedOfferIndex(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => acceptOffer?.()}
                  disabled={isAccepting}
                  className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400"
                >
                  {isAccepting ? 'Accepting...' : 'Accept Offer'}
                </button>
              </div>
            </div>

            {/* Fund Loan */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Fund Loan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Loan ID</label>
                  <input
                    type="text"
                    value={selectedLoanId}
                    onChange={handleLoanIdChange}
                    placeholder="Enter loan ID"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => fundLoan?.()}
                  disabled={isFunding}
                  className="w-full bg-indigo-500 text-white px-6 py-3 rounded-lg hover:bg-indigo-600 transition-colors disabled:bg-gray-400"
                >
                  {isFunding ? 'Funding...' : 'Fund Loan'}
                </button>
              </div>
            </div>

            {/* Repay Loan */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Repay Loan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Loan ID</label>
                  <input
                    type="text"
                    value={selectedLoanId}
                    onChange={handleLoanIdChange}
                    placeholder="Enter loan ID"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => repayLoan?.()}
                  disabled={isRepaying}
                  className="w-full bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-400"
                >
                  {isRepaying ? 'Repaying...' : 'Repay Loan'}
                </button>
              </div>
            </div>

            {/* ERC-20 Token Operations */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">ERC-20 Token Operations</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Token Address</label>
                  <input
                    type="text"
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    placeholder="0x..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Recipient/Spender Address</label>
                  <input
                    type="text"
                    value={spenderAddress}
                    onChange={(e) => setSpenderAddress(e.target.value)}
                    placeholder="0x..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Transfer Amount (ETH)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => transferTokens?.()}
                      disabled={isTransferring || !tokenAddress || !spenderAddress || !amount}
                      className="mt-2 w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400"
                    >
                      {isTransferring ? 'Transferring...' : 'Transfer Tokens'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Approve Amount (ETH)</label>
                    <input
                      type="number"
                      value={approveAmount}
                      onChange={(e) => setApproveAmount(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => approveTokens?.()}
                      disabled={isApproving || !tokenAddress || !spenderAddress || !approveAmount}
                      className="mt-2 w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                    >
                      {isApproving ? 'Approving...' : 'Approve Tokens'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
