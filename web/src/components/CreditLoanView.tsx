'use client';
import { useState, useEffect } from 'react';
import { useContractRead, useContractWrite, useAccount, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI } from '@/config/contract';
import { CREDIT_LOAN_ABI } from '@/config/creditloan_abi';
import { parseEther, formatEther, Address } from 'viem';

export default function CreditLoanView() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [loanId, setLoanId] = useState('');
  const [loanIdList, setLoanIdList] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'borrower' | 'lender'>('borrower');
  const [drawAmt, setDrawAmt] = useState('');
  const [repayAmt, setRepayAmt] = useState('');

  const { data: loanRequestCount } = useContractRead({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'loanRequestCount',
    watch: false,
  });

  const { data: loanAddress } = useContractRead({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'deployedLoans',
    args: loanId && /^\d+$/.test(loanId) ? [BigInt(loanId)] : undefined,
    enabled: !!loanId && /^\d+$/.test(loanId),
  });

  const { data: outstanding } = useContractRead({
    address: loanAddress as Address,
    abi: CREDIT_LOAN_ABI,
    functionName: 'outstandingBalance',
    enabled: !!loanAddress,
  });

  const { data: available } = useContractRead({
    address: loanAddress as Address,
    abi: CREDIT_LOAN_ABI,
    functionName: 'getAvailableCredit',
    enabled: !!loanAddress,
  });

  const { data: tokenAddress } = useContractRead({
    address: loanAddress as Address,
    abi: CREDIT_LOAN_ABI,
    functionName: 'token',
    enabled: !!loanAddress,
  });

  const { data: principalAmount } = useContractRead({
    address: loanAddress as Address,
    abi: CREDIT_LOAN_ABI,
    functionName: 'principalAmount',
    enabled: !!loanAddress,
  });

  const { data: allowance } = useContractRead({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && loanAddress ? [address, loanAddress as Address] : undefined,
    enabled: !!address && !!tokenAddress && !!loanAddress,
    watch: true,
  });

  const { write: drawWrite } = useContractWrite({
    address: loanAddress as Address,
    abi: CREDIT_LOAN_ABI,
    functionName: 'draw',
  });

  const { write: repayWrite } = useContractWrite({
    address: loanAddress as Address,
    abi: CREDIT_LOAN_ABI,
    functionName: 'repay',
  });

  const { write: fundLoanWrite } = useContractWrite({
    address: loanAddress as Address,
    abi: CREDIT_LOAN_ABI,
    functionName: 'fundLoan',
  });

  const { write: approveWrite } = useContractWrite({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'approve',
  });

  useEffect(() => {
    const loanIdList: string[] = [];
    const findLoan = async () => {
      if (!address || loanRequestCount === undefined || !publicClient) return;
      for (let i = 1; i <= Number(loanRequestCount); i++) {
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
              abi: CREDIT_LOAN_ABI,
              functionName: 'state',
            }) as any[];
            const [b, l] = state;
            console.log(`Loan ID ${i}: Borrower: ${b.toLowerCase()}, Lender: ${l.toLowerCase()}`, address.toLowerCase());
            if (b.toLowerCase() === address.toLowerCase() || l.toLowerCase() === address.toLowerCase()) {
              loanIdList.push(i.toString());
              setActiveTab(b.toLowerCase() === address.toLowerCase() ? 'borrower' : 'lender');
              return;
            }
          } catch { /* ignore non credit loans */ }
        } catch {}
      }
    };
    findLoan();
    setLoanIdList(loanIdList);
  }, [address, loanRequestCount, publicClient]);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-purple-300">Credit Loan Interaction</h3>
      <div className="flex space-x-2">
        <select
          className="border p-2 rounded w-full bg-slate-700 text-sky-200"
          value={loanId}
          onChange={e => setLoanId(e.target.value)}
        >
          <option value="">Select Loan ID</option>
          {loanIdList.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>
      {loanAddress && (
        <p className="text-sm text-slate-400 break-all">Contract: {loanAddress as string}</p>
      )}
      {outstanding !== undefined && (
        <p className="text-sm text-sky-300">Outstanding: {outstanding.toString()}</p>
      )}
      {available !== undefined && (
        <p className="text-sm text-sky-300">Available Credit: {available.toString()}</p>
      )}
      <div className="flex space-x-4">
        <button className={`px-4 py-2 rounded ${activeTab === 'borrower' ? 'bg-purple-600 text-white' : 'bg-slate-600 text-slate-200'}`} onClick={() => setActiveTab('borrower')}>Borrower</button>
        <button className={`px-4 py-2 rounded ${activeTab === 'lender' ? 'bg-purple-600 text-white' : 'bg-slate-600 text-slate-200'}`} onClick={() => setActiveTab('lender')}>Lender</button>
      </div>
      {activeTab === 'borrower' ? (
        <>
          <div className="space-y-2">
            <input
              className="border p-2 rounded w-full bg-slate-700 text-sky-200"
              placeholder="Amount to draw"
              value={drawAmt}
              onChange={e => setDrawAmt(e.target.value)}
            />
            <button
              onClick={() => drawWrite({ args: [parseEther(drawAmt || '0')] })}
              className="bg-purple-600 text-white px-4 py-2 rounded"
              disabled={!loanAddress || !drawAmt}
            >Draw</button>
          </div>
          <div className="space-y-2">
            <input
              className="border p-2 rounded w-full bg-slate-700 text-sky-200"
              placeholder="Amount to repay"
              value={repayAmt}
              onChange={e => setRepayAmt(e.target.value)}
            />
            <button
              onClick={() => repayWrite({ args: [parseEther(repayAmt || '0')] })}
              className="bg-sky-600 text-white px-4 py-2 rounded"
              disabled={!loanAddress || !repayAmt}
            >Repay</button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => approveWrite({ args: [loanAddress as Address, principalAmount ?? 0n] })}
            className="bg-sky-600 text-white px-4 py-2 rounded"
            disabled={!loanAddress || !tokenAddress || principalAmount === undefined}
          >Approve Tokens</button>
          {allowance !== undefined && (
            <p className="text-sm text-slate-300 mt-1">
              Current Allowance: <span className="font-semibold text-purple-300">{formatEther(allowance)} tokens</span>
            </p>
          )}
          <button
            onClick={() => fundLoanWrite()}
            className="bg-purple-600 text-white px-4 py-2 rounded"
            disabled={!loanAddress}
          >Fund Loan</button>
        </div>
      )}
    </div>
  );
}
