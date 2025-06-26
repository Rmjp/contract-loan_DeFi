'use client';
import { useState, useEffect } from 'react';
import { useContractRead, useContractWrite, useAccount, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI, ERC20_ABI } from '@/config/contract';
import { PERSONAL_LOAN_ABI } from '@/config/personalloan_abi';
import { Address } from 'viem';

export default function PersonalLoanView() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [loanId, setLoanId] = useState('');
  const [loanIdList, setLoanIdList] = useState<string[]>([]);
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

  const { data: tokenAddress } = useContractRead({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'token',
    enabled: !!loanAddress,
  });

  const { data: principalAmount } = useContractRead({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'principalAmount',
    enabled: !!loanAddress,
  });

  const { write: fundLoanWrite } = useContractWrite({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'fundLoan',
  });

  const { write: approveWrite } = useContractWrite({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'approve',
  });

  const { write: makePaymentWrite } = useContractWrite({
    address: loanAddress as Address,
    abi: PERSONAL_LOAN_ABI,
    functionName: 'makeInstallmentPayment',
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
              abi: PERSONAL_LOAN_ABI,
              functionName: 'state',
            }) as any[];
            const [b, l] = state;
            if (b.toLowerCase() === address.toLowerCase() || l.toLowerCase() === address.toLowerCase()) {
              loanIdList.push(i.toString());
              setActiveTab(b.toLowerCase() === address.toLowerCase() ? 'borrower' : 'lender');
              return;
            }
          } catch { /* not personal loan */ }
        } catch {}
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
      {installmentAmount !== undefined && (
        <p className="text-sm text-sky-300">Installment: {installmentAmount.toString()}</p>
      )}
      {paymentsMade !== undefined && numberOfPayments !== undefined && (
        <p className="text-sm text-sky-300">Payments: {paymentsMade.toString()} / {numberOfPayments.toString()}</p>
      )}
      <div className="flex space-x-4">
        <button className={`px-4 py-2 rounded ${activeTab === 'borrower' ? 'bg-purple-600 text-white' : 'bg-slate-600 text-slate-200'}`} onClick={() => setActiveTab('borrower')}>Borrower</button>
        <button className={`px-4 py-2 rounded ${activeTab === 'lender' ? 'bg-purple-600 text-white' : 'bg-slate-600 text-slate-200'}`} onClick={() => setActiveTab('lender')}>Lender</button>
      </div>
      {activeTab === 'borrower' ? (
        <button
          onClick={() => makePaymentWrite()}
          className="bg-sky-600 text-white px-4 py-2 rounded"
          disabled={!loanAddress}
        >Make Installment Payment</button>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => approveWrite({ args: [loanAddress as Address, principalAmount ?? 0n] })}
            className="bg-sky-600 text-white px-4 py-2 rounded"
            disabled={!loanAddress || !tokenAddress || principalAmount === undefined}
          >Approve Tokens</button>
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
