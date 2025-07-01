// app/layout.js
'use client';

import { useState, useEffect, createContext, useMemo } from 'react';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
// We will define polygonAmoy manually
import { publicProvider } from 'wagmi/providers/public';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import Link from 'next/link';
import { useAccount, useConnect, useNetwork, useDisconnect } from 'wagmi';
import { defineChain } from 'viem'; // Import defineChain
import './globals.css'; // Ensure you have a globals.css for Tailwind
import { GlobalMessageProvider, useGlobalMessage } from '@/context/globalMessageContext';

// 1. Manually define Polygon Amoy chain
// This export allows other files (like page.js for borrower/lender) to import it

export const polygonAmoyChain = defineChain({
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-amoy.polygon.technology/'] },
    public: { http: ['https://rpc-amoy.polygon.technology/'] },
  },
  blockExplorers: {
    default: { name: 'OKLink Amoy', url: 'https://www.oklink.com/amoy' },
    etherscan: { name: 'OKLink Amoy', url: 'https://www.oklink.com/amoy'},
  },
  testnet: true,
});

// export const polygonAmoyChain = defineChain({
//   id: 31337,
//   name: 'Polygon Amoy',
//   nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
//   rpcUrls: {
//     default: { http: ['http://127.0.0.1:8545/'] },
//     public: { http: ['http://127.0.0.1:8545/'] },
//   },
//   blockExplorers: {
//     default: { name: 'OKLink Amoy', url: 'https://www.oklink.com/amoy' },
//     etherscan: { name: 'OKLink Amoy', url: 'https://www.oklink.com/amoy'},
//   },
//   testnet: true,
// });

// 2. Configure chains & providers, using the manually defined Polygon Amoy
const { chains, publicClient } = configureChains(
  [polygonAmoyChain], // Use the manually defined chain
  [publicProvider()]
);

// 3. Create Wagmi config
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({
      chains, // Pass the configured chains
      options: {
        shimDisconnect: true, // Recommended for MetaMask
      },
    })
    // Add other connectors like WalletConnect, CoinbaseWallet if desired
  ],
  publicClient,
});

// Header component incorporating navigation and wallet status
function AppHeader({ setGlobalMessage }) {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { connect, connectors, isLoading: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (connectError && setGlobalMessage) {
        setGlobalMessage(`Connection Error: ${connectError.shortMessage || connectError.message}`);
    }
  }, [connectError, setGlobalMessage]);


  const handleConnect = () => {
    if (connectors.length > 0 && connectors[0].ready) {
      connect({ connector: connectors[0] });
    } else if (connectors.length > 0 && !connectors[0].ready) {
        if (setGlobalMessage) setGlobalMessage("MetaMask is not available. Please install or enable it and ensure it's set to Polygon Amoy or a compatible network.");
    } else {
      if (setGlobalMessage) setGlobalMessage("Error: No wallet connectors configured or available.");
    }
  };

  if (!mounted) return null;

  const isCorrectNetwork = chain?.id === polygonAmoyChain.id;

  return (
    <header className="mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-center py-4 border-b border-slate-700">
        <Link href="/" className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-400 mb-3 sm:mb-0 hover:opacity-80 transition-opacity">
            P2P Loan Platform
        </Link>
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-sky-500 text-white px-5 py-2.5 rounded-lg hover:bg-sky-600 transition-colors shadow-md focus:ring-2 focus:ring-sky-400 focus:ring-opacity-50 text-sm font-medium"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="text-xs sm:text-sm bg-slate-700 px-3 py-1.5 rounded-lg shadow">
              <p>Account: <span className="font-mono bg-slate-600 px-1.5 py-0.5 rounded">{address?.slice(0, 6)}...{address?.slice(-4)}</span></p>
              {chain && (
                <p className={`mt-0.5 ${isCorrectNetwork ? '' : 'text-red-400 font-semibold'}`}>
                  Network: <span className="font-semibold">{chain.name}</span>
                  {!isCorrectNetwork && " (Incorrect - Switch to Polygon Amoy)"}
                </p>
              )}
            </div>
            <button
              onClick={() => disconnect()}
              className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors shadow-md text-xs sm:text-sm font-medium"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
        <nav className="mt-4 flex justify-center space-x-3 sm:space-x-4">
          <Link href="/borrower" className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 shadow-md focus:ring-2 focus:ring-opacity-50 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold text-xs sm:text-sm hover:from-sky-600 hover:to-cyan-600">
              Borrower
          </Link>
          <Link href="/lender" className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 shadow-md focus:ring-2 focus:ring-opacity-50 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-xs sm:text-sm hover:from-purple-600 hover:to-indigo-600">
              Lender
          </Link>
          <Link href="/personal" className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 shadow-md focus:ring-2 focus:ring-opacity-50 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-xs sm:text-sm hover:from-emerald-600 hover:to-teal-600">
              Personal Loan
          </Link>
          <Link href="/credit" className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 shadow-md focus:ring-2 focus:ring-opacity-50 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold text-xs sm:text-sm hover:from-pink-600 hover:to-rose-600">
              Credit Loan
          </Link>
          <Link href="/vault" className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 shadow-md focus:ring-2 focus:ring-opacity-50 bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-semibold text-xs sm:text-sm hover:from-yellow-600 hover:to-amber-600">
              Vault
          </Link>
          <Link href="/deploy" className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 shadow-md focus:ring-2 focus:ring-opacity-50 bg-gradient-to-r from-gray-500 to-slate-500 text-white font-semibold text-xs sm:text-sm hover:from-gray-600 hover:to-slate-600">
              Deploy
          </Link>
        </nav>
    </header>
  );
}

export default function RootLayout({ children }) {
  const [mounted, setMounted] = useState(false);
  const [globalMessage, setGlobalMessage] = useState('');

  const contextValue = useMemo(() => ({
    globalMessage,
    setGlobalMessage,
  }), [globalMessage]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log("re render");
  }, [setGlobalMessage]);

  // useEffect(() => {
  //   if (globalMessage) {
  //     const timer = setTimeout(() => {
  //       setGlobalMessage('');
  //     }, 7000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [globalMessage]);

  if (!mounted) {
    return (
      <html lang="en">
        <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>P2P Loan Platform - Polygon Amoy</title>
        </head>
        <body className="bg-gradient-to-br from-slate-900 to-slate-800 text-gray-100 flex justify-center items-center min-h-screen">
          <div>Loading Platform...</div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
       <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>P2P Loan Platform - Polygon Amoy</title>
        </head>
      <body className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-gray-100 font-sans">
        <WagmiConfig config={wagmiConfig}>
          <div className="max-w-5xl mx-auto p-4 md:p-6">
            <AppHeader setGlobalMessage={setGlobalMessage} />

            <main className="mt-6">
              {children}
            </main>

            <footer className="text-center mt-10 py-5 border-t border-slate-700">
              <p className="text-xs sm:text-sm text-slate-500">&copy; {new Date().getFullYear()} P2P Loan Platform (Polygon Amoy Testnet). All rights reserved.</p>
            </footer>
          </div>
        </WagmiConfig>
      </body>
    </html>
  );
}
