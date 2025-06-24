import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the MicroLoan contract (now using ETH instead of USDT)
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployMicroLoan: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("MicroLoan", {
    from: deployer,
    // MicroLoan doesn't have a constructor, so no args needed
    log: true,
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const microLoan = await hre.ethers.getContract<Contract>("MicroLoan", deployer);
  console.log("💰 MicroLoan deployed at:", await microLoan.getAddress());
  console.log("   Using ETH for loans (no external token needed)");
};

export default deployMicroLoan;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags MicroLoan
deployMicroLoan.tags = ["MicroLoan"];
// Deploy after CropNFT (since loans need NFT collateral)
deployMicroLoan.dependencies = ["CropNFT"];
