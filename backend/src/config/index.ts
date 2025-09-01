import dotenv from 'dotenv';
import { BlockchainConfig, ChainConfig } from '../types';

dotenv.config();

const requiredEnvVars = [
  'CIRCLE_API_KEY',
  'CIRCLE_ENTITY_SECRET',
  'CIRCLE_WALLET_SET_ID',
  'JWT_SECRET',
  'NFT_CONTRACT_ADDRESS_ETH_SEPOLIA', // Updated for correct testnet
];

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
  console.warn('Some features may not work properly without these variables.');
}

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Circle Configuration - Single API key for everything
  circle: {
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    walletSetId: process.env.CIRCLE_WALLET_SET_ID!,
    baseUrl: process.env.NODE_ENV === 'production' 
      ? process.env.CIRCLE_BASE_URL || 'https://api.circle.com'
      : process.env.CIRCLE_SANDBOX_URL || 'https://api-sandbox.circle.com',
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: '24h' as const,
  },
  
  // ✅ FIXED: Updated to ETH-SEPOLIA as per documentation
  blockchains: {
    ethereum: {
      name: 'Ethereum Sepolia',
      chainId: 11155111,
      rpcUrl: process.env.ETH_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
      nftContractAddress: process.env.NFT_CONTRACT_ADDRESS_ETH_SEPOLIA || '0x0000000000000000000000000000000000000000',
      usdcContractAddress: process.env.USDC_CONTRACT_ETH_SEPOLIA || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      circleBlockchain: 'ETH-SEPOLIA' as const,
    },
    // Keep Base as secondary option, but ETH-SEPOLIA is primary for gasless
    base: {
      name: 'Base Sepolia',
      chainId: 84532,
      rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
      nftContractAddress: process.env.NFT_CONTRACT_ADDRESS_BASE || '0x0000000000000000000000000000000000000000',
      usdcContractAddress: process.env.USDC_CONTRACT_BASE || '0x036CbD53431B2A8Bd4CDD9c0Fb533C8e0e2be00F',
      circleBlockchain: 'BASE-SEPOLIA' as const,
    },
  } as ChainConfig,
  
  // IPFS Configuration
  ipfs: {
    gateway: 'https://ipfs.io/ipfs/',
    pinataApiKey: process.env.PINATA_API_KEY,
    pinataSecretKey: process.env.PINATA_SECRET_KEY,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  
  // USDC Configuration
  usdc: {
    metadataStorageCost: '1', // 1 USDC for metadata storage
    decimals: 6, // USDC has 6 decimals
  },
};

export default config;