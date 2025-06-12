// test/LoanMarket.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { Contract } from "ethers";

describe("LoanMarket → PersonalLoan", function () {
  let borrower: any, lender: any, deployer: any;
  let token: any;
  let personalLoanImpl: any;
  let creditLoanImpl: any;
  let loanMarket: any;

  // test parameters
  const initialSupply   = ethers.parseUnits("10000", 18);
  const principal       = ethers.parseUnits("1000", 18);
  const interestBps     = 300;             // 3%
  const payments        = 5;
  const paymentInterval = 60 * 60 * 24;    // 1 day

  before(async () => {

    [deployer, borrower, lender] = await ethers.getSigners();

    // 1) Deploy an TokenERC20 and mint to borrower & lender
    const Token = await ethers.getContractFactory("TestToken");
    token = await Token.deploy();
    await token.waitForDeployment();
    await token.mint(await borrower.getAddress(), initialSupply);
    await token.mint(await lender.getAddress(),   initialSupply);

    // 2) Deploy the PersonalLoan implementation
    const PL = await ethers.getContractFactory("PersonalLoan");
    personalLoanImpl = await PL.deploy();
    await personalLoanImpl.waitForDeployment();
    // (we don’t have a real CreditLoan here, so just reuse)
    creditLoanImpl = personalLoanImpl;

    // 3) Deploy LoanMarket and initialize
    const LM = await ethers.getContractFactory("LoanMarket");
    loanMarket = await LM.deploy();
    await loanMarket.waitForDeployment();
    await loanMarket.initialize(
      personalLoanImpl.address,
      creditLoanImpl.address
    );
  });

  
  it("registers a lender", async () => {
    await expect(loanMarket.connect(lender).registerLender())
    .to.emit(loanMarket, "LenderRegistered")
    .withArgs(await lender.getAddress());
  });
  
  
  it("lets borrower request a personal loan", async () => {
    await expect(
      loanMarket.connect(borrower).requestLoan(
        token.address,
        principal,
        interestBps,
        0,         // LoanType.Personal
        0,         // dueDate (unused)
        payments,  // numPayments
        paymentInterval
      )
    ).to.emit(loanMarket, "LoanRequested")
     .withArgs(1, await borrower.getAddress(), 0, principal);
  });

  it("lets borrower send an application to the lender", async () => {
    await expect(
      loanMarket.connect(borrower).sendLoanApplication(
        1,
        await lender.getAddress()
      )
    ).to.emit(loanMarket, "LoanApplicationSent")
     .withArgs(1, await borrower.getAddress(), await lender.getAddress());
  });

  it("lets lender submit an offer", async () => {
    await expect(
      loanMarket.connect(lender).submitOffer(
        1,
        principal,
        interestBps,
        0,          // dueDateOffered
        payments,   // paymentsOffered
        paymentInterval
      )
    ).to.emit(loanMarket, "LoanOfferSubmitted")
     .withArgs(1, await lender.getAddress(), principal, interestBps);
  });

  it("lets borrower accept the offer and deploys a proxy", async () => {
    await expect(
      loanMarket.connect(borrower).acceptOffer(1, 0)
    ).to.emit(loanMarket, "LoanCreated");
    const proxyAddr = await loanMarket.deployedLoans(1);
    expect(proxyAddr).to.properAddress;
  });

  it("lets lender fund the loan and borrower make a payment", async () => {
    const proxyAddr = await loanMarket.deployedLoans(1);
    const personalLoan = await ethers.getContractAt("PersonalLoan", proxyAddr);

    // a) lender approves & funds
    await token.connect(lender).approve(proxyAddr, principal);
    await expect(personalLoan.connect(lender).fundLoan())
      .to.emit(personalLoan, "LoanFunded")
      .withArgs(
        await lender.getAddress(),
        await borrower.getAddress(),
        principal,
        anyValue             // installmentAmount computed in-contract
      );

    // b) verify core state
    const [b, l, p, i, , isFunded, isRepaid] = await personalLoan.state();
    expect(b).to.equal(await borrower.getAddress());
    expect(l).to.equal(await lender.getAddress());
    expect(p).to.equal(principal);
    expect(i).to.equal(interestBps);
    expect(isFunded).to.be.true;
    expect(isRepaid).to.be.false;

    // c) borrower makes first installment
    const installment = await personalLoan.installmentAmount();
    await token.connect(borrower).approve(proxyAddr, installment);
    await expect(personalLoan.connect(borrower).makeInstallmentPayment())
      .to.emit(personalLoan, "PaymentMade")
      .withArgs(await borrower.getAddress(), 1, installment);
  });
});
