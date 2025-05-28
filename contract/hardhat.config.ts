import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  networks: {
    local: {
      url: "http://127.0.0.1:8545",
    },
    // quaix: {
    //   url: "http://18.142.248.6:8545",
    //   chainId: 8888884,
    //   accounts: [
    //     process.env.PRIVATE_KEY_quaix? process.env.PRIVATE_KEY_quaix : "",
    //   ],
    //   hardfork: "shanghai",
    // },
    amoy: {
      url: "https://rpc-amoy.polygon.technology", // Official Amoy RPC
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY_AMOY ? [process.env.PRIVATE_KEY_AMOY] : [],
    },
  },
  solidity: "0.8.20",
};

export default config;
