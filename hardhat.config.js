require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 31337,
      // This ensures the local network is always available
      mining: {
        auto: true,
        interval: 0
      }
    },
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/kepUw7sPrkvIrU8AH0CJBX3jqBI4sgq_",
      accounts: [PRIVATE_KEY],
      chainId: 11155111
    }
  },
  // This makes the local network available for testing
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY
    }
  }
};
