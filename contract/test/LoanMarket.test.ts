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
  describe("CreditLoan Contract Functions", function () {
  let dao: {
    loanMarket: Contract;
    personalLoanImpl: Contract;
    creditLoanImpl: Contract;
    loanMarketImpl: Contract;
  };
  let verifier: Contract;
  let token: Contract;
  let borrower: SignerWithAddress, lender: SignerWithAddress, other: SignerWithAddress;
  let creditLoan: Contract;
  const LOAN_AMOUNT = ethers.parseEther("1000");
  let dueDate: bigint;

  beforeEach(async () => {
    [borrower, lender, other] = await ethers.getSigners();

    // attach existing verifier/token
    verifier = await ethers.getContractAt("Verifiable", verifierAddress);
    token    = await ethers.getContractAt("TestToken", tokenAddress);

    // deploy LoanMarket & impls
    const deployment = await hre.ignition.deploy(ProxyModule, {
      parameters: { ProxyModule: { verifierAddress } },
    });
    dao = {
      loanMarket:       await ethers.getContractAt("LoanMarket", deployment.proxy.address),
      loanMarketImpl:   await ethers.getContractAt("LoanMarket", deployment.loanMarketImpl.address),
      personalLoanImpl: await ethers.getContractAt("PersonalLoan", deployment.personalLoanImpl.address),
      creditLoanImpl:   await ethers.getContractAt("CreditLoan",  deployment.creditLoanImpl.address),
    };

    // create a CreditLoan proxy via the normal lifecycle
    await dao.loanMarket.connect(lender).registerLender();
    dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600);

    await dao.loanMarket.connect(borrower).requestLoan(
      token.target, LOAN_AMOUNT, 800, 1, dueDate, 0, 0
    );
    await dao.loanMarket.connect(borrower).sendLoanApplication(1, lender.address);
    await dao.loanMarket.connect(lender).submitOffer(1, LOAN_AMOUNT, 750, dueDate, 0, 0);
    await dao.loanMarket.connect(borrower).acceptOffer(1, 0);

    const proxyAddr = await dao.loanMarket.deployedLoans(1);
    creditLoan = await ethers.getContractAt("CreditLoan", proxyAddr);
  });

  it("fundLoan(): onlyLender & notFunded → sets isFunded & lastAccrualTimestamp + emits LoanActivated", async () => {
    await expect(creditLoan.connect(lender).fundLoan())
      .to.emit(creditLoan, "LoanActivated")
      .withArgs(lender.address, LOAN_AMOUNT);

    expect(await creditLoan.isFunded()).to.be.true;
    const ts = await creditLoan.lastAccrualTimestamp();
    expect(ts).to.be.a("bigint").that.is.gt(0n);
  });

  it("accrueInterest(): when balance>0, increases outstandingBalance & updates timestamp", async () => {
    // fund it
    await creditLoan.connect(lender).fundLoan();

    // lender must approve before draw()
    await token.connect(lender).approve(creditLoan.target, LOAN_AMOUNT);

    // draw 100
    await creditLoan.connect(borrower).draw(ethers.parseEther("100"));
    const oldBal = await creditLoan.outstandingBalance();
    const oldTs  = await creditLoan.lastAccrualTimestamp();

    // advance time by 1 day
    await ethers.provider.send("evm_increaseTime", [24*3600]);
    await ethers.provider.send("evm_mine");

    // accrue
    await creditLoan.accrueInterest();

    const newBal = await creditLoan.outstandingBalance();
    const newTs  = await creditLoan.lastAccrualTimestamp();

    expect(newBal).to.be.gt(oldBal);
    expect(newTs).to.be.gt(oldTs);
  });

  it("draw(amount): onlyBorrower & nonReentrant & within credit → transfers + emits FundsDrawn", async () => {
    await creditLoan.connect(lender).fundLoan();
    await token.connect(lender).approve(creditLoan.target, LOAN_AMOUNT);

    const drawAmt = ethers.parseEther("200");
    await expect(creditLoan.connect(borrower).draw(drawAmt))
      .to.emit(creditLoan, "FundsDrawn")
      .withArgs(borrower.address, drawAmt);

    expect(await creditLoan.outstandingBalance()).to.equal(drawAmt);
    expect(await token.balanceOf(borrower.address)).to.equal(drawAmt);
  });

  it("repay(amount): onlyBorrower & nonReentrant → decreases balance, maybe sets isRepaid, transfers + emits FundsRepaid", async () => {
    await creditLoan.connect(lender).fundLoan();
    await token.connect(lender).approve(creditLoan.target, LOAN_AMOUNT);
    await creditLoan.connect(borrower).draw(ethers.parseEther("150"));

    // borrower needs tokens to repay
    await token.connect(lender).transfer(borrower.address, ethers.parseEther("150"));
    await token.connect(borrower).approve(creditLoan.target, ethers.parseEther("150"));

    await expect(creditLoan.connect(borrower).repay(ethers.parseEther("150")))
      .to.emit(creditLoan, "FundsRepaid")
      .withArgs(borrower.address, ethers.parseEther("150"));

    expect(await creditLoan.outstandingBalance()).to.equal(0);
    // since now ≤ dueDate, isRepaid stays false
    expect(await creditLoan.isRepaid()).to.be.false;
  });

  it("getAvailableCredit(): returns principalAmount – outstandingBalance", async () => {
    await creditLoan.connect(lender).fundLoan();
    await token.connect(lender).approve(creditLoan.target, LOAN_AMOUNT);

    // draw 300
    await creditLoan.connect(borrower).draw(ethers.parseEther("300"));
    const avail = await creditLoan.getAvailableCredit();
    expect(avail).to.equal(LOAN_AMOUNT - ethers.parseEther("300"));
  });
  });

  describe("PersonalLoan Contract Functions", function () {
    let personalLoan: Contract;
    const NUM_PAYMENTS = 4n;
    const INTERVAL = 7n * 24n * 3600n; // 1 week
    const INTEREST_BPS = 400n;

    function calcInstallment(principal: bigint, interestBps: bigint, n: bigint, interval: bigint) {
      if (interestBps === 0n) return principal / n;
      const WAD = 10n ** 18n;
      const BPS_DIV = 10000n;
      const YEAR = 365n * 24n * 3600n;
      const rate = (interestBps * WAD * interval) / (BPS_DIV * YEAR);
      const rPlusOne = rate + WAD;
      let pow = WAD;
      for (let i = 0n; i < n; i++) {
        pow = (pow * rPlusOne) / WAD;
      }
      const numerator = (principal * rate * pow) / WAD;
      const denominator = pow - WAD;
      return numerator / denominator;
    }

    beforeEach(async () => {
      [borrower, lender, other] = await ethers.getSigners();

      verifier = await ethers.getContractAt("Verifiable", verifierAddress);
      token = await ethers.getContractAt("TestToken", tokenAddress);

      const deployment = await hre.ignition.deploy(ProxyModule, {
        parameters: { ProxyModule: { verifierAddress } },
      });
      dao = {
        loanMarket: await ethers.getContractAt("LoanMarket", deployment.proxy.address),
        loanMarketImpl: await ethers.getContractAt("LoanMarket", deployment.loanMarketImpl.address),
        personalLoanImpl: await ethers.getContractAt("PersonalLoan", deployment.personalLoanImpl.address),
        creditLoanImpl: await ethers.getContractAt("CreditLoan", deployment.creditLoanImpl.address),
      };

      await dao.loanMarket.connect(lender).registerLender();

      await dao.loanMarket.connect(borrower).requestLoan(
        token.target,
        LOAN_AMOUNT,
        800,
        0,
        0,
        Number(NUM_PAYMENTS),
        Number(INTERVAL)
      );
      await dao.loanMarket.connect(borrower).sendLoanApplication(1, lender.address);
      await dao.loanMarket.connect(lender).submitOffer(
        1,
        LOAN_AMOUNT,
        Number(INTEREST_BPS),
        0,
        Number(NUM_PAYMENTS),
        Number(INTERVAL)
      );
      await dao.loanMarket.connect(borrower).acceptOffer(1, 0);

      const proxyAddr = await dao.loanMarket.deployedLoans(1);
      personalLoan = await ethers.getContractAt("PersonalLoan", proxyAddr);
    });

    it("fundLoan() transfers funds and sets installment & due date", async () => {
      const expInstallment = calcInstallment(LOAN_AMOUNT, INTEREST_BPS, NUM_PAYMENTS, INTERVAL);
      const balBefore = await token.balanceOf(borrower.address);

      await token.connect(lender).approve(personalLoan.target, LOAN_AMOUNT);
      const tx = await personalLoan.connect(lender).fundLoan();
      await expect(tx)
        .to.emit(personalLoan, "LoanFunded")
        .withArgs(lender.address, borrower.address, LOAN_AMOUNT, expInstallment);

      const balAfter = await token.balanceOf(borrower.address);
      expect(balAfter - balBefore).to.equal(LOAN_AMOUNT);

      expect(await personalLoan.installmentAmount()).to.equal(expInstallment);

      const block = await ethers.provider.getBlock(tx.blockNumber!);
      expect(await personalLoan.nextDueDate()).to.equal(BigInt(block.timestamp) + INTERVAL);
    });

    it("makeInstallmentPayment() updates counts and balances", async () => {
      await token.connect(lender).approve(personalLoan.target, LOAN_AMOUNT);
      const txFund = await personalLoan.connect(lender).fundLoan();
      await txFund.wait();

      const installment = await personalLoan.installmentAmount();
      await token.connect(borrower).approve(personalLoan.target, installment);

      const principalBefore = await personalLoan.principalAmount();
      const dueBefore = await personalLoan.nextDueDate();

      await expect(personalLoan.connect(borrower).makeInstallmentPayment())
        .to.emit(personalLoan, "PaymentMade")
        .withArgs(borrower.address, 1, installment);

      expect(await personalLoan.paymentsMade()).to.equal(1);
      expect(await personalLoan.principalAmount()).to.be.lt(principalBefore);
      expect(await personalLoan.nextDueDate()).to.equal(dueBefore + INTERVAL);
    });
  });
});



