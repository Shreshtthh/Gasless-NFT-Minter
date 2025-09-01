// Base types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Network types
export type SupportedNetwork = 'BASE-SEPOLIA' | 'MATIC-MUMBAI' | 'ETH-SEPOLIA';

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl?: string;
  explorerUrl: string;
  usdcAddress: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Circle Wallet types
export interface CircleWalletCreateRequest {
  userId: string;
  email: string;
}

export interface CircleWalletResponse {
  walletId: string;
  address: string;
  blockchains: string[];
  state: 'LIVE' | 'FROZEN';
  createDate: string;
  updateDate: string;
}

export interface CircleWalletBalance {
  success: boolean;
  balance: string;
  formattedBalance: string;
  blockchain: string;
  lastUpdated: string;
}

// Transaction types
export interface TransactionParams {
  walletId: string;
  contractAddress: string;
  functionSignature: string;
  encodedParameters: any[];
  blockchain?: SupportedNetwork;
  value?: string;
}

export interface TransactionResponse {
  success: boolean;
  transactionId: string;
  state: 'INITIATED' | 'PENDING_RISK_SCREENING' | 'DENIED' | 'QUEUED' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  txHash?: string;
  blockHash?: string;
  blockHeight?: number;
  gasUsed?: string;
  gasPrice?: string;
  data?: any;
}

export interface GasEstimate {
  success: boolean;
  gasLimit: string;
  gasPrice: string;
  estimatedCost: string;
  blockchain: string;
  error?: string;
}

// NFT types
export interface NFTMintRequest {
  walletId: string;
  recipientAddress: string;
  tokenURI: string;
  metadata?: Record<string, any>;
  network?: SupportedNetwork;
}

export interface NFTBatchMintRequest {
  walletId: string;
  mintRequests: Array<{
    recipientAddress: string;
    tokenURI: string;
    metadata?: Record<string, any>;
  }>;
  network?: SupportedNetwork;
}

export interface NFTMintResult {
  success: boolean;
  tokenId?: string;
  tokenIds?: string[];
  transactionHash: string;
  blockHash?: string;
  blockHeight?: number;
  gasUsed?: string;
  gasSaved?: string;
  network: SupportedNetwork;
  timestamp: string;
  mintedCount?: number;
}

export interface NFTDetails {
  success: boolean;
  tokenId: string;
  owner: string;
  tokenURI: string;
  metadata?: Record<string, any>;
  network: SupportedNetwork;
  contractAddress: string;
  timestamp: string;
}

export interface NFTStats {
  success: boolean;
  contractName: string;
  contractSymbol: string;
  totalMinted: string;
  remainingSupply: string;
  maxSupply: string;
  currentPrice: string;
  priceInUSDC: string;
  network: SupportedNetwork;
  contractAddress: string;
  timestamp: string;
}

export interface UserNFTs {
  success: boolean;
  userAddress: string;
  balance: string;
  mintCount: string;
  nfts: Array<{
    tokenId: string;
    tokenURI: string;
    owner: string;
    metadata?: Record<string, any>;
    error?: string;
  }>;
  network: SupportedNetwork;
  timestamp: string;
}

// Authentication types
export interface AuthChallenge {
  challengeId: string;
  message: string;
  walletId: string;
  expiresAt: string;
}

export interface AuthVerification {
  challengeId: string;
  signature: string;
}

export interface AuthResult {
  success: boolean;
  verified: boolean;
  status: 'VERIFIED' | 'FAILED' | 'EXPIRED';
  timestamp: string;
}

// User context types
export interface UserContext {
  userId?: string;
  walletId?: string;
  sessionId?: string;
  ip: string;
  userAgent?: string;
}

// Request extension types
declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
      logger?: any;
    }
  }
}

// Error types
export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

export class ValidationError extends Error {
  public status = 400;
  public code = 'VALIDATION_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  public status = 404;
  public code = 'NOT_FOUND';
  
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class CircleApiError extends Error {
  public status = 500;
  public code = 'CIRCLE_API_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'CircleApiError';
  }
}

export class BlockchainError extends Error {
  public status = 500;
  public code = 'BLOCKCHAIN_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'BlockchainError';
  }
}

// Gas Station types
export interface GasStationInfo {
  success: boolean;
  balance?: string;
  supportedNetworks?: string[];
  transactionsCount?: number;
  totalGasSponsored?: string;
}

// Contract interaction types
export interface ContractCall {
  contractAddress: string;
  functionName: string;
  parameters: any[];
  value?: string;
}

// Mint cost estimation types
export interface MintCostEstimate {
  network: SupportedNetwork;
  batchSize: number;
  estimates: {
    singleMint: {
      gasLimit: string;
      gasPrice: string;
      costInEth: string;
      costInUsd: string;
    };
    batchMint?: {
      gasLimit: string;
      gasPrice: string;
      totalCostInEth: string;
      costPerNFTInEth: string;
      totalCostInUsd: string;
      costPerNFTInUsd: string;
    };
  };
  savings: {
    gaslessUser: {
      costInEth: string;
      costInUsd: string;
      savedInEth: string;
      savedInUsd: string;
    };
    batchEfficiency?: {
      savingsPerNFTInEth: string;
      savingsPerNFTInUsd: string;
      totalBatchSavingsInEth: string;
      totalBatchSavingsInUsd: string;
    };
  };
  disclaimer: string;
  timestamp: string;
}

// Configuration types
export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logLevel: string;
}

export interface CircleConfig {
  apiKey: string;
  entitySecret: string;
  baseUrl: string;
  gasStationApiKey?: string;
  gasStationBaseUrl?: string;
  environment: 'sandbox' | 'production';
}

export interface BlockchainConfig {
  networks: Record<SupportedNetwork, NetworkConfig>;
  nftContractAddress: string;
  privateKey: string;
  backendWalletAddress: string;
}

// Logging types
export interface LogContext {
  userId?: string;
  walletId?: string;
  sessionId?: string;
  ip?: string;
  method?: string;
  url?: string;
  duration?: string;
  statusCode?: number;
}

// Validation schema types
export interface ValidationSchema {
  [key: string]: any;
}

// Webhook types
export interface CircleWebhookEvent {
  type: string;
  data: any;
  timestamp: string;
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}