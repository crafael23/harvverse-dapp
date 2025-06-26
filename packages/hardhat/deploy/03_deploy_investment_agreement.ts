import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the InvestmentAgreement contract
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployInvestmentAgreement: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n🤝 Deploying InvestmentAgreement...");

  await deploy("InvestmentAgreement", {
    from: deployer,
    // Pass deployer as both owner and initial oracle
    args: [deployer, deployer],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const investmentAgreement = await hre.ethers.getContract<Contract>("InvestmentAgreement", deployer);
  console.log("✅ InvestmentAgreement deployed at:", await investmentAgreement.getAddress());
  console.log("   Owner:", deployer);
  console.log("   Oracle:", deployer);
  console.log("   Note: Oracle can be updated later via setOracle() function");
};

export default deployInvestmentAgreement;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags InvestmentAgreement
deployInvestmentAgreement.tags = ["InvestmentAgreement"];
// Deploy after CropNFT (since agreements need NFT collateral)
deployInvestmentAgreement.dependencies = ["CropNFT"];
