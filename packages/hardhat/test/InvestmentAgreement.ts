import { expect } from "chai";
import { ethers } from "hardhat";
import { InvestmentAgreement, CropNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("InvestmentAgreement", function () {
  let investmentAgreement: InvestmentAgreement;
  let cropNFT: CropNFT;
  let owner: SignerWithAddress;
  let farmer: SignerWithAddress;
  let investor: SignerWithAddress;
  let oracle: SignerWithAddress;
  let other: SignerWithAddress;

  const INVEST_AMOUNT = ethers.parseEther("2.0"); // 2 ETH
  const INVESTOR_SHARE_BPS = 3000; // 30%
  const EXPECTED_QUANTITY = 1000; // 1000 kg
  const TOKEN_URI = "ipfs://QmTest123";

  beforeEach(async () => {
    [owner, farmer, investor, oracle, other] = await ethers.getSigners();

    // Deploy CropNFT
    const CropNFTFactory = await ethers.getContractFactory("CropNFT");
    cropNFT = (await CropNFTFactory.deploy(owner.address)) as CropNFT;
    await cropNFT.waitForDeployment();

    // Deploy InvestmentAgreement
    const InvestmentAgreementFactory = await ethers.getContractFactory("InvestmentAgreement");
    investmentAgreement = (await InvestmentAgreementFactory.deploy(
      owner.address,
      oracle.address,
    )) as InvestmentAgreement;
    await investmentAgreement.waitForDeployment();

    // Setup: Mint NFT to farmer
    await cropNFT.connect(farmer).mint(TOKEN_URI);
  });

  describe("Deployment", function () {
    it("Should set the correct owner and oracle", async function () {
      expect(await investmentAgreement.owner()).to.equal(owner.address);
      expect(await investmentAgreement.oracle()).to.equal(oracle.address);
    });

    it("Should initialize agreement counter to 0", async function () {
      expect(await investmentAgreement.agreementCounter()).to.equal(0);
    });
  });

  describe("Agreement Proposal", function () {
    const currentTime = Math.floor(Date.now() / 1000);
    const harvestDeadline = currentTime + 30 * 24 * 60 * 60; // 30 days
    const deliveryDeadline = currentTime + 60 * 24 * 60 * 60; // 60 days

    it("Should allow farmer to propose agreement", async function () {
      // Approve InvestmentAgreement to transfer NFT
      await cropNFT.connect(farmer).approve(await investmentAgreement.getAddress(), 1);

      await expect(
        investmentAgreement
          .connect(farmer)
          .proposeAgreement(
            await cropNFT.getAddress(),
            1,
            INVEST_AMOUNT,
            INVESTOR_SHARE_BPS,
            EXPECTED_QUANTITY,
            harvestDeadline,
            deliveryDeadline,
          ),
      )
        .to.emit(investmentAgreement, "AgreementProposed")
        .withArgs(
          0,
          farmer.address,
          await cropNFT.getAddress(),
          1,
          INVEST_AMOUNT,
          INVESTOR_SHARE_BPS,
          EXPECTED_QUANTITY,
          harvestDeadline,
          deliveryDeadline,
        );

      const agreement = await investmentAgreement.getAgreement(0);
      expect(agreement.farmer).to.equal(farmer.address);
      expect(agreement.investAmount).to.equal(INVEST_AMOUNT);
      expect(agreement.investorShareBps).to.equal(INVESTOR_SHARE_BPS);
      expect(agreement.expectedQuantity).to.equal(EXPECTED_QUANTITY);
      expect(agreement.status).to.equal(0); // Proposed

      // NFT should be transferred to InvestmentAgreement contract
      expect(await cropNFT.ownerOf(1)).to.equal(await investmentAgreement.getAddress());
    });

    it("Should reject proposal with zero investment amount", async function () {
      await cropNFT.connect(farmer).approve(await investmentAgreement.getAddress(), 1);

      await expect(
        investmentAgreement
          .connect(farmer)
          .proposeAgreement(
            await cropNFT.getAddress(),
            1,
            0,
            INVESTOR_SHARE_BPS,
            EXPECTED_QUANTITY,
            harvestDeadline,
            deliveryDeadline,
          ),
      ).to.be.revertedWith("InvestmentAgreement: investment amount must be greater than 0");
    });

    it("Should reject proposal with investor share > 100%", async function () {
      await cropNFT.connect(farmer).approve(await investmentAgreement.getAddress(), 1);

      await expect(
        investmentAgreement.connect(farmer).proposeAgreement(
          await cropNFT.getAddress(),
          1,
          INVEST_AMOUNT,
          10001, // > 100%
          EXPECTED_QUANTITY,
          harvestDeadline,
          deliveryDeadline,
        ),
      ).to.be.revertedWith("InvestmentAgreement: investor share cannot exceed 100%");
    });
  });

  describe("Agreement Funding", function () {
    const currentTime = Math.floor(Date.now() / 1000);
    const harvestDeadline = currentTime + 30 * 24 * 60 * 60; // 30 days
    const deliveryDeadline = currentTime + 60 * 24 * 60 * 60; // 60 days

    beforeEach(async () => {
      // Create an agreement proposal
      await cropNFT.connect(farmer).approve(await investmentAgreement.getAddress(), 1);
      await investmentAgreement
        .connect(farmer)
        .proposeAgreement(
          await cropNFT.getAddress(),
          1,
          INVEST_AMOUNT,
          INVESTOR_SHARE_BPS,
          EXPECTED_QUANTITY,
          harvestDeadline,
          deliveryDeadline,
        );
    });

    it("Should allow investor to fund agreement with DELIVER_PRODUCE option", async function () {
      const farmerBalanceBefore = await ethers.provider.getBalance(farmer.address);

      await expect(
        investmentAgreement.connect(investor).fundAgreement(0, 1, { value: INVEST_AMOUNT }), // 1 = DELIVER_PRODUCE
      )
        .to.emit(investmentAgreement, "AgreementFunded")
        .withArgs(0, investor.address, 1);

      const agreement = await investmentAgreement.getAgreement(0);
      expect(agreement.investor).to.equal(investor.address);
      expect(agreement.option).to.equal(1); // DELIVER_PRODUCE
      expect(agreement.status).to.equal(1); // Funded

      // Farmer should receive ETH
      const farmerBalanceAfter = await ethers.provider.getBalance(farmer.address);
      expect(farmerBalanceAfter).to.equal(farmerBalanceBefore + INVEST_AMOUNT);
    });

    it("Should allow investor to fund agreement with SHARE_PROFITS option", async function () {
      await expect(
        investmentAgreement.connect(investor).fundAgreement(0, 2, { value: INVEST_AMOUNT }), // 2 = SHARE_PROFITS
      )
        .to.emit(investmentAgreement, "AgreementFunded")
        .withArgs(0, investor.address, 2);

      const agreement = await investmentAgreement.getAgreement(0);
      expect(agreement.option).to.equal(2); // SHARE_PROFITS
    });

    it("Should reject funding with incorrect ETH amount", async function () {
      await expect(
        investmentAgreement.connect(investor).fundAgreement(0, 1, { value: INVEST_AMOUNT / 2n }),
      ).to.be.revertedWith("InvestmentAgreement: incorrect ETH amount");
    });

    it("Should reject funding with invalid option", async function () {
      await expect(
        investmentAgreement.connect(investor).fundAgreement(0, 0, { value: INVEST_AMOUNT }), // 0 = UNSET
      ).to.be.revertedWith("InvestmentAgreement: invalid fulfilment option");
    });
  });

  describe("Harvest Management", function () {
    const currentTime = Math.floor(Date.now() / 1000);
    const harvestDeadline = currentTime + 30 * 24 * 60 * 60; // 30 days
    const deliveryDeadline = currentTime + 60 * 24 * 60 * 60; // 60 days

    beforeEach(async () => {
      // Create and fund an agreement
      await cropNFT.connect(farmer).approve(await investmentAgreement.getAddress(), 1);
      await investmentAgreement
        .connect(farmer)
        .proposeAgreement(
          await cropNFT.getAddress(),
          1,
          INVEST_AMOUNT,
          INVESTOR_SHARE_BPS,
          EXPECTED_QUANTITY,
          harvestDeadline,
          deliveryDeadline,
        );
      await investmentAgreement.connect(investor).fundAgreement(0, 1, { value: INVEST_AMOUNT });
    });

    it("Should allow farmer to mark harvest ready", async function () {
      await expect(investmentAgreement.connect(farmer).markHarvestReady(0))
        .to.emit(investmentAgreement, "HarvestMarkedReady")
        .withArgs(0, farmer.address);

      const agreement = await investmentAgreement.getAgreement(0);
      expect(agreement.status).to.equal(2); // ProduceReady
    });

    it("Should reject marking harvest ready by non-farmer", async function () {
      await expect(investmentAgreement.connect(investor).markHarvestReady(0)).to.be.revertedWith(
        "InvestmentAgreement: only farmer can mark harvest ready",
      );
    });
  });

  describe("Oracle Management", function () {
    it("Should allow owner to update oracle", async function () {
      const newOracle = other.address;

      await investmentAgreement.connect(owner).setOracle(newOracle);
      expect(await investmentAgreement.oracle()).to.equal(newOracle);
    });

    it("Should reject oracle update by non-owner", async function () {
      await expect(investmentAgreement.connect(farmer).setOracle(other.address)).to.be.revertedWithCustomError(
        investmentAgreement,
        "OwnableUnauthorizedAccount",
      );
    });

    it("Should reject setting zero address as oracle", async function () {
      await expect(investmentAgreement.connect(owner).setOracle(ethers.ZeroAddress)).to.be.revertedWith(
        "InvestmentAgreement: invalid oracle address",
      );
    });
  });
});
