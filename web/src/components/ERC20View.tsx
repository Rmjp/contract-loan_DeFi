'use client';
import { useState } from 'react';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';
import { Address, parseEther, formatEther } from 'viem';
import { ERC20_ABI, TOKEN_ADDRESS_LIST } from '@/config/contract';

export default function ERC20View() {
  const { address } = useAccount();
  const [selectedToken, setSelectedToken] = useState<string>(TOKEN_ADDRESS_LIST.length > 0 ? TOKEN_ADDRESS_LIST[0].address : '');
  const [customToken, setCustomToken] = useState('');
  const [spender, setSpender] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const tokenAddress = selectedToken === 'custom' ? customToken : selectedToken;

  const { data: balance } = useContractRead({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address && tokenAddress ? [address as Address] : undefined,
    enabled: !!address && !!tokenAddress,
    watch: true,
  });

  const { write: approveWrite } = useContractWrite({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'approve',
  });

  const { write: transferWrite } = useContractWrite({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'transfer',
  });

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-purple-300">ERC-20 Token Actions</h3>
      <div className="space-y-2 p-4 border border-slate-700 rounded">
        <h4 className="font-semibold text-sky-300">Select Token</h4>
        <select className="bg-slate-700 p-2 rounded w-full" value={selectedToken} onChange={e => setSelectedToken(e.target.value)}>
          {TOKEN_ADDRESS_LIST.map(t => (
            <option key={t.name} value={t.address}>
              {t.name} ({t.address.slice(0,6)}...)
            </option>
          ))}
          <option value="custom">Custom Address</option>
        </select>
        {selectedToken === 'custom' && (
          <input className="bg-slate-700 p-2 rounded w-full" placeholder="Token address" value={customToken} onChange={e => setCustomToken(e.target.value)} />
        )}
        {balance !== undefined && (
          <p className="text-sm text-sky-300">Balance: {formatEther(balance as bigint)}</p>
        )}
      </div>

      <div className="space-y-2 p-4 border border-slate-700 rounded">
        <h4 className="font-semibold text-sky-300">Approve Spender</h4>
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Spender address" value={spender} onChange={e => setSpender(e.target.value)} />
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Amount" value={approveAmount} onChange={e => setApproveAmount(e.target.value)} />
        <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={() => approveWrite({ args: [spender as Address, parseEther(approveAmount || '0')] })} disabled={!spender}>
          Approve
        </button>
      </div>

      <div className="space-y-2 p-4 border border-slate-700 rounded">
        <h4 className="font-semibold text-sky-300">Transfer Tokens</h4>
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Recipient address" value={transferTo} onChange={e => setTransferTo(e.target.value)} />
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Amount" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
        <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={() => transferWrite({ args: [transferTo as Address, parseEther(transferAmount || '0')] })} disabled={!transferTo}>
          Transfer
        </button>
      </div>
    </div>
  );
}
