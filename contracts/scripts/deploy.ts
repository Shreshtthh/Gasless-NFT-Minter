import { ethers } from "hardhat"; // ✅ Works with @nomicfoundation/hardhat-ethers
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import "dotenv/config";

interface NetworkConfig {
  name: string;
  usdcAddress: string;
  chainId: number;
}

// ✅ Correct testnet USDC addresses
const networkConfigs: Record<string, NetworkConfig> = {
  sepolia: {
    name: "Ethereum Sepolia",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia USDC
    chainId: 11155111
  },
  "base-sepolia": {
    name: "Base Sepolia",
    usdcAddress: "0x036CBD53431b2A8bd4CdD9C0Fb533C8E0e2be00f", // Base Sepolia USDC
    chainId: 84532
  },
  amoy: {
    name: "Polygon Amoy",
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Amoy USDC
    chainId: 80002
  }
};

async function main() {

  console.log("🔍 Debug Info:");
  console.log("process.env.NETWORK:", process.env.NETWORK);
 
  console.log("Available networks:", Object.keys(networkConfigs));

  // ✅ Get deployment parameters
  const networkName = process.env.NETWORK || "sepolia";
  const nftName = process.env.NFT_NAME || "Gasless NFT Collection";
  const nftSymbol = process.env.NFT_SYMBOL || "GNFT";
  const maxSupply = BigInt(process.env.MAX_SUPPLY || "10000");
  const mintPrice = BigInt(process.env.MINT_PRICE || "1000000"); // 1 USDC (6 decimals)

   console.log("Resolved networkName:", networkName);

  // ✅ Validate network
  if (!(networkName in networkConfigs)) {
    throw new Error(`Unsupported network: ${networkName}. Available: ${Object.keys(networkConfigs).join(', ')}`);
  }

  const networkConfig = networkConfigs[networkName];

  console.log("🚀 Deploying GaslessNFT contract...");
  console.log(`📋 Network: ${networkConfig.name}`);
  console.log(`📝 NFT Name: ${nftName}`);
  console.log(`🔤 NFT Symbol: ${nftSymbol}`);
  console.log(`📊 Max Supply: ${maxSupply.toString()}`);
  console.log(`💰 Mint Price: ${mintPrice.toString()} USDC`);
  console.log(`🪙 USDC Address: ${networkConfig.usdcAddress}`);

  // ✅ Get deployer and check balance
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();

  console.log(`\n👤 Deployer Info:`);
  console.log(`   Address: ${deployer.address}`);
  console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`   Chain ID: ${network.chainId}`);

  // ✅ Check minimum balance
  const minBalance = ethers.parseEther("0.01");
  if (balance < minBalance) {
    throw new Error(`❌ Insufficient balance. Need at least 0.01 ETH, have ${ethers.formatEther(balance)} ETH`);
  }

  // ✅ Deploy contract
  console.log("\n⏳ Deploying contract...");
  
  const GaslessNFT = await ethers.getContractFactory("GaslessNFT");
  const gaslessNFT = await GaslessNFT.deploy(
    nftName,
    nftSymbol,
    maxSupply,
    mintPrice,
    networkConfig.usdcAddress
  );

  // ✅ Wait for deployment
  console.log("⏳ Waiting for deployment confirmation...");
  await gaslessNFT.waitForDeployment();
  const contractAddress = await gaslessNFT.getAddress();

  console.log(`\n✅ Deployment successful!`);
  console.log(`📄 Contract Address: ${contractAddress}`);
  console.log(`🔍 Transaction Hash: ${gaslessNFT.deploymentTransaction()?.hash}`);

  // ✅ Save deployment info
  const deploymentsDir = join(process.cwd(), "deployments", networkName);
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentInfo = {
    network: networkConfig.name,
    networkKey: networkName,
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    transactionHash: gaslessNFT.deploymentTransaction()?.hash,
    blockNumber: await ethers.provider.getBlockNumber(),
    nftName: nftName,
    nftSymbol: nftSymbol,
    maxSupply: maxSupply.toString(),
    mintPrice: mintPrice.toString(),
    usdcAddress: networkConfig.usdcAddress,
    deployedAt: new Date().toISOString(),
    constructorArgs: [
      nftName,
      nftSymbol,
      maxSupply.toString(),
      mintPrice.toString(),
      networkConfig.usdcAddress
    ]
  };

  const deploymentFilePath = join(deploymentsDir, "GaslessNFT.json");
  writeFileSync(deploymentFilePath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`💾 Deployment info saved to: ${deploymentFilePath}`);

  // ✅ Next steps
  console.log(`\n🔧 Next Steps:`);
  
  console.log(`1. 📋 Contract Verification:`);
  console.log(`   npx hardhat verify --network ${networkName} ${contractAddress} "${nftName}" "${nftSymbol}" "${maxSupply}" "${mintPrice}" "${networkConfig.usdcAddress}"`);
  
  console.log(`\n2. 🔑 Update your backend .env:`);
  const envVarName = networkName === 'sepolia' ? 'NFT_CONTRACT_ADDRESS_ETH_SEPOLIA' : 
                     networkName === 'base-sepolia' ? 'NFT_CONTRACT_ADDRESS_BASE_SEPOLIA' : 
                     networkName === 'amoy' ? 'NFT_CONTRACT_ADDRESS_POLYGON_AMOY' : 
                     `NFT_CONTRACT_ADDRESS_${networkName.toUpperCase()}`;
  console.log(`   ${envVarName}=${contractAddress}`);
  
  console.log(`\n3. 🌐 Explorer Links:`);
  if (networkName === 'sepolia') {
    console.log(`   Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
  } else if (networkName === 'base-sepolia') {
    console.log(`   BaseScan: https://sepolia.basescan.org/address/${contractAddress}`);
  } else if (networkName === 'amoy') {
    console.log(`   PolygonScan: https://amoy.polygonscan.com/address/${contractAddress}`);
  }

  return contractAddress;
}

// ✅ Export function for custom deployments
export async function deployWithParams(
  name: string,
  symbol: string,
  maxSupply: bigint,
  mintPrice: bigint,
  usdcAddress: string
): Promise<string> {
  console.log(`🔧 Deploying ${name} (${symbol}) with custom parameters...`);
  
  const GaslessNFT = await ethers.getContractFactory("GaslessNFT");
  const gaslessNFT = await GaslessNFT.deploy(name, symbol, maxSupply, mintPrice, usdcAddress);
  
  await gaslessNFT.waitForDeployment();
  const contractAddress = await gaslessNFT.getAddress();
  
  console.log(`✅ Custom deployment successful: ${contractAddress}`);
  return contractAddress;
}

// ✅ Main execution
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🎉 Deployment completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Deployment failed:");
      console.error(error);
      process.exit(1);
    });
}
