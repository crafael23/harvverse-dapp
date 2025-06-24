import { DeployFunction } from "hardhat-deploy/types";

/**
 * This is a placeholder deployment script.
 *
 * The Microloans MVP contracts are deployed in the following order:
 * 1. MockUSDT (03_deploy_mock_usdt.ts) - Test stablecoin
 * 2. CropNFT (01_deploy_crop_nft.ts) - ERC721 for crop representation
 * 3. MicroLoan (02_deploy_microloan.ts) - Main loan contract
 *
 * To deploy all contracts: yarn deploy
 * To deploy specific contracts: yarn deploy --tags [ContractName]
 */
const deployPlaceholder: DeployFunction = async function () {
  console.log("📋 Microloans MVP Deployment Info:");
  console.log("   Run 'yarn deploy' to deploy all contracts");
  console.log("   Deployment order: MockUSDT → CropNFT → MicroLoan");

  // Skip this placeholder during actual deployment
  return true;
};

export default deployPlaceholder;

// Skip this during deployment
deployPlaceholder.skip = async () => true;
deployPlaceholder.tags = ["Placeholder"];
