# Smart Contracts

This folder contains the Hardhat project used to develop and deploy the Loan platform contracts.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Compile contracts:

```bash
npx hardhat compile
```

3. Run tests:

```bash
npx hardhat test
```

4. Deploy to a local node for development:

```bash
npx hardhat node &
# in another terminal
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

Environment variables such as private keys and RPC URLs can be defined in a `.env` file. Refer to Hardhat documentation for more details.


## Deployment on Amoy Testnet

The following Hardhat Ignition modules deploy the contracts to Polygon's Amoy testnet.

### LoanMarketModule
Market loan matching for lenders and borrowers. Set `verifierAddress` to the Universal Verifier contract.

```bash
npx hardhat ignition deploy ignition/modules/LoanMarketModule.ts --parameters '{ProxyModule:{"verifierAddress":"0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c"}}' --network amoy
```

### VaultManagerModule
ERC-4926 compatible vaults.

```bash
npx hardhat ignition deploy ignition/modules/VaultManagerModule.ts --network amoy
```

### TestToken (optional)
Deploys a basic ERC-20 token for testing.

```bash
npx hardhat ignition deploy ignition/modules/TestToken.ts --network amoy
```
