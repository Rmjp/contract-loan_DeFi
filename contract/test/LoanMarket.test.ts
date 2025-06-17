import { expect } from "chai";
import hre, { ethers } from "hardhat";
import type { Contract } from "ethers";
import LoanMarketModule from "../ignition/modules/LoanMarketModule";
import { ProxyModule } from "../ignition/modules/ProxyModule";

describe("LoanMarket (Ignition) Integration with External Verifier/Token", function () {
  let dao: {
    loanMarket: any;
    personalLoanImpl: any;
    creditLoanImpl: any;
    loanMarketImpl: any;
  };
  let verifier: Contract;
  let token: Contract;
  let borrower: any, lender: any, other: any;

  // Existing deployed addresses
  const verifierAddress = "0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c";
  const tokenAddress    = "0x17E6459067dDbB870F8D4E961454eC39C695d35C";
  const LOAN_AMOUNT     = ethers.parseEther("1000");

  beforeEach(async () => {
    [borrower, lender, other] = await ethers.getSigners();

    // Attach to existing verifier and token by address
    verifier = await ethers.getContractAt("Verifiable", verifierAddress);
    token    = await ethers.getContractAt("TestToken", tokenAddress);

    // Deploy LoanMarket & implementations via Ignition
    const deployment = await hre.ignition.deploy(ProxyModule, {
      parameters: {ProxyModule:{"verifierAddress":"0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c"}},
    });

    dao = {
      loanMarket:       await ethers.getContractAt("LoanMarket", deployment.proxy.address),
      loanMarketImpl: await ethers.getContractAt("LoanMarket", deployment.loanMarketImpl.address),
      personalLoanImpl: await ethers.getContractAt("PersonalLoan", deployment.personalLoanImpl.address),
      creditLoanImpl:   await ethers.getContractAt("CreditLoan",  deployment.creditLoanImpl.address),
    };
  });

  it("Lender registration and proof requirements flow", async () => {
    // Initially not registered
    expect(await dao.loanMarket.isLenderRegistered(lender.address)).to.be.false;

    // Register lender
    await expect(dao.loanMarket.connect(lender).registerLender())
      .to.emit(dao.loanMarket, "LenderRegistered")
      .withArgs(lender.address);

    // Set required proofs
    const proofs = [1, 2, 3].map(n => BigInt(n));
    await expect(dao.loanMarket.connect(lender).setRequiredProofs(proofs))
      .to.emit(dao.loanMarket, "LenderRequiredProofsSet")
      .withArgs(lender.address, proofs);

    // Verify retrieval
    expect(await dao.loanMarket.getRequiredProofs(lender.address)).to.deep.equal(proofs);
  });

  describe("Personal Loan lifecycle", () => {
    it("request → apply → offer → accept creates a proxy", async () => {
      await dao.loanMarket.connect(lender).registerLender();

      // Borrower requests loan
      await expect(
        dao.loanMarket.connect(borrower).requestLoan(
          token.target,
          LOAN_AMOUNT,
          500,              // max 5%
          0,                // LoanType.Personal
          0,                // dueDate unused
          4,                // numberOfPayments
          7 * 24 * 3600     // paymentInterval
        )
      ).to.emit(dao.loanMarket, "LoanRequested");
      
      // Send application
      await expect(
        dao.loanMarket.connect(borrower).sendLoanApplication(1, lender.address)
      ).to.emit(dao.loanMarket, "LoanApplicationSent");

      // Lender submits an offer
      await expect(
        dao.loanMarket.connect(lender).submitOffer(
          1,
          LOAN_AMOUNT,
          400,              // 4%
          0,
          4,
          7 * 24 * 3600
        )
      ).to.emit(dao.loanMarket, "LoanOfferSubmitted");

      // Borrower accepts offer
      await expect(
        dao.loanMarket.connect(borrower).acceptOffer(1, 0)
      )
        .to.emit(dao.loanMarket, "LoanCreated");
      const proxyAddr = await dao.loanMarket.deployedLoans(1);

      // Check mapping
      expect(proxyAddr).to.properAddress;

      // Inspect proxy state
      const loanProxy = await ethers.getContractAt("LoanBase", proxyAddr);
      const [b, l, pr, intBps,,,,] = await loanProxy.state();
      expect(b).to.equal(borrower.address);
      expect(l).to.equal(lender.address);
      expect(pr).to.equal(LOAN_AMOUNT);
      expect(intBps).to.equal(400n);
    });
  });

  describe("Credit Loan lifecycle", () => {
    it("creates a credit loan proxy correctly", async () => {
      await dao.loanMarket.connect(lender).registerLender();
      const dueDate = BigInt(Math.floor(Date.now()/1000) + 30 * 24 * 3600);

      await dao.loanMarket.connect(borrower).requestLoan(
        token.target,
        LOAN_AMOUNT,
        800,             // max 8%
        1,               // LoanType.Credit
        dueDate,
        0,
        0
      );
      await dao.loanMarket.connect(borrower).sendLoanApplication(1, lender.address);
      await dao.loanMarket.connect(lender).submitOffer(1, LOAN_AMOUNT, 750, dueDate, 0, 0);

      await expect(
        dao.loanMarket.connect(borrower).acceptOffer(1, 0)
      ).to.emit(dao.loanMarket, "LoanCreated");

      const proxyAddr = await dao.loanMarket.deployedLoans(1);
      expect(proxyAddr).to.properAddress;

      const loanProxy = await ethers.getContractAt("LoanBase", proxyAddr);
      const [,, pr, intBps, dt,,,] = await loanProxy.state();
      expect(pr).to.equal(LOAN_AMOUNT);
      expect(intBps).to.equal(750n);
      expect(dt).to.equal(dueDate);
    });
  });
});
