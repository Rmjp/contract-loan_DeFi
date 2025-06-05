// app/lender/page.js
'use client';

import LenderView from '@/components/LenderView'; // Assuming LenderView.js is in app/components/
import { useAccount, useNetwork } from 'wagmi';
import Link from 'next/link';
import { polygonAmoyChain } from '../layout';

// Similar to BorrowerPage, setGlobalMessage needs to be handled.
// import { useGlobalMessage } from '../contexts/GlobalMessageContext'; // Hypothetical context

export default function LenderPage() {
  // const { setGlobalMessage } = useGlobalMessage(); // Example if using context
  const { isConnected } = useAccount();
  const { chain } = useNetwork();

  if (!isConnected) {
    return (
      <div className="text-center py-10 bg-slate-800 rounded-lg shadow-xl">
        <p className="text-xl text-gray-300">Please connect your wallet to access the Lender Dashboard.</p>
         <p className="mt-4 text-sm text-sky-400">
          <Link href="/" className="hover:underline">Go to Homepage to Connect</Link>
        </p>
      </div>
    );
  }

   if (chain?.id !== polygonAmoyChain.id) {
     return (
      <div className="text-center py-10 bg-yellow-700 text-yellow-100 rounded-lg shadow-xl">
        <p className="text-xl font-semibold">Unsupported Network</p>
        <p>Please switch to the Hardhat network (Chain ID: {polygonAmoyChain.id}) to use the Lender Dashboard.</p>
        <p className="mt-4 text-sm">
          <Link href="/" className="hover:underline text-yellow-200">Return to Homepage</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <LenderView />
    </div>
  );
}
