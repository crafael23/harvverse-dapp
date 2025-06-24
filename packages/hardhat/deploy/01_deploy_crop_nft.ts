import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the CropNFT contract
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployCropNFT: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n🌾 Deploying CropNFT...");

  await deploy("CropNFT", {
    from: deployer,
    // Pass deployer as the initial owner
    args: [deployer],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const cropNFT = await hre.ethers.getContract<Contract>("CropNFT", deployer);
  console.log("✅ CropNFT deployed at:", await cropNFT.getAddress());
  console.log("   Owner:", deployer);
};

export default deployCropNFT;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags CropNFT
deployCropNFT.tags = ["CropNFT"];
