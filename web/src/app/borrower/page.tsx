// app/borrower/page.js
'use client';

import { useEffect, useContext, use } from 'react';
import BorrowerView from '@/components/BorrowerView'; // Assuming BorrowerView.js is in app/components/
import { useAccount, useNetwork } from 'wagmi';
import { polygonAmoyChain } from '../layout';
import Link from 'next/link';

// You'll need to pass setGlobalMessage to BorrowerView if it's expected from props.
// This requires setGlobalMessage to be available in this page component,
// which usually means lifting state or using React Context if RootLayout can't pass it directly.

// For simplicity, assuming BorrowerView can import a context or handle messages internally,
// or that setGlobalMessage is passed down if needed (e.g. via props from a shared context provider).
// If setGlobalMessage is managed in RootLayout, you might need a Client Context Provider
// to pass it down without prop drilling.

// This is a simplified example of how to get setGlobalMessage if it were in a context.
// import { useGlobalMessage } from '../contexts/GlobalMessageContext'; // Hypothetical context

export default function BorrowerPage() {
  
  const { isConnected }: { isConnected: boolean } = useAccount();
  const { chain } = useNetwork();

  // console log when the page is rendered
  useEffect(() => {
    console.log('BorrowerPage rendered');
  }, []);

  if (!isConnected) {
    return (
      <div className="text-center py-10 bg-slate-800 rounded-lg shadow-xl">
        <p className="text-xl text-gray-300">Please connect your wallet to access the Borrower Dashboard.</p>
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
        <p>Please switch to the Hardhat network (Chain ID: {polygonAmoyChain.id}) to use the Borrower Dashboard.</p>
         <p className="mt-4 text-sm">
          <Link href="/" className="hover:underline text-yellow-200">Return to Homepage</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* If BorrowerView expects setGlobalMessage, you need to provide it. */}
      <BorrowerView />
    </div>
  );
}
