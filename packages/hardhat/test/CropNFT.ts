import { expect } from "chai";
import { ethers } from "hardhat";
import { CropNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CropNFT", function () {
  let cropNFT: CropNFT;
  let owner: SignerWithAddress;
  let farmer: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async () => {
    [owner, farmer, other] = await ethers.getSigners();

    const CropNFTFactory = await ethers.getContractFactory("CropNFT");
    cropNFT = (await CropNFTFactory.deploy(owner.address)) as CropNFT;
    await cropNFT.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await cropNFT.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      expect(await cropNFT.name()).to.equal("CropNFT");
      expect(await cropNFT.symbol()).to.equal("CROP");
    });
  });

  describe("Minting", function () {
    const tokenURI = "ipfs://QmTest123";

    it("Should allow owner to mint NFT", async function () {
      await expect(cropNFT.mint(tokenURI)).to.emit(cropNFT, "CropNFTMinted").withArgs(1, owner.address, tokenURI);

      expect(await cropNFT.ownerOf(1)).to.equal(owner.address);
      expect(await cropNFT.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should allow any user to mint NFT", async function () {
      await expect(cropNFT.connect(farmer).mint(tokenURI))
        .to.emit(cropNFT, "CropNFTMinted")
        .withArgs(1, farmer.address, tokenURI);

      expect(await cropNFT.ownerOf(1)).to.equal(farmer.address);
      expect(await cropNFT.tokenURI(1)).to.equal(tokenURI);
    });

    it("Should increment token ID correctly", async function () {
      await cropNFT.mint("ipfs://1");
      await cropNFT.connect(farmer).mint("ipfs://2");
      await cropNFT.connect(other).mint("ipfs://3");

      expect(await cropNFT.ownerOf(1)).to.equal(owner.address);
      expect(await cropNFT.ownerOf(2)).to.equal(farmer.address);
      expect(await cropNFT.ownerOf(3)).to.equal(other.address);

      expect(await cropNFT.tokenURI(1)).to.equal("ipfs://1");
      expect(await cropNFT.tokenURI(2)).to.equal("ipfs://2");
      expect(await cropNFT.tokenURI(3)).to.equal("ipfs://3");
    });

    it("Should make token URI immutable", async function () {
      await cropNFT.mint(tokenURI);

      // Try to access _setTokenURI (which doesn't exist)
      // Token URI should remain unchanged
      expect(await cropNFT.tokenURI(1)).to.equal(tokenURI);
    });
  });

  describe("Burning", function () {
    const tokenURI = "ipfs://QmTest123";

    beforeEach(async () => {
      await cropNFT.connect(farmer).mint(tokenURI);
    });

    it("Should allow token owner to burn", async function () {
      await expect(cropNFT.connect(farmer).burn(1)).to.emit(cropNFT, "CropNFTBurned").withArgs(1, farmer.address);

      // Token should no longer exist
      await expect(cropNFT.ownerOf(1)).to.be.revertedWithCustomError(cropNFT, "ERC721NonexistentToken").withArgs(1);
    });

    it("Should not allow non-owner to burn", async function () {
      await expect(cropNFT.connect(other).burn(1)).to.be.revertedWith("CropNFT: caller is not the owner");
    });

    it("Should not allow burning non-existent token", async function () {
      await expect(cropNFT.burn(999)).to.be.revertedWith("CropNFT: caller is not the owner");
    });

    it("Should clear token data after burning", async function () {
      await cropNFT.connect(farmer).burn(1);

      // Token URI should revert for burned token
      await expect(cropNFT.tokenURI(1)).to.be.revertedWithCustomError(cropNFT, "ERC721NonexistentToken").withArgs(1);
    });
  });

  describe("Transfers", function () {
    const tokenURI = "ipfs://QmTest123";

    beforeEach(async () => {
      await cropNFT.connect(farmer).mint(tokenURI);
    });

    it("Should allow owner to transfer", async function () {
      await cropNFT.connect(farmer).transferFrom(farmer.address, owner.address, 1);
      expect(await cropNFT.ownerOf(1)).to.equal(owner.address);
    });

    it("Should allow approved address to transfer", async function () {
      await cropNFT.connect(farmer).approve(owner.address, 1);
      await cropNFT.connect(owner).transferFrom(farmer.address, owner.address, 1);
      expect(await cropNFT.ownerOf(1)).to.equal(owner.address);
    });

    it("Should not allow unauthorized transfer", async function () {
      await expect(cropNFT.connect(other).transferFrom(farmer.address, owner.address, 1))
        .to.be.revertedWithCustomError(cropNFT, "ERC721InsufficientApproval")
        .withArgs(other.address, 1);
    });
  });
});
