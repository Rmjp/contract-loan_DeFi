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
    const fetchLoans = async () => {
      if (!address || loanRequestCount === undefined || !publicClient) {
        setLoanIdList([]);
        return;
      }
      const ids: string[] = [];
      for (let i = 1; i <= Number(loanRequestCount); i++) {
        try {
          const loanData = await publicClient.readContract({
            address: CONTRACT_ADDRESS as Address,
            abi: CONTRACT_ABI,
            functionName: 'loanRequests',
            args: [BigInt(i)],
          }) as any[];
          if (!loanData || loanData[0] === '0x0000000000000000000000000000000000000000') continue;
          if (loanData[4] !== 1n) continue; // only credit loans

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
            if (
              b.toLowerCase() === address.toLowerCase() ||
              l.toLowerCase() === address.toLowerCase()
            ) {
              ids.push(i.toString());
              if (ids.length === 1) {
                setActiveTab(b.toLowerCase() === address.toLowerCase() ? 'borrower' : 'lender');
              }
          } catch {
            /* ignore if not a credit loan contract */
          }
        } catch {
          /* ignore errors */
        }
      }
      setLoanIdList(ids);
    };

    fetchLoans();
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
        <p className="text-sm text-sky-300">
          Outstanding: {formatEther(outstanding)} tokens
        </p>
      )}
      {available !== undefined && (
        <p className="text-sm text-sky-300">
          Available Credit: {formatEther(available)} tokens
        </p>
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
