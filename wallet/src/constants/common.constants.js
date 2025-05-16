export const RHS_URL = 'https://rhs-staging.polygonid.me';
export const RPC_URL = 'https://rpc-mainnet.privado.id';

export const defaultEthConnectionConfig =  [{
	url: RPC_URL,
	defaultGasLimit: 600000,
	minGasPrice: '0',
	maxGasPrice: '100000000000',
	confirmationBlockCount: 5,
	confirmationTimeout: 600000,
	contractAddress: '0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896',
	receiptTimeout: 600000,
	rpcResponseTimeout: 5000,
	waitReceiptCycleTime: 30000,
	waitBlockCycleTime: 3000,
	chainId: 21000
   }];

export const INIT = 'Init';

export const DEFAULT_ACCOUNT_NAME = 'Polygon Account';
