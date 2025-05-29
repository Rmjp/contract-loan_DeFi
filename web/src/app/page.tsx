// app/page.js
'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="text-center space-y-6 py-10 bg-slate-800 rounded-lg shadow-xl">
      <h2 className="text-3xl font-semibold text-sky-300">Welcome to the P2P Loan Platform</h2>
      <p className="text-lg text-gray-300">
        Choose your role to get started:
      </p>
      <div className="flex justify-center space-x-6 mt-6">
        {/* These links are also in the header, but can be prominent here too */}
      </div>
      <p className="text-md text-gray-400 mt-8">
        Please connect your wallet and ensure you are on the correct network (Hardhat for local development) to interact with the platform features.
      </p>
       <div className="mt-8 p-6 bg-slate-700 rounded-lg max-w-md mx-auto">
        <h3 className="text-xl font-semibold text-purple-300 mb-3">Platform Overview</h3>
        <ul className="list-disc list-inside text-left text-slate-300 space-y-2">
            <li>Borrowers can request loans by specifying token, amount, max interest, and due date.</li>
            <li>Lenders can register, set proof requirements, and make offers on loan requests.</li>
            <li>Securely fund and repay loans using ERC20 tokens.</li>
            <li>Utilizes Zero-Knowledge Proofs for enhanced privacy where applicable (managed by lenders).</li>
        </ul>
      </div>
    </div>
  );
}
