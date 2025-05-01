# Loan Platform Web Interface

This is a Next.js web application for interacting with the Loan smart contract.

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- A WalletConnect project ID (for wallet connection)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with the following variables:
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_contract_address
NEXT_PUBLIC_TOKEN_ADDRESS=your_erc20_token_address
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Connect your wallet using RainbowKit
- Register as a lender
- Request loans with specified amount, interest rate, and due date
- View and manage your loans

## Development

The application is built with:
- Next.js 14
- TypeScript
- Tailwind CSS
- wagmi
- RainbowKit
- viem

## License

MIT
