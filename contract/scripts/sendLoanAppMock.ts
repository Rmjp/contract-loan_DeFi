// scripts/mimicSendApplication.ts
import { ethers, network } from "hardhat";
import { solidityPacked, keccak256, hexlify, zeroPadValue, Signer, BaseContract } from "ethers";

// Helper function to fake a proof verification. We'll reuse this.
async function setProofVerified(
  verifierAddress: string,
  targetAddress: string,
  requestId: number,
  shouldBeVerified: boolean
) {
  console.log(`   - Setting proof for Request ID: ${requestId} to ${shouldBeVerified}`);
  const mappingSlot = 0; // Assuming _proofStatus mapping is at slot 0 in Verifier
  
  const innerSlot = keccak256(
    solidityPacked(["address", "uint256"], [targetAddress, mappingSlot])
  );
  
  const finalStorageSlot = keccak256(
    solidityPacked(["uint64", "bytes32"], [requestId, innerSlot])
  );
  
  const valueToSet = hexlify(zeroPadValue(shouldBeVerified ? "0x01" : "0x00", 32));

  await network.provider.send("hardhat_setStorageAt", [
    verifierAddress,
    finalStorageSlot,
    valueToSet,
  ]);
}


async function main() {
  // --- 1. SETUP ---
  console.log("--- 1. Setting up accounts and contracts ---");
  const [borrower, lender] = await ethers.getSigners();
  const loanContractAddress = "YOUR_LOAN_CONTRACT_ADDRESS";
  const verifierContractAddress = "YOUR_UNIVERSAL_VERIFIER_ADDRESS";
  // This could be any ERC20 token address you have on your local node
  const tokenAddress = "YOUR_ERC20_TOKEN_ADDRESS"; 

  const loanContract = await ethers.getContractAt("LoanContract", loanContractAddress);

  console.log(`Borrower: ${borrower.address}`);
  console.log(`Lender:   ${lender.address}\n`);

  // --- 2. LENDER REGISTERS AND SETS PROOF REQUIREMENTS ---
  console.log("--- 2. Lender registers and sets requirements ---");
  const lenderContract = loanContract.connect(lender);
  
  // Register lender if not already registered
  const isRegistered = await lenderContract.isLenderRegistered(lender.address);
  if (!isRegistered) {
      await (await lenderContract.registerLender()).wait();
      console.log("Lender has been registered.");
  } else {
      console.log("Lender was already registered.");
  }
  
  const requiredProofs = [101, 102]; // Lender requires two proofs
  await (await lenderContract.setRequiredProofs(requiredProofs)).wait();
  console.log(`Lender now requires proof IDs: ${requiredProofs.join(', ')}\n`);

  // --- 3. BORROWER REQUESTS A LOAN ---
  console.log("--- 3. Borrower requests a new loan ---");
  const borrowerContract = loanContract.connect(borrower);
  const requestTx = await borrowerContract.requestLoan(
    tokenAddress,
    ethers.parseEther("10"), // 10 tokens
    500, // 5% max interest
    Math.floor(Date.now() / 1000) + 86400 * 30 // Due in 30 days
  );
  const receipt = await requestTx.wait();
  // Find the LoanRequested event in the transaction receipt to get the loanId
  const loanRequestedEvent = receipt.logs.find(
      (log: any) => log.eventName === 'LoanRequested'
  );
  if (!loanRequestedEvent || !loanRequestedEvent.args) {
      throw new Error("LoanRequested event not found");
  }
  const loanId = loanRequestedEvent.args.loanId;
  console.log(`Borrower created Loan ID: ${loanId}\n`);

  // --- 4. MIMIC THE PROOF VERIFICATION ---
  console.log("--- 4. Bypassing ZKP checks by manipulating state ---");
  // We will now set the required proofs to "verified" for the borrower
  await setProofVerified(verifierContractAddress, borrower.address, requiredProofs[0], true);
  await setProofVerified(verifierContractAddress, borrower.address, requiredProofs[1], true);
  console.log("State manipulated. The contract will now think the proofs are verified.\n");

  // --- 5. SEND THE APPLICATION (WITHOUT REAL PROOFS) ---
  console.log("--- 5. Borrower sends loan application to lender ---");
  console.log("Calling sendLoanApplication...");
  await (await borrowerContract.sendLoanApplication(loanId, lender.address)).wait();
  console.log("✅ sendLoanApplication was successful!\n");

  // --- 6. VERIFY THE RESULT ---
  console.log("--- 6. Verifying the application was recorded ---");
  const applicationStatus = await loanContract.loanApplications(loanId, lender.address);
  console.log(`Application status for Loan ${loanId} to Lender ${lender.address}: ${applicationStatus}`);

  if (applicationStatus) {
    console.log("🎉 Mimic successful! The loan application was recorded in the contract.");
  } else {
    console.log("❌ Something went wrong. The application was not recorded.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });