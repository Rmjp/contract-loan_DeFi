'use client';
import { useState } from 'react';
import { useContractRead, useContractWrite } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contract';
import { CREDIT_LOAN_ABI } from '@/config/creditloan_abi';
import { parseEther, Address } from 'viem';

export default function CreditLoanView() {
  const [loanId, setLoanId] = useState('');
  const [drawAmt, setDrawAmt] = useState('');
  const [repayAmt, setRepayAmt] = useState('');

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

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-purple-300">Credit Loan Interaction</h3>
      <input
        className="border p-2 rounded w-full bg-slate-700 text-sky-200"
        placeholder="Loan ID"
        value={loanId}
        onChange={e => setLoanId(e.target.value)}
      />
      {loanAddress && (
        <p className="text-sm text-slate-400 break-all">Contract: {loanAddress as string}</p>
      )}
      {outstanding !== undefined && (
        <p className="text-sm text-sky-300">Outstanding: {outstanding.toString()}</p>
      )}
      {available !== undefined && (
        <p className="text-sm text-sky-300">Available Credit: {available.toString()}</p>
      )}
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
    </div>
  );
}
