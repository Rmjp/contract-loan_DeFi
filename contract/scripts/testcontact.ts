// scripts/checkContract.js

const { ethers } = require("hardhat");

// --- CONFIGURATION ---
// PASTE THE CONTRACT ADDRESS HERE
const CONTRACT_ADDRESS = "0x5723ce8060cf4b3490344c0B40114413a633abd5"; // <-- Replace with your contract's address
// SPECIFY THE CONTRACT NAME FROM YOUR `contracts/` DIRECTORY
const CONTRACT_NAME = "LoanContract"; // <-- Replace with your contract's name
// --- END CONFIGURATION ---

async function main() {
  console.log(`Checking contract "${CONTRACT_NAME}" at address: ${CONTRACT_ADDRESS}`);

  // 1. Check if there is code at the address
  const code = await ethers.provider.getCode(CONTRACT_ADDRESS);
  if (code === "0x") {
    console.error(`ERROR: No contract code found at address ${CONTRACT_ADDRESS} on this network.`);
    console.error("Please check the address and the connected network.");
    return;
  }
  console.log("✅ Contract code found.");

  // 2. Attach to the contract and try to call a function
  let contract;
  try {
    contract = await ethers.getContractAt(CONTRACT_NAME, CONTRACT_ADDRESS);
    console.log(`✅ Successfully attached to contract "${CONTRACT_NAME}".`);
  } catch (error) {
    console.error(`ERROR: Could not attach to contract "${CONTRACT_NAME}".`);
    console.error("Please ensure the CONTRACT_NAME in the script matches the actual contract.");
    console.error("Full error:", error);
    return;
  }

  // 3. Interact with the contract to verify it's the one you expect
  //    (Replace 'owner' with a simple, public, view function from your contract)
  try {
    // --- Common examples of functions to call ---
    // const owner = await contract.owner();
    // console.log(`✅ Successfully called 'owner()'. The owner is: ${owner}`);

    // const name = await contract.name();
    // console.log(`✅ Successfully called 'name()'. The name is: ${name}`);

    const symbol = await contract.symbol();
    console.log(`✅ Successfully called 'symbol()'. The symbol is: ${symbol}`);

    console.log("\nContract check complete. The contract seems to be valid and responsive.");

  } catch (error) {
    console.error("\n❌ ERROR: While the contract exists, it was not possible to call the test function on it.");
    console.error("This could mean:");
    console.error("  - You are connected to the wrong network.");
    console.error("  - The address is correct, but it's a different contract.");
    console.error("  - The ABI in your project does not match the deployed contract.");
    console.error("Full error:", error?.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });