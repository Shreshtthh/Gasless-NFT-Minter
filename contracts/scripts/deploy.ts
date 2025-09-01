import { ethers } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import "dotenv/config";

interface NetworkConfig {
  name: string;
  usdcAddress: string;
  chainId: number;
}

// Network-specific USDC addresses (CORRECTED)
const networkConfigs: Record<string, NetworkConfig> = {
  "basesepolia": {
    name: "Base Sepolia",
    usdcAddress: "0x036cbd53431b2a8bd4cdd9c0fb533c8e0e2be00f", // Fixed to match config
    chainId: 84532
  },
  "amoy": { // Changed from polygonmumbai
    name: "Polygon Amoy", // Updated name
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Amoy USDC address
    chainId: 80002 // Updated chain ID
  },
  "sepolia": {
    name: "Ethereum Sepolia",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", 
    chainId: 11155111
  }
};

async function main() {
  // Get deployment parameters from environment or use defaults
  const networkName = process.env.NETWORK || "basesepolia";
  const nftName = process.env.NFT_NAME || "Gasless NFT Collection";
  const nftSymbol = process.env.NFT_SYMBOL || "GNFT";
  const maxSupply = BigInt(process.env.MAX_SUPPLY || "10000");
  const mintPrice = BigInt(process.env.MINT_PRICE || "1000000"); // 1 USDC (6 decimals)
  
  const networkConfig = networkConfigs[networkName];
  if (!networkConfig) {
    throw new Error(`Unsupported network: ${networkName}. Available networks: ${Object.keys(networkConfigs).join(', ')}`);
  }

  console.log("Deploying GaslessNFT contract...");
  console.log("Network:", networkConfig.name);
  console.log("NFT Name:", nftName);
  console.log("NFT Symbol:", nftSymbol);
  console.log("Max Supply:", maxSupply.toString());
  console.log("Mint Price:", mintPrice.toString(), "USDC");
  console.log("USDC Token Address:", networkConfig.usdcAddress);

  // Get deployment account
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
  console.log("Chain ID:", network.chainId);

  // Deploy the GaslessNFT contract
  const GaslessNFT = await ethers.getContractFactory("GaslessNFT");
  const gaslessNFT = await GaslessNFT.deploy(
    nftName,
    nftSymbol,
    maxSupply,
    mintPrice,
    networkConfig.usdcAddress
  );

  await gaslessNFT.waitForDeployment();
  const contractAddress = await gaslessNFT.getAddress();

  // Set up initial configuration
  console.log("Setting up initial configuration...");
  const setBaseURITx = await gaslessNFT.setBaseURI("https://api.gaslessnft.com/metadata/");
  await setBaseURITx.wait();

  console.log("\n=== Deployment Successful ===");
  console.log("GaslessNFT Contract Address:", contractAddress);
  console.log("Contract Owner:", await gaslessNFT.owner());
  console.log("Current Token ID:", (await gaslessNFT.getCurrentTokenId()).toString());
  console.log("Remaining Supply:", (await gaslessNFT.getRemainingSupply()).toString());

  // Create deployments directory
  const deploymentsDir = join(process.cwd(), "deployments", networkName);
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to file
  const deploymentInfo = {
    network: networkConfig.name,
    networkKey: networkName,
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    nftName: nftName,
    nftSymbol: nftSymbol,
    maxSupply: maxSupply.toString(),
    mintPrice: mintPrice.toString(),
    usdcToken: networkConfig.usdcAddress,
    chainId: network.chainId.toString(),
    deploymentBlock: (await ethers.provider.getBlockNumber()).toString(),
    timestamp: new Date().toISOString(),
    constructorArgs: [nftName, nftSymbol, maxSupply.toString(), mintPrice.toString(), networkConfig.usdcAddress]
  };

  const deploymentFilePath = join(deploymentsDir, "GaslessNFT.json");
  writeFileSync(deploymentFilePath, JSON.stringify(deploymentInfo, null, 2));

  console.log("Deployment info saved to:", deploymentFilePath);

  // Verification instructions
  console.log("\n=== Next Steps ===");
  console.log("1. Verify the contract on block explorer:");
  console.log(`   npx hardhat verify --network ${networkName} ${contractAddress} "${nftName}" "${nftSymbol}" ${maxSupply} ${mintPrice} "${networkConfig.usdcAddress}"`);
  console.log("\n2. Update your backend .env file with:");
  const envVarName = networkName === 'basesepolia' ? 'NFT_CONTRACT_ADDRESS_BASE' : 
                     networkName === 'amoy' ? 'NFT_CONTRACT_ADDRESS_POLYGON' : 
                     'NFT_CONTRACT_ADDRESS';
  console.log(`   ${envVarName}=${contractAddress}`);
  console.log("\n3. Authorize your backend wallet as a minter:");
  console.log("   Call setAuthorizedMinter(BACKEND_WALLET_ADDRESS, true)");

  return contractAddress;
}

// Rest of your export function stays the same...
export async function deployWithParams(
  name: string,
  symbol: string,
  maxSupply: bigint,
  mintPrice: bigint,
  usdcToken: string
): Promise<string> {
  const [deployer] = await ethers.getSigners();
  
  console.log(`Deploying ${name} (${symbol}) with custom parameters...`);
  
  const GaslessNFT = await ethers.getContractFactory("GaslessNFT");
  const gaslessNFT = await GaslessNFT.deploy(name, symbol, maxSupply, mintPrice, usdcToken);
  
  await gaslessNFT.waitForDeployment();
  const contractAddress = await gaslessNFT.getAddress();
  
  // Set up initial configuration
  const setBaseURITx = await gaslessNFT.setBaseURI("https://api.gaslessnft.com/metadata/");
  await setBaseURITx.wait();
  
  console.log("Custom deployment successful:", contractAddress);
  return contractAddress;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}
