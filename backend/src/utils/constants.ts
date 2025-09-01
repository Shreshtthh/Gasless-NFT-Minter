import { SupportedNetwork, NetworkConfig, RateLimitConfig } from '../types';

// Supported blockchain networks
export const SUPPORTED_NETWORKS: Record<string, SupportedNetwork> = {
  BASE_SEPOLIA: 'BASE-SEPOLIA',
  POLYGON_MUMBAI: 'MATIC-MUMBAI',
  ETHEREUM_SEPOLIA: 'ETH-SEPOLIA',
} as const;

// Network configurations
export const NETWORK_CONFIGS: Record<SupportedNetwork, NetworkConfig> = {
  [SUPPORTED_NETWORKS.BASE_SEPOLIA]: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
    explorerUrl: 'https://sepolia.basescan.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  [SUPPORTED_NETWORKS.POLYGON_MUMBAI]: {
    name: 'Polygon Mumbai',
    chainId: 80001,
    rpcUrl: process.env.POLYGON_MUMBAI_RPC_URL,
    explorerUrl: 'https://mumbai.polygonscan.com',
    usdcAddress: '0x9999f7fea5938fd3b1e26a12c3f2fb024e194f97',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  [SUPPORTED_NETWORKS.ETHEREUM_SEPOLIA]: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL,
    explorerUrl: 'https://sepolia.etherscan.io',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

// Circle API endpoints
export const CIRCLE_ENDPOINTS = {
  WALLETS: '/v1/w3s/wallets',
  TRANSACTIONS: '/v1/w3s/developer/transactions/contractExecution',
  TRANSACTION_STATUS: '/v1/w3s/transactions',
  CHALLENGES: '/v1/w3s/user/challenges',
  CONFIG: '/v1/w3s/config/entity',
  BALANCES: '/v1/w3s/wallets/{walletId}/balances',
  ESTIMATE: '/v1/w3s/transactions/estimate',
} as const;

// Gas Station endpoints
export const GAS_STATION_ENDPOINTS = {
  INFO: '/v1/info',
  TRANSACTIONS: '/v1/transactions',
} as const;

// NFT Contract configurations
export const NFT_CONTRACT_CONFIG = {
  maxSupply: 10000,
  mintPrice: 1000000, // 1 USDC (6 decimals)
  maxBatchSize: 10,
  baseTokenURI: 'https://api.gaslessnft.com/metadata/',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  VALIDATION_FAILED: 'Validation failed',
  WALLET_NOT_FOUND: 'Wallet not found',
  NFT_NOT_FOUND: 'NFT not found',
  INSUFFICIENT_SUPPLY: 'Insufficient NFT supply',
  NETWORK_NOT_SUPPORTED: 'Network not supported',
  TRANSACTION_FAILED: 'Transaction failed',
  UNAUTHORIZED_ACCESS: 'Unauthorized access',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  INTERNAL_ERROR: 'Internal server error',
  INVALID_ADDRESS: 'Invalid Ethereum address',
  INVALID_TOKEN_URI: 'Invalid token URI',
  CIRCLE_API_ERROR: 'Circle API error',
  GAS_STATION_ERROR: 'Gas Station error',
  BLOCKCHAIN_ERROR: 'Blockchain interaction error',
  MAX_SUPPLY_EXCEEDED: 'Maximum supply exceeded',
  UNAUTHORIZED_MINTER: 'Unauthorized minter',
  INVALID_PARAMETERS: 'Invalid parameters',
  MISSING_WALLET_ID: 'Missing walletId parameter',
  MISSING_API_KEY: 'Missing API key',
  INVALID_API_KEY: 'Invalid API key',
  EXPIRED_TOKEN: 'Token has expired',
  INVALID_SIGNATURE: 'Invalid signature',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  WALLET_CREATED: 'Wallet created successfully',
  NFT_MINTED: 'NFT minted successfully',
  BATCH_MINTED: 'Batch mint completed successfully',
  CHALLENGE_CREATED: 'Authentication challenge created',
  CHALLENGE_VERIFIED: 'Challenge verified successfully',
  TRANSACTION_CONFIRMED: 'Transaction confirmed',
  BALANCE_RETRIEVED: 'Balance retrieved successfully',
  NFTS_RETRIEVED: 'NFTs retrieved successfully',
  STATS_RETRIEVED: 'Statistics retrieved successfully',
} as const;

// Rate limiting configurations
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
  },
  EXPENSIVE: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // requests per window
  },
  MINTING: {
    windowMs: 60 * 1000, // 1 minute
    max: 3, // mints per minute
  },
  WALLET_CREATION: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3, // wallets per 5 minutes
  },
};

// Gas limits for different operations
export const GAS_LIMITS = {
  NFT_MINT: '500000',
  NFT_BATCH_MINT: '2000000',
  USDC_TRANSFER: '100000',
  USDC_APPROVE: '80000',
} as const;

// Default timeouts
export const TIMEOUTS = {
  TRANSACTION_CONFIRMATION: 120000, // 2 minutes
  API_REQUEST: 30000, // 30 seconds
  METADATA_FETCH: 5000, // 5 seconds
  POLLING_INTERVAL: 3000, // 3 seconds
} as const;

// Validation constraints
export const VALIDATION_CONSTRAINTS = {
  MAX_BATCH_SIZE: 10,
  MIN_BATCH_SIZE: 1,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_METADATA_SIZE: 1024 * 1024, // 1MB
  MAX_TOKEN_URI_LENGTH: 2048,
  MAX_EMAIL_LENGTH: 254,
  MAX_USER_ID_LENGTH: 128,
  MIN_PASSWORD_LENGTH: 8,
} as const;

// Contract function signatures
export const CONTRACT_FUNCTIONS = {
  MINT: 'mint(address,string)',
  BATCH_MINT: 'batchMint(address[],string[])',
  SET_AUTHORIZED_MINTER: 'setAuthorizedMinter(address,bool)',
  SET_BASE_URI: 'setBaseURI(string)',
  SET_MINT_PRICE: 'setMintPrice(uint256)',
  GET_STATS: 'getStats()',
  GET_USER_TOKENS: 'getUserTokens(address)',
  GET_REMAINING_SUPPLY: 'getRemainingSupply()',
} as const;

// Event signatures
export const CONTRACT_EVENTS = {
  NFT_MINTED: 'NFTMinted(address,uint256,string,uint256)',
  BATCH_MINTED: 'BatchMinted(address,uint256[],uint256)',
  AUTHORIZED_MINTER_UPDATED: 'AuthorizedMinterUpdated(address,bool)',
  BASE_URI_UPDATED: 'BaseURIUpdated(string)',
  MINT_PRICE_UPDATED: 'MintPriceUpdated(uint256)',
} as const;

// OpenSea and marketplace URLs
export const MARKETPLACE_URLS = {
  OPENSEA_TESTNET: 'https://testnets.opensea.io',
  OPENSEA_MAINNET: 'https://opensea.io',
} as const;

// Explorer URLs
export const EXPLORER_URLS: Record<SupportedNetwork, string> = {
  [SUPPORTED_NETWORKS.BASE_SEPOLIA]: 'https://sepolia.basescan.org',
  [SUPPORTED_NETWORKS.POLYGON_MUMBAI]: 'https://mumbai.polygonscan.com',
  [SUPPORTED_NETWORKS.ETHEREUM_SEPOLIA]: 'https://sepolia.etherscan.io',
};

// Default configuration values
export const DEFAULT_CONFIG = {
  PORT: 3001,
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  JWT_EXPIRY: '24h',
  CORS_ORIGINS: ['http://localhost:3000'],
  MAX_REQUEST_SIZE: '10mb',
  UPLOAD_PATH: 'uploads/',
} as const;

// Circle transaction states
export const CIRCLE_TRANSACTION_STATES = {
  INITIATED: 'INITIATED',
  PENDING_RISK_SCREENING: 'PENDING_RISK_SCREENING',
  DENIED: 'DENIED',
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// Webhook event types
export const WEBHOOK_EVENTS = {
  TRANSACTION_CONFIRMED: 'transaction.confirmed',
  TRANSACTION_FAILED: 'transaction.failed',
  WALLET_CREATED: 'wallet.created',
  CHALLENGE_CREATED: 'challenge.created',
  CHALLENGE_VERIFIED: 'challenge.verified',
} as const;

// Cache durations (in seconds)
export const CACHE_DURATIONS = {
  WALLET_BALANCE: 60, // 1 minute
  NFT_STATS: 300, // 5 minutes
  GAS_ESTIMATE: 30, // 30 seconds
  NETWORK_CONFIG: 3600, // 1 hour
} as const;

// File upload configurations
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/json',
  ],
  UPLOAD_PATH: 'uploads/',
} as const;