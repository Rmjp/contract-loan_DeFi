'use client';
import { useState, useEffect } from 'react';
import { useContractRead, useContractWrite, useAccount, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI } from '@/config/contract';
import { PERSONAL_LOAN_ABI } from '@/config/personalloan_abi';
import { Address, formatEther, parseEther } from 'viem';

export default function PersonalLoanView() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [loanId, setLoanId] = useState('');
  const [loanIdList, setLoanIdList] = useState<string[]>([]);
  const [approveAmt, setApproveAmt] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const { data: loanRequestCount } = useContractRead({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'loanRequestCount',
    watch: false,
  });
  const [activeTab, setActiveTab] = useState<'borrower' | 'lender'>('borrower');
  const { data: loanAddress } = useContractRead({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'deployedLoans',
    args: loanId && /^\d+$/.test(loanId) ? [BigInt(loanId)] : undefined,
    enabled: !!loanId && /^\d+$/.test(loanId),
  });

  const selectedLoanAddress = (manualAddress || loanAddress) as Address | undefined;

  const { data: installmentAmount } = useContractRead({
    address: selectedLoanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'installmentAmount',
    enabled: !!selectedLoanAddress,
  });

  const { data: paymentsMade } = useContractRead({
    address: selectedLoanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'paymentsMade',
    enabled: !!selectedLoanAddress,
  });

  const { data: numberOfPayments } = useContractRead({
    address: selectedLoanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'numberOfPayments',
    enabled: !!selectedLoanAddress,
  });

  const { data: tokenAddress } = useContractRead({
    address: selectedLoanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'token',
    enabled: !!selectedLoanAddress,
  });

  const { data: principalAmount } = useContractRead({
    address: selectedLoanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'principalAmount',
    enabled: !!selectedLoanAddress,
  });

  const { data: allowance } = useContractRead({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && selectedLoanAddress ? [address, selectedLoanAddress as Address] : undefined,
    enabled: !!address && !!tokenAddress && !!selectedLoanAddress,
    watch: true,
  });

  const { write: fundLoanWrite } = useContractWrite({
    address: selectedLoanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'fundLoan',
  });

  const { write: approveWrite } = useContractWrite({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'approve',
  });

  const { write: makePaymentWrite } = useContractWrite({
    address: selectedLoanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'makeInstallmentPayment',
  });

  useEffect(() => {
    if (principalAmount !== undefined && approveAmt === '') {
      setApproveAmt(formatEther(principalAmount));
    }
  }, [principalAmount, approveAmt]);

  useEffect(() => {
    let loanIdList: string[] = [];
    const findLoan = async () => {
      if (!address || loanRequestCount === undefined || !publicClient) return;
      for (let i = 1; i <= Number(loanRequestCount); i++) {
        console.log(`Checking loan at index ${i}`);
        try {
          const addr = await publicClient.readContract({
            address: CONTRACT_ADDRESS as Address,
            abi: CONTRACT_ABI,
            functionName: 'deployedLoans',
            args: [BigInt(i)],
          });
          if (!addr || addr === '0x0000000000000000000000000000000000000000') continue;
          try {
            const state = await publicClient.readContract({
              address: addr as Address,
              abi: PERSONAL_LOAN_ABI,
              functionName: 'state',
            }) as any[];
            const [b, l] = state;
            if (b.toLowerCase() === address.toLowerCase() || l.toLowerCase() === address.toLowerCase()) {
              loanIdList.push(i.toString());
              // setActiveTab(b.toLowerCase() === address.toLowerCase() ? 'borrower' : 'lender');
            }
          } catch {
           }
        } catch (error){
          console.error(`Error fetching loan at index ${i}:`, error);
          continue;
        }
      }
    };
    findLoan();
    setLoanIdList(loanIdList);
  }, [address, loanRequestCount, publicClient]);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-purple-300">Personal Loan Interaction</h3>
      {/* select loanIdlist */}
      <div className="flex space-x-2">
        <select
          className="border p-2 rounded w-full bg-slate-700 text-sky-200"
          value={loanId}
          onChange={e => {
            setLoanId(e.target.value);
            setManualAddress('');
          }}
        >
          <option value="">Select Loan ID</option>
          {loanIdList.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <input
          className="border p-2 rounded w-full bg-slate-700 text-sky-200"
          placeholder="Or enter contract address"
          value={manualAddress}
          onChange={e => {
            setManualAddress(e.target.value);
            setLoanId('');
          }}
        />
      </div>
      {selectedLoanAddress && (
        <p className="text-sm text-slate-400 break-all">Contract: {selectedLoanAddress as string}</p>
      )}
      {installmentAmount !== undefined && (
        <p className="text-sm text-sky-300">Installment: {formatEther(installmentAmount)} tokens</p>
      )}
      {installmentAmount !== undefined && (
        <p className="text-sm text-sky-300">Amount Due: {formatEther(installmentAmount)} tokens</p>
      )}
      {principalAmount !== undefined && (
        <p className="text-sm text-sky-300">Remaining Principal: {formatEther(principalAmount)} tokens</p>
      )}
      {paymentsMade !== undefined && numberOfPayments !== undefined && (
        <p className="text-sm text-sky-300">Payments: {paymentsMade.toString()} / {numberOfPayments.toString()}</p>
      )}
      <div className="flex space-x-4">
        <button className={`px-4 py-2 rounded ${activeTab === 'borrower' ? 'bg-purple-600 text-white' : 'bg-slate-600 text-slate-200'}`} onClick={() => setActiveTab('borrower')}>Borrower</button>
        <button className={`px-4 py-2 rounded ${activeTab === 'lender' ? 'bg-purple-600 text-white' : 'bg-slate-600 text-slate-200'}`} onClick={() => setActiveTab('lender')}>Lender</button>
      </div>
      {activeTab === 'borrower' ? (
        <>
          {installmentAmount !== undefined && (
            <p className="text-sm text-sky-300">Next Payment: {formatEther(installmentAmount)} tokens</p>
          )}
          <button
            onClick={() => makePaymentWrite()}
            className="bg-sky-600 text-white px-4 py-2 rounded"
            disabled={!selectedLoanAddress}
          >Make Installment Payment</button>
        </>
      ) : (
        <div className="space-y-2">
          <input
            className="border p-2 rounded w-full bg-slate-700 text-sky-200"
            placeholder="Amount to approve"
            value={approveAmt}
            onChange={e => setApproveAmt(e.target.value)}
          />
          <button
            onClick={() => approveWrite({ args: [selectedLoanAddress as Address, parseEther(approveAmt || '0')] })}
            className="bg-sky-600 text-white px-4 py-2 rounded"
            disabled={!selectedLoanAddress || !tokenAddress || approveAmt === ''}
          >Approve Tokens</button>
          {allowance !== undefined && (
            <p className="text-sm text-slate-300 mt-1">
              Current Allowance: <span className="font-semibold text-purple-300">{formatEther(allowance)} tokens</span>
            </p>
          )}
          <button
            onClick={() => fundLoanWrite()}
            className="bg-purple-600 text-white px-4 py-2 rounded"
            disabled={!selectedLoanAddress}
          >Fund Loan</button>
        </div>
      )}
    </div>
  );
}
