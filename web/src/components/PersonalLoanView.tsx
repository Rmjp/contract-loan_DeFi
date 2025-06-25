'use client';
import { useState } from 'react';
import { useContractRead, useContractWrite, useAccount } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contract';
import { PERSONAL_LOAN_ABI } from '@/config/personalloan_abi';
import { Address } from 'viem';

export default function PersonalLoanView() {
  const { address } = useAccount();
  const [loanId, setLoanId] = useState('');
  const { data: loanAddress } = useContractRead({
    address: CONTRACT_ADDRESS as Address,
    abi: CONTRACT_ABI,
    functionName: 'deployedLoans',
    args: loanId && /^\d+$/.test(loanId) ? [BigInt(loanId)] : undefined,
    enabled: !!loanId && /^\d+$/.test(loanId),
  });

  const { data: installmentAmount } = useContractRead({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'installmentAmount',
    enabled: !!loanAddress,
  });

  const { data: paymentsMade } = useContractRead({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'paymentsMade',
    enabled: !!loanAddress,
  });

  const { data: numberOfPayments } = useContractRead({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'numberOfPayments',
    enabled: !!loanAddress,
  });

  const { write: fundLoanWrite } = useContractWrite({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'fundLoan',
  });

  const { write: makePaymentWrite } = useContractWrite({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'makeInstallmentPayment',
  });

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-purple-300">Personal Loan Interaction</h3>
      <input
        className="border p-2 rounded w-full bg-slate-700 text-sky-200"
        placeholder="Loan ID"
        value={loanId}
        onChange={e => setLoanId(e.target.value)}
      />
      {loanAddress && (
        <p className="text-sm text-slate-400 break-all">Contract: {loanAddress as string}</p>
      )}
      {installmentAmount !== undefined && (
        <p className="text-sm text-sky-300">Installment: {installmentAmount.toString()}</p>
      )}
      {paymentsMade !== undefined && numberOfPayments !== undefined && (
        <p className="text-sm text-sky-300">Payments: {paymentsMade.toString()} / {numberOfPayments.toString()}</p>
      )}
      <button
        onClick={() => fundLoanWrite()}
        className="bg-purple-600 text-white px-4 py-2 rounded"
        disabled={!loanAddress}
      >Fund Loan</button>
      <button
        onClick={() => makePaymentWrite()}
        className="bg-sky-600 text-white px-4 py-2 rounded ml-2"
        disabled={!loanAddress}
      >Make Installment Payment</button>
    </div>
  );
}
