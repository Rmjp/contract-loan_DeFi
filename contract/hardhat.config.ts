import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";
import "@openzeppelin/hardhat-upgrades";

import '@typechain/hardhat'
import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import "@nomicfoundation/hardhat-verify";

dotenv.config();

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      chains: {
        80002: {
          hardforkHistory: {
            "shanghai": 22486000,
          }
        },
      },
      forking: {
        // url: "https://polygon-amoy.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY_POLYGON_AMOY,
        url: "https://rpc-amoy.polygon.technology/",
        // (Optional) Pin a block number to run tests on a deterministic state
        blockNumber: 22524270
      },
      // hardfork: "cancun",
    },
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
  solidity: {
    compilers: [
      { 
        version: "0.8.20", // For your contracts
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        }
      },
      { 
        version: "0.8.27", // For @iden3/contracts if they require a specific newer version
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        }
      }
    ],
    // If all contracts (yours and @iden3/contracts) can use 0.8.20, simplify to:
    // version: "0.8.20",
    // settings: {
    //   optimizer: {
    //     enabled: true,
    //     runs: 200,
    //   },
    // }
  },
  etherscan: {
  apiKey: {
    amoy: process.env.POLYGONSCAN_API_KEY || "",
  },
  customChains: [
    {
      network: "amoy",
      chainId: 80002,
      urls: {
        apiURL: "https://api-amoy.polygonscan.com/api",
        browserURL: "https://amoy.polygonscan.com"
      }
    }
  ]
},
sourcify: {
    // Disabled by default
    // Doesn't need an API key
    enabled: true
  }
};

export default config;
