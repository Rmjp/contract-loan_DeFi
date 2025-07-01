'use client';
import { useState } from 'react';
import { useWalletClient, useAccount, usePublicClient } from 'wagmi';
import { parseEther, Address } from 'viem';
import { TOKEN_ADDRESS_LIST, CONTRACT_ADDRESS } from '@/config/contract';
import { CREDIT_LOAN_ABI } from '@/config/creditloan_abi';
import { PERSONAL_LOAN_ABI } from '@/config/personalloan_abi';
import { CREDIT_LOAN_BYTECODE, PERSONAL_LOAN_BYTECODE } from '@/config/loan_bytecode';

export default function ManualDeployView() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [loanType, setLoanType] = useState<'Personal' | 'Credit'>('Personal');
  const [borrower, setBorrower] = useState('');
  const [lender, setLender] = useState('');
  const [token, setToken] = useState<string>(TOKEN_ADDRESS_LIST.length > 0 ? TOKEN_ADDRESS_LIST[0].address : '');
  const [customToken, setCustomToken] = useState<string>('');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [dueDateInput, setDueDateInput] = useState<string>('');
  const [payments, setPayments] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [deployHash, setDeployHash] = useState('');

  const selectedToken = token === 'custom' ? customToken : token;

  const handleDeploy = async () => {
    if (!walletClient || !selectedToken || !address) return;
    const abi = loanType === 'Personal' ? PERSONAL_LOAN_ABI : CREDIT_LOAN_ABI;
    const bytecode = loanType === 'Personal' ? PERSONAL_LOAN_BYTECODE : CREDIT_LOAN_BYTECODE;

    const interestBps = interest ? BigInt(Math.round(parseFloat(interest) * 100)) : 0n;
    let dueDateSeconds = 0n;
    if (loanType === 'Credit' && dueDateInput) {
      const [y, m, d] = dueDateInput.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      dueDateSeconds = BigInt(Math.floor(dateObj.getTime() / 1000));
    }
    const intervalSeconds = loanType === 'Personal' && intervalDays
      ? BigInt(parseInt(intervalDays) * 86400)
      : 0n;

    try {
      const deployHash = await walletClient.deployContract({ abi: [], bytecode });
      setDeployHash(deployHash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
      if (!receipt.contractAddress) return;
      await walletClient.writeContract({
        address: receipt.contractAddress as Address,
        abi,
        functionName: 'initialize',
        args: [
          (borrower || address) as Address,
          lender as Address,
          selectedToken as Address,
          parseEther(principal || '0'),
          interestBps,
          loanType === 'Credit' ? dueDateSeconds : 0n,
          loanType === 'Personal' ? BigInt(payments || '0') : 0n,
          loanType === 'Personal' ? intervalSeconds : 0n,
          CONTRACT_ADDRESS as Address,
        ],
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 p-4 max-w-xl mx-auto">
      <h3 className="text-xl font-semibold text-purple-300">Manual Loan Deployment</h3>
      <div>
        <label className="block text-sm mb-1">Loan Type</label>
        <select className="w-full p-2 bg-slate-700 rounded" value={loanType} onChange={e => setLoanType(e.target.value as any)}>
          <option value="Personal">Personal Loan</option>
          <option value="Credit">Credit Loan</option>
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Borrower</label>
        <input className="w-full p-2 bg-slate-700 rounded" placeholder="0x..." value={borrower} onChange={e => setBorrower(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm mb-1">Lender</label>
        <input className="w-full p-2 bg-slate-700 rounded" placeholder="0x..." value={lender} onChange={e => setLender(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm mb-1">Token Address (ERC20)</label>
        <select className="w-full p-2 bg-slate-700 rounded" value={token} onChange={e => setToken(e.target.value)}>
          {TOKEN_ADDRESS_LIST.map(t => (
            <option key={t.name} value={t.address}>
              {t.name} ({t.address.slice(0,6)}...)
            </option>
          ))}
          <option value="custom">Custom Address</option>
        </select>
        {token === 'custom' && (
          <input className="w-full mt-2 p-2 bg-slate-700 rounded" placeholder="Enter custom token address (0x...)" value={customToken} onChange={e => setCustomToken(e.target.value)} />
        )}
      </div>
      <div>
        <label className="block text-sm mb-1">Principal Amount</label>
        <input className="w-full p-2 bg-slate-700 rounded" placeholder="e.g., 100" value={principal} onChange={e => setPrincipal(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm mb-1">Interest (%)</label>
        <input className="w-full p-2 bg-slate-700 rounded" placeholder="e.g., 5.25 for 5.25%" value={interest} onChange={e => setInterest(e.target.value)} />
      </div>
      {loanType === 'Credit' && (
        <div>
          <label className="block text-sm mb-1">Preferred Due Date</label>
          <input type="date" className="w-full p-2 bg-slate-700 rounded" value={dueDateInput} onChange={e => setDueDateInput(e.target.value)} />
        </div>
      )}
      {loanType === 'Personal' && (
        <>
          <div>
            <label className="block text-sm mb-1">Number of Payments</label>
            <input className="w-full p-2 bg-slate-700 rounded" placeholder="e.g. 12" value={payments} onChange={e => setPayments(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Payment Interval (days)</label>
            <input className="w-full p-2 bg-slate-700 rounded" placeholder="e.g. 30" value={intervalDays} onChange={e => setIntervalDays(e.target.value)} />
          </div>
        </>
      )}
      <button className="w-full bg-purple-600 text-white p-2 rounded" onClick={handleDeploy}>Deploy Loan</button>
      {deployHash && <p className="break-all text-sm mt-2">Tx Hash: {deployHash}</p>}
    </div>
  );
}
