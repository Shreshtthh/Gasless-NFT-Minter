import dotenv from 'dotenv';
import { BlockchainConfig, ChainConfig } from '../types';

dotenv.config();

const requiredEnvVars = [
  'CIRCLE_API_KEY',
  'CIRCLE_ENTITY_SECRET',
  'CIRCLE_WALLET_SET_ID',
  'CIRCLE_GAS_STATION_API_KEY',
  'JWT_SECRET',
  'NFT_CONTRACT_ADDRESS_BASE',
  'NFT_CONTRACT_ADDRESS_POLYGON',
];

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
} 

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Circle Configuration
  circle: {
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    walletSetId: process.env.CIRCLE_WALLET_SET_ID!,
    gasStationApiKey: process.env.CIRCLE_GAS_STATION_API_KEY!,
    baseUrl: process.env.NODE_ENV === 'production' 
      ? process.env.CIRCLE_BASE_URL || 'https://api.circle.com'
      : process.env.CIRCLE_SANDBOX_URL || 'https://api-sandbox.circle.com',
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: '24h' as const,
  },
  
  // Blockchain Configuration
  blockchains: {
    base: {
      name: 'Base Sepolia',
      chainId: 84532,
      rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
      nftContractAddress: process.env.NFT_CONTRACT_ADDRESS_BASE!,
      usdcContractAddress: process.env.USDC_CONTRACT_BASE || '0x036CbD53431B2A8Bd4CDD9c0Fb533C8e0e2be00F',
      circleBlockchain: 'BASE-SEPOLIA' as const,
    },
    polygon: {
      name: 'Polygon Amoy',
      chainId: 80002,
      rpcUrl: process.env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology/',
      nftContractAddress: process.env.NFT_CONTRACT_ADDRESS_POLYGON!,
      usdcContractAddress: process.env.USDC_CONTRACT_POLYGON || '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      circleBlockchain: 'MATIC-AMOY' as const,
    },
  } as ChainConfig,
  
  // IPFS Configuration (for NFT metadata storage)
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

// Validate required environment variables


export default config;



