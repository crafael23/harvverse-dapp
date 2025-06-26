import { DeployFunction } from "hardhat-deploy/types";

/**
 * This is a placeholder deployment script.
 *
 * The HarvVerse Investment Platform contracts are deployed in the following order:
 * 1. CropNFT (01_deploy_crop_nft.ts) - ERC721 for crop representation
 * 2. MicroLoan (02_deploy_microloan.ts) - Legacy loan contract (for migration support)
 * 3. InvestmentAgreement (03_deploy_investment_agreement.ts) - New investment system
 *
 * To deploy all contracts: yarn deploy
 * To deploy specific contracts: yarn deploy --tags [ContractName]
 */
const deployPlaceholder: DeployFunction = async function () {
  console.log("📋 HarvVerse Investment Platform Deployment Info:");
  console.log("   Run 'yarn deploy' to deploy all contracts");
  console.log("   Deployment order: CropNFT → MicroLoan → InvestmentAgreement");
  console.log("   Note: InvestmentAgreement is the new system, MicroLoan kept for migration");

  // Skip this placeholder during actual deployment
  return true;
};

export default deployPlaceholder;

// Skip this during deployment
deployPlaceholder.skip = async () => true;
deployPlaceholder.tags = ["Placeholder"];
