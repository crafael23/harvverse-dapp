import { expect } from "chai";
import { ethers } from "hardhat";
import { MicroLoan, CropNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("MicroLoan", function () {
  let microLoan: MicroLoan;
  let cropNFT: CropNFT;
  let owner: SignerWithAddress;
  let farmer: SignerWithAddress;
  let funder: SignerWithAddress;
  let other: SignerWithAddress;

  const LOAN_AMOUNT = ethers.parseEther("1.0"); // 1 ETH
  const INTEREST_AMOUNT = ethers.parseEther("0.05"); // 5% of 1 ETH = 0.05 ETH
  const TOTAL_REPAYMENT = LOAN_AMOUNT + INTEREST_AMOUNT;
  const LOAN_DURATION = 90 * 24 * 60 * 60; // 90 days in seconds

  beforeEach(async () => {
    [owner, farmer, funder, other] = await ethers.getSigners();

    // Deploy CropNFT
    const CropNFTFactory = await ethers.getContractFactory("CropNFT");
    cropNFT = (await CropNFTFactory.deploy(owner.address)) as CropNFT;
    await cropNFT.waitForDeployment();

    // Deploy MicroLoan
    const MicroLoanFactory = await ethers.getContractFactory("MicroLoan");
    microLoan = (await MicroLoanFactory.deploy()) as MicroLoan;
    await microLoan.waitForDeployment();

    // Setup: Mint NFT to farmer
    await cropNFT.mint("ipfs://QmTest123");
    await cropNFT.transferFrom(owner.address, farmer.address, 1);
  });

  describe("Deployment", function () {
    it("Should set correct interest rate", async function () {
      expect(await microLoan.INTEREST_RATE()).to.equal(5); // 5%
    });

    it("Should set correct loan duration", async function () {
      expect(await microLoan.LOAN_DURATION()).to.equal(LOAN_DURATION);
    });
  });

  describe("Loan Request", function () {
    it("Should allow farmer to request loan with NFT collateral", async function () {
      // Approve MicroLoan to transfer NFT
      await cropNFT.connect(farmer).approve(await microLoan.getAddress(), 1);

      await expect(microLoan.connect(farmer).requestLoan(await cropNFT.getAddress(), 1, LOAN_AMOUNT))
        .to.emit(microLoan, "LoanRequested")
        .withArgs(0, farmer.address, await cropNFT.getAddress(), 1, LOAN_AMOUNT);

      const loan = await microLoan.loans(0);
      expect(loan.borrower).to.equal(farmer.address);
      expect(loan.principal).to.equal(LOAN_AMOUNT);
      expect(loan.nftContract).to.equal(await cropNFT.getAddress());
      expect(loan.nftTokenId).to.equal(1);
      expect(loan.status).to.equal(0); // Requested

      // NFT should be transferred to MicroLoan contract
      expect(await cropNFT.ownerOf(1)).to.equal(await microLoan.getAddress());
    });

    it("Should not allow requesting loan without NFT ownership", async function () {
      await expect(microLoan.connect(other).requestLoan(await cropNFT.getAddress(), 1, LOAN_AMOUNT)).to.be.revertedWith(
        "ERC721: caller is not token owner or approved",
      );
    });

    it("Should not allow zero loan amount", async function () {
      await cropNFT.connect(farmer).approve(await microLoan.getAddress(), 1);

      await expect(microLoan.connect(farmer).requestLoan(await cropNFT.getAddress(), 1, 0)).to.be.revertedWith(
        "MicroLoan: amount must be greater than 0",
      );
    });
  });

  describe("Loan Funding", function () {
    beforeEach(async () => {
      // Farmer requests loan
      await cropNFT.connect(farmer).approve(await microLoan.getAddress(), 1);
      await microLoan.connect(farmer).requestLoan(await cropNFT.getAddress(), 1, LOAN_AMOUNT);
    });

    it("Should allow funder to fund the loan with ETH", async function () {
      const farmerBalanceBefore = await ethers.provider.getBalance(farmer.address);

      await expect(microLoan.connect(funder).fundLoan(0, { value: LOAN_AMOUNT }))
        .to.emit(microLoan, "LoanFunded")
        .withArgs(0, funder.address);

      const loan = await microLoan.loans(0);
      expect(loan.lender).to.equal(funder.address);
      expect(loan.status).to.equal(1); // Funded
      expect(loan.deadline).to.be.gt(0);

      // Farmer should receive ETH
      const farmerBalanceAfter = await ethers.provider.getBalance(farmer.address);
      expect(farmerBalanceAfter).to.equal(farmerBalanceBefore + LOAN_AMOUNT);
    });

    it("Should not allow funding with incorrect ETH amount", async function () {
      await expect(microLoan.connect(funder).fundLoan(0, { value: LOAN_AMOUNT / 2n })).to.be.revertedWith(
        "MicroLoan: incorrect ETH amount",
      );
    });

    it("Should not allow funding already funded loan", async function () {
      await microLoan.connect(funder).fundLoan(0, { value: LOAN_AMOUNT });

      await expect(microLoan.connect(other).fundLoan(0, { value: LOAN_AMOUNT })).to.be.revertedWith(
        "MicroLoan: loan not available for funding",
      );
    });
  });

  describe("Loan Repayment", function () {
    beforeEach(async () => {
      // Setup: Create and fund loan
      await cropNFT.connect(farmer).approve(await microLoan.getAddress(), 1);
      await microLoan.connect(farmer).requestLoan(await cropNFT.getAddress(), 1, LOAN_AMOUNT);
      await microLoan.connect(funder).fundLoan(0, { value: LOAN_AMOUNT });
    });

    it("Should allow borrower to repay loan with ETH", async function () {
      const funderBalanceBefore = await ethers.provider.getBalance(funder.address);

      await expect(microLoan.connect(farmer).repay(0, { value: TOTAL_REPAYMENT }))
        .to.emit(microLoan, "LoanRepaid")
        .withArgs(0, farmer.address);

      const loan = await microLoan.loans(0);
      expect(loan.status).to.equal(2); // Repaid

      // NFT should be returned to farmer
      expect(await cropNFT.ownerOf(1)).to.equal(farmer.address);

      // Funder should receive principal + interest
      const funderBalanceAfter = await ethers.provider.getBalance(funder.address);
      expect(funderBalanceAfter).to.equal(funderBalanceBefore + TOTAL_REPAYMENT);
    });

    it("Should not allow repaying with incorrect amount", async function () {
      await expect(microLoan.connect(farmer).repay(0, { value: LOAN_AMOUNT })).to.be.revertedWith(
        "MicroLoan: incorrect repayment amount",
      );
    });

    it("Should not allow non-borrower to repay", async function () {
      await expect(microLoan.connect(other).repay(0, { value: TOTAL_REPAYMENT })).to.be.revertedWith(
        "MicroLoan: only borrower can repay",
      );
    });

    it("Should not allow repaying after deadline", async function () {
      // Move time past deadline
      await time.increase(LOAN_DURATION + 1);

      await expect(microLoan.connect(farmer).repay(0, { value: TOTAL_REPAYMENT })).to.be.revertedWith(
        "MicroLoan: loan expired",
      );
    });
  });

  describe("Loan Liquidation", function () {
    beforeEach(async () => {
      // Setup: Create and fund loan
      await cropNFT.connect(farmer).approve(await microLoan.getAddress(), 1);
      await microLoan.connect(farmer).requestLoan(await cropNFT.getAddress(), 1, LOAN_AMOUNT);
      await microLoan.connect(funder).fundLoan(0, { value: LOAN_AMOUNT });
    });

    it("Should allow funder to liquidate after deadline", async function () {
      // Move time past deadline
      await time.increase(LOAN_DURATION + 1);

      await expect(microLoan.connect(funder).liquidate(0))
        .to.emit(microLoan, "LoanLiquidated")
        .withArgs(0, funder.address);

      const loan = await microLoan.loans(0);
      expect(loan.status).to.equal(3); // Liquidated

      // NFT should be transferred to funder
      expect(await cropNFT.ownerOf(1)).to.equal(funder.address);
    });

    it("Should not allow liquidation before deadline", async function () {
      await expect(microLoan.connect(funder).liquidate(0)).to.be.revertedWith("MicroLoan: loan not expired");
    });

    it("Should not allow non-lender to liquidate", async function () {
      // Move time past deadline
      await time.increase(LOAN_DURATION + 1);

      await expect(microLoan.connect(other).liquidate(0)).to.be.revertedWith("MicroLoan: only lender can liquidate");
    });
  });

  describe("Loan Details", function () {
    it("Should return correct loan details", async function () {
      await cropNFT.connect(farmer).approve(await microLoan.getAddress(), 1);
      await microLoan.connect(farmer).requestLoan(await cropNFT.getAddress(), 1, LOAN_AMOUNT);

      const loan = await microLoan.getLoan(0);
      expect(loan.borrower).to.equal(farmer.address);
      expect(loan.principal).to.equal(LOAN_AMOUNT);
      expect(loan.interest).to.equal(INTEREST_AMOUNT);
      expect(loan.nftContract).to.equal(await cropNFT.getAddress());
      expect(loan.nftTokenId).to.equal(1);
      expect(loan.status).to.equal(0); // Requested
    });
  });
});
