import hre from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const networkName = hre.network.name;
  console.log(`Verifying contracts on ${networkName}...`);

  // Read deployment info
  const deploymentPath = join(process.cwd(), "deployments", networkName, "GaslessNFT.json");
  
  try {
    const deploymentData = JSON.parse(readFileSync(deploymentPath, "utf-8"));
    
    console.log("Contract Address:", deploymentData.contractAddress);
    console.log("Constructor Args:", deploymentData.constructorArgs);

    await hre.run("verify:verify", {
      address: deploymentData.contractAddress,
      constructorArguments: deploymentData.constructorArgs,
    });

    console.log("Verification completed successfully!");
    
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract already verified!");
    } else {
      console.error("Verification failed:", error);
      throw error;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
