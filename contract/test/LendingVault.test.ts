import { expect } from "chai";
import { ethers } from "hardhat";

const verifierAddress = "0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c";

describe("LendingVault", function () {
  async function deployFixture() {
    const [owner, borrower, user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("TestToken");
    const token = await Token.deploy();
    await token.waitForDeployment();

    const Vault = await ethers.getContractFactory("LendingVault");
    const vault = await Vault.deploy(token.target, verifierAddress);
    await vault.waitForDeployment();

    await token.mint(user.address, ethers.parseEther("1000"));
    await token.mint(owner.address, ethers.parseEther("1000"));

    return { owner, borrower, user, token, vault };
  }

  it("allows deposits when request id is zero", async () => {
    const { user, token, vault } = await deployFixture();

    await token.connect(user).approve(vault.target, ethers.parseEther("100"));
    await expect(vault.connect(user).deposit(ethers.parseEther("100"), user.address))
      .to.emit(vault, "Deposit")
      .withArgs(user.address, user.address, ethers.parseEther("100"), ethers.parseEther("100"));

    expect(await vault.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
  });

  it("requires verification when request id is set", async () => {
    const { owner, user, token, vault } = await deployFixture();

    await vault.connect(owner).setDepositRequestId(1);
    await token.connect(user).approve(vault.target, ethers.parseEther("50"));
    await expect(
      vault.connect(user).deposit(ethers.parseEther("50"), user.address)
    ).to.be.reverted;
  });

  it("fundLoan transfers assets to loan", async () => {
    const { owner, borrower, token, vault } = await deployFixture();

    await token.connect(owner).approve(vault.target, ethers.parseEther("200"));
    await vault.connect(owner).deposit(ethers.parseEther("200"), owner.address);

    const Loan = await ethers.getContractFactory("CreditLoan");
    const loan = await Loan.deploy();
    await loan.waitForDeployment();
    await loan.initialize(
      borrower.address,
      vault.target,
      token.target,
      ethers.parseEther("150"),
      0,
      Math.floor(Date.now() / 1000) + 3600,
      0,
      0,
      owner.address
    );

    await expect(vault.connect(owner).fundLoan(loan.target)).to.emit(loan, "LoanActivated");
    expect(await loan.isFunded()).to.equal(true);
  });

  it("fundLoan reverts with insufficient assets", async () => {
    const { owner, borrower, vault, token } = await deployFixture();

    const Loan = await ethers.getContractFactory("CreditLoan");
    const loan = await Loan.deploy();
    await loan.waitForDeployment();
    await loan.initialize(
      borrower.address,
      vault.target,
      token.target,
      ethers.parseEther("10"),
      0,
      Math.floor(Date.now() / 1000) + 3600,
      0,
      0,
      owner.address
    );

    await expect(
      vault.connect(owner).fundLoan(loan.target)
    ).to.be.revertedWith("LV: insufficient assets");
  });
});
