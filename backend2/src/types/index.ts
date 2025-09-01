import { Request } from 'express';

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Supported blockchain types (centralized definition)
export type SupportedBlockchain = 'ETH' | 'MATIC' | 'BASE' | 'BASE-SEPOLIA' | 'MATIC-AMOY' | 'ETH-SEPOLIA';

// User entity
export interface User {
  id: string;
  email: string;
  walletId?: string;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Circle wallet
export interface CircleWallet {
  id: string;
  state: 'LIVE' | 'FROZEN';
  walletSetId: string;
  custodyType: 'DEVELOPER' | 'ENDUSER';
  userId?: string;
  address: string;
  blockchain: SupportedBlockchain; // ✅ Fixed: Use consistent type
  accountType: 'SCA' | 'EOA';
  updateDate: string;
  createDate: string;
}

export interface CircleWalletResponse {
  data: {
    wallets: CircleWallet[];
  };
}

// Wallet creation
export interface CreateWalletRequest {
  idempotencyKey: string;
  entitySecretCiphertext: string;
  blockchains: SupportedBlockchain[]; // ✅ Fixed: Use consistent type
  accountType: 'SCA' | 'EOA';
  walletSetId: string;
}

export interface CreateWalletResponse {
  data: {
    wallets: CircleWallet[];
  };
}

// Gas station
export interface GasStationRequest {
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: any[];
  amount?: string;
  feeLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  gasLimit?: string;
  gasPrice?: string;
  nonce?: number;
}

export interface GasStationResponse {
  data: {
    transactionId: string;
    transactionHash: string;
    state: 'INITIATED' | 'SENT' | 'CONFIRMED' | 'FAILED';
    gasUsed?: string;
    gasPrice?: string;
    feeAmount?: string;
  };
}

// NFT metadata
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
}

// ✅ Fixed: Single MintNFTRequest declaration with correct type
export interface MintNFTRequest {
  email: string;
  nftMetadata: NFTMetadata;
  blockchain: SupportedBlockchain; // ✅ Fixed: Use extended type
  payWithUSDC?: boolean;
}

export interface MintNFTResponse {
  transactionHash: string;
  nftId: string;
  contractAddress: string;
  walletAddress: string;
  blockchain: string;
  gasSponsored: boolean;
}

// Blockchain configuration
export interface BlockchainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  nftContractAddress: string;
  usdcContractAddress: string;
  circleBlockchain: SupportedBlockchain; // ✅ Fixed: Added semicolon and consistent type
}

// Wallet balances
export interface TokenBalance {
  token: string;
  amount: string;
}

export interface WalletBalance {
  walletId: string;
  address: string;
  blockchain: string;
  balances: TokenBalance[];
}

// Transaction
export interface Transaction {
  id: string;
  hash: string;
  state: 'INITIATED' | 'SENT' | 'CONFIRMED' | 'FAILED';
  blockchain: string;
  tokenId?: string;
  amounts: string[];
  nfts?: Array<{
    id: string;
    blockchain: string;
  }>;
  sourceAddress: string;
  destinationAddress?: string;
  transactionType: 'INBOUND' | 'OUTBOUND';
  createDate: string;
  updateDate: string;
}

// Circle error
export interface CircleError {
  code: number;
  message: string;
}

// ✅ Fixed: Added missing import and proper typing
export interface AuthRequest extends Request {
  user?: User;
}

// Supported chains
export enum SupportedChains {
  BASE_SEPOLIA = 84532,
  POLYGON_MUMBAI = 80001,
}

// Chain configuration mapping
export interface ChainConfig {
  [key: string]: BlockchainConfig;
}
