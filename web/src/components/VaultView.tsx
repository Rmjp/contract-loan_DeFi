'use client';
import { useState } from 'react';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';
import { Address, parseEther, formatEther } from 'viem';
import { VAULT_MANAGER_ADDRESS, ERC20_ABI } from '@/config/contract';
import { VAULT_MANAGER_ABI } from '@/config/vaultmanager_abi';
import { LENDING_VAULT_ABI } from '@/config/lendingvault_abi';

export default function VaultView() {
  const { address } = useAccount();
  const [vaultId, setVaultId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [createAsset, setCreateAsset] = useState('');
  const [createVerifier, setCreateVerifier] = useState('');
  const [createRequestId, setCreateRequestId] = useState('');
  const [loanAddress, setLoanAddress] = useState('');

  const { data: vaultAddress } = useContractRead({
    address: VAULT_MANAGER_ADDRESS as Address,
    abi: VAULT_MANAGER_ABI,
    functionName: 'vaults',
    args: vaultId ? [BigInt(vaultId)] : undefined,
    enabled: !!vaultId,
  });

  const { data: assetAddress } = useContractRead({
    address: vaultAddress as Address,
    abi: LENDING_VAULT_ABI,
    functionName: 'asset',
    enabled: !!vaultAddress,
  });

  const { data: shareBalance } = useContractRead({
    address: vaultAddress as Address,
    abi: LENDING_VAULT_ABI,
    functionName: 'balanceOf',
    args: address && vaultAddress ? [address as Address] : undefined,
    enabled: !!address && !!vaultAddress,
    watch: true,
  });

  const { write: approveWrite } = useContractWrite({
    address: assetAddress as Address,
    abi: ERC20_ABI,
    functionName: 'approve',
  });

  const { write: depositWrite } = useContractWrite({
    address: VAULT_MANAGER_ADDRESS as Address,
    abi: VAULT_MANAGER_ABI,
    functionName: 'deposit',
  });

  const { write: withdrawWrite } = useContractWrite({
    address: VAULT_MANAGER_ADDRESS as Address,
    abi: VAULT_MANAGER_ABI,
    functionName: 'withdraw',
  });

  const { write: createVaultWrite } = useContractWrite({
    address: VAULT_MANAGER_ADDRESS as Address,
    abi: VAULT_MANAGER_ABI,
    functionName: 'createVault',
  });

  const { write: fundLoanWrite } = useContractWrite({
    address: VAULT_MANAGER_ADDRESS as Address,
    abi: VAULT_MANAGER_ABI,
    functionName: 'fundLoan',
  });

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-purple-300">Vault Manager</h3>
      <div className="space-y-2 p-4 border border-slate-700 rounded">
        <h4 className="font-semibold text-sky-300">Create Vault (Admin)</h4>
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Asset address" value={createAsset} onChange={e => setCreateAsset(e.target.value)} />
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Verifier address" value={createVerifier} onChange={e => setCreateVerifier(e.target.value)} />
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Request ID" value={createRequestId} onChange={e => setCreateRequestId(e.target.value)} />
        <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={() => createVaultWrite({ args: [createAsset as Address, createVerifier as Address, BigInt(createRequestId || '0')] })}>
          Create Vault
        </button>
      </div>

      <div className="space-y-2 p-4 border border-slate-700 rounded">
        <h4 className="font-semibold text-sky-300">Deposit / Withdraw</h4>
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Vault ID" value={vaultId} onChange={e => setVaultId(e.target.value)} />
        {vaultAddress && (
          <p className="text-sm text-slate-400 break-all">Vault: {vaultAddress as string}</p>
        )}
        {assetAddress && (
          <p className="text-sm text-slate-400 break-all">Asset: {assetAddress as string}</p>
        )}
        {shareBalance !== undefined && (
          <p className="text-sm text-sky-300">Your Shares: {formatEther(shareBalance)} </p>
        )}
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Amount" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
        <button className="bg-sky-600 text-white px-4 py-2 rounded" onClick={() => approveWrite({ args: [VAULT_MANAGER_ADDRESS as Address, parseEther(depositAmount || '0')] })} disabled={!assetAddress}>
          Approve
        </button>
        <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={() => depositWrite({ args: [BigInt(vaultId || '0'), parseEther(depositAmount || '0')] })} disabled={!vaultId}>
          Deposit
        </button>
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Shares to withdraw" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
        <button className="bg-red-600 text-white px-4 py-2 rounded" onClick={() => withdrawWrite({ args: [BigInt(vaultId || '0'), parseEther(withdrawAmount || '0')] })} disabled={!vaultId}>
          Withdraw
        </button>
      </div>

      <div className="space-y-2 p-4 border border-slate-700 rounded">
        <h4 className="font-semibold text-sky-300">Fund Loan (Admin)</h4>
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Vault ID" value={vaultId} onChange={e => setVaultId(e.target.value)} />
        <input className="bg-slate-700 p-2 rounded w-full" placeholder="Loan address" value={loanAddress} onChange={e => setLoanAddress(e.target.value)} />
        <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={() => fundLoanWrite({ args: [BigInt(vaultId || '0'), loanAddress as Address] })} disabled={!vaultId || !loanAddress}>
          Fund Loan
        </button>
      </div>
    </div>
  );
}
