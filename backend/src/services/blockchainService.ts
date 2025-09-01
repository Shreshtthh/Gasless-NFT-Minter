import { ethers, JsonRpcProvider, Contract } from 'ethers';
import {
  SupportedNetwork,
  NFTMintResult,
  NFTStats,
  NFTDetails,
  UserNFTs,
  BlockchainError,
} from '../types';
import { CircleService } from './circleServices';
import { NETWORK_CONFIGS, CONTRACT_FUNCTIONS, TIMEOUTS } from '../utils/constants';

// ABI for the GaslessNFT contract
const GASLESS_NFT_ABI = [
  'function mint(address to, string memory tokenURI) returns (uint256)',
  'function batchMint(address[] memory recipients, string[] memory tokenURIs) returns (uint256[])',
  'function getCurrentTokenId() view returns (uint256)',
  'function getRemainingSupply() view returns (uint256)',
  'function getStats() view returns (uint256 totalMinted, uint256 remainingSupply, uint256 currentPrice)',
  'function getUserTokens(address user) view returns (uint256[])',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function userMintCount(address user) view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function mintPrice() view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 timestamp)',
  'event BatchMinted(address indexed to, uint256[] tokenIds, uint256 timestamp)',
] as const;

// USDC ABI (minimal)
const USDC_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
] as const;

interface ContractInstances {
  [key: string]: Contract;
}

interface ProviderInstances {
  [key: string]: JsonRpcProvider;
}

export class BlockchainService {
  private providers: ProviderInstances = {};
  private contracts: ContractInstances = {};
  private circleService: CircleService;

  constructor() {
    this.circleService = new CircleService();
    this.initializeProviders();
    this.initializeContracts();
  }

  /**
   * Initialize RPC providers for different networks
   */
  private initializeProviders(): void {
    try {
      Object.entries(NETWORK_CONFIGS).forEach(([network, config]) => {
        if (config.rpcUrl) {
          this.providers[network] = new JsonRpcProvider(config.rpcUrl);
        }
      });

      global.logger?.info('Blockchain providers initialized:', Object.keys(this.providers));
    } catch (error: any) {
      global.logger?.error('Failed to initialize providers:', error);
      throw new BlockchainError(`Provider initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize smart contract instances
   */
  private initializeContracts(): void {
    try {
      const nftContractAddress = process.env.NFT_CONTRACT_ADDRESS;

      if (nftContractAddress) {
        // Initialize NFT contracts for each network
        Object.entries(this.providers).forEach(([network, provider]) => {
          this.contracts[`NFT_${network}`] = new Contract(
            nftContractAddress,
            GASLESS_NFT_ABI,
            provider
          );
        });
      }

      // Initialize USDC contracts
      Object.entries(NETWORK_CONFIGS).forEach(([network, config]) => {
        if (config.usdcAddress && this.providers[network]) {
          this.contracts[`USDC_${network}`] = new Contract(
            config.usdcAddress,
            USDC_ABI,
            this.providers[network]
          );
        }
      });

      global.logger?.info('Smart contracts initialized:', Object.keys(this.contracts));
    } catch (error: any) {
      global.logger?.error('Failed to initialize contracts:', error);
      throw new BlockchainError(`Contract initialization failed: ${error.message}`);
    }
  }

  /**
   * Get provider for a specific network
   */
  public getProvider(network: SupportedNetwork = 'BASE-SEPOLIA'): JsonRpcProvider {
    const provider = this.providers[network];
    if (!provider) {
      throw new BlockchainError(`Provider not available for network: ${network}`);
    }
    return provider;
  }

  /**
   * Get NFT contract for a specific network
   */
  public getNFTContract(network: SupportedNetwork = 'BASE-SEPOLIA'): Contract {
    const contract = this.contracts[`NFT_${network}`];
    if (!contract) {
      throw new BlockchainError(`NFT contract not available for network: ${network}`);
    }
    return contract;
  }

  /**
   * Get USDC contract for a specific network
   */
  public getUSDCContract(network: SupportedNetwork = 'BASE-SEPOLIA'): Contract {
    const contract = this.contracts[`USDC_${network}`];
    if (!contract) {
      throw new BlockchainError(`USDC contract not available for network: ${network}`);
    }
    return contract;
  }

  /**
   * Mint NFT using Circle's gasless transaction
   */
  async mintNFT(params: {
    walletId: string;
    recipientAddress: string;
    tokenURI: string;
    network?: SupportedNetwork;
  }): Promise<NFTMintResult> {
    try {
      const { walletId, recipientAddress, tokenURI, network = 'BASE-SEPOLIA' } = params;

      global.logger?.info('Starting NFT mint:', {
        walletId,
        recipientAddress,
        network,
      });

      // Validate inputs
      if (!walletId || !recipientAddress || !tokenURI) {
        throw new Error('Missing required parameters for NFT minting');
      }

      if (!ethers.isAddress(recipientAddress)) {
        throw new Error('Invalid recipient address');
      }

      // Get contract instance
      const nftContract = this.getNFTContract(network);

      // Check remaining supply
      const remainingSupply = await nftContract.getRemainingSupply();
      if (remainingSupply === 0n) {
        throw new Error('No NFTs remaining to mint');
      }

      // Encode function call
      const functionSignature = CONTRACT_FUNCTIONS.MINT;
      const encodedParameters = [recipientAddress, tokenURI];

      // Estimate gas cost
      const gasEstimate = await this.circleService.estimateGasCost({
        contractAddress: process.env.NFT_CONTRACT_ADDRESS!,
        functionSignature,
        encodedParameters,
        blockchain: network,
      });

      global.logger?.info('Gas estimation:', gasEstimate);

      // Create gasless transaction via Circle
      const transaction = await this.circleService.createGaslessTransaction({
        walletId,
        contractAddress: process.env.NFT_CONTRACT_ADDRESS!,
        functionSignature,
        encodedParameters,
        blockchain: network,
      });

      // Wait for transaction confirmation
      const confirmedTx = await this.circleService.waitForTransaction(
        transaction.transactionId,
        TIMEOUTS.TRANSACTION_CONFIRMATION,
        TIMEOUTS.POLLING_INTERVAL
      );

      // Get the minted token ID from transaction logs
      const tokenId = await this.getTokenIdFromTransaction(confirmedTx.txHash!, network);

      global.logger?.info('NFT minted successfully:', {
        tokenId,
        txHash: confirmedTx.txHash,
        gasUsed: confirmedTx.gasUsed,
      });

      return {
        success: true,
        tokenId,
        transactionHash: confirmedTx.txHash!,
        gasUsed: confirmedTx.gasUsed,
        gasSaved: gasEstimate.estimatedCost,
        blockHash: confirmedTx.blockHash,
        blockHeight: confirmedTx.blockHeight,
        network,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      global.logger?.error('NFT minting failed:', error);
      throw new BlockchainError(`NFT minting failed: ${error.message}`);
    }
  }

  /**
   * Batch mint multiple NFTs
   */
  async batchMintNFTs(params: {
    walletId: string;
    recipients: string[];
    tokenURIs: string[];
    network?: SupportedNetwork;
  }): Promise<NFTMintResult> {
    try {
      const { walletId, recipients, tokenURIs, network = 'BASE-SEPOLIA' } = params;

      global.logger?.info('Starting batch NFT mint:', {
        walletId,
        recipientCount: recipients.length,
        network,
      });

      // Validate inputs
      if (!recipients || !tokenURIs || recipients.length !== tokenURIs.length) {
        throw new Error('Recipients and tokenURIs arrays must have the same length');
      }

      if (recipients.length === 0) {
        throw new Error('No recipients specified');
      }

      // Validate addresses
      for (const address of recipients) {
        if (!ethers.isAddress(address)) {
          throw new Error(`Invalid recipient address: ${address}`);
        }
      }

      // Check remaining supply
      const nftContract = this.getNFTContract(network);
      const remainingSupply = await nftContract.getRemainingSupply();

      if (remainingSupply < recipients.length) {
        throw new Error(
          `Not enough NFTs remaining. Requested: ${recipients.length}, Available: ${remainingSupply}`
        );
      }

      // Encode function call
      const functionSignature = CONTRACT_FUNCTIONS.BATCH_MINT;
      const encodedParameters = [recipients, tokenURIs];

      // Create gasless transaction
      const transaction = await this.circleService.createGaslessTransaction({
        walletId,
        contractAddress: process.env.NFT_CONTRACT_ADDRESS!,
        functionSignature,
        encodedParameters,
        blockchain: network,
      });

      // Wait for confirmation
      const confirmedTx = await this.circleService.waitForTransaction(transaction.transactionId);

      // Get minted token IDs from transaction logs
      const tokenIds = await this.getTokenIdsFromBatchTransaction(confirmedTx.txHash!, network);

      global.logger?.info('Batch NFT mint successful:', {
        tokenIds,
        txHash: confirmedTx.txHash,
        gasUsed: confirmedTx.gasUsed,
      });

      return {
        success: true,
        tokenIds,
        transactionHash: confirmedTx.txHash!,
        gasUsed: confirmedTx.gasUsed,
        blockHash: confirmedTx.blockHash,
        blockHeight: confirmedTx.blockHeight,
        network,
        mintedCount: tokenIds.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      global.logger?.error('Batch NFT minting failed:', error);
      throw new BlockchainError(`Batch NFT minting failed: ${error.message}`);
    }
  }

  /**
   * Get NFT contract statistics
   */
  async getNFTStats(network: SupportedNetwork = 'BASE-SEPOLIA'): Promise<NFTStats> {
    try {
      const nftContract = this.getNFTContract(network);

      const [totalMinted, remainingSupply, currentPrice] = await nftContract.getStats();
      const maxSupply = await nftContract.maxSupply();
      const name = await nftContract.name();
      const symbol = await nftContract.symbol();

      return {
        success: true,
        contractName: name,
        contractSymbol: symbol,
        totalMinted: totalMinted.toString(),
        remainingSupply: remainingSupply.toString(),
        maxSupply: maxSupply.toString(),
        currentPrice: currentPrice.toString(),
        priceInUSDC: (Number(currentPrice) / 1000000).toFixed(2),
        network,
        contractAddress: process.env.NFT_CONTRACT_ADDRESS!,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      global.logger?.error('Failed to get NFT stats:', error);
      throw new BlockchainError(`Failed to get NFT stats: ${error.message}`);
    }
  }

  /**
   * Get user's NFTs
   */
  async getUserNFTs(userAddress: string, network: SupportedNetwork = 'BASE-SEPOLIA'): Promise<UserNFTs> {
    try {
      if (!ethers.isAddress(userAddress)) {
        throw new Error('Invalid user address');
      }

      const nftContract = this.getNFTContract(network);

      const tokenIds = await nftContract.getUserTokens(userAddress);
      const balance = await nftContract.balanceOf(userAddress);
      const mintCount = await nftContract.userMintCount(userAddress);

      // Get metadata for each token
      const nfts = await Promise.all(
        tokenIds.map(async (tokenId: bigint) => {
          try {
            const tokenURI = await nftContract.tokenURI(tokenId);
            return {
              tokenId: tokenId.toString(),
              tokenURI,
              owner: userAddress,
            };
          } catch (error: any) {
            global.logger?.warn(`Failed to get metadata for token ${tokenId}:`, error);
            return {
              tokenId: tokenId.toString(),
              tokenURI: '',
              owner: userAddress,
              error: 'Failed to load metadata',
            };
          }
        })
      );

      return {
        success: true,
        userAddress,
        balance: balance.toString(),
        mintCount: mintCount.toString(),
        nfts,
        network,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      global.logger?.error(`Failed to get NFTs for user ${userAddress}:`, error);
      throw new BlockchainError(`Failed to get user NFTs: ${error.message}`);
    }
  }

  /**
   * Get NFT details by token ID
   */
  async getNFTDetails(tokenId: string, network: SupportedNetwork = 'BASE-SEPOLIA'): Promise<NFTDetails> {
    try {
      const nftContract = this.getNFTContract(network);

      const owner = await nftContract.ownerOf(tokenId);
      const tokenURI = await nftContract.tokenURI(tokenId);

      return {
        success: true,
        tokenId,
        owner,
        tokenURI,
        network,
        contractAddress: process.env.NFT_CONTRACT_ADDRESS!,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      global.logger?.error(`Failed to get NFT details for token ${tokenId}:`, error);
      throw new BlockchainError(`Failed to get NFT details: ${error.message}`);
    }
  }

  /**
   * Get USDC balance for an address
   */
  async getUSDCBalance(
    address: string,
    network: SupportedNetwork = 'BASE-SEPOLIA'
  ): Promise<{
    success: boolean;
    address: string;
    balance: string;
    formattedBalance: string;
    decimals: string;
    network: SupportedNetwork;
    timestamp: string;
  }> {
    try {
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid address');
      }

      const usdcContract = this.getUSDCContract(network);
      const balance = await usdcContract.balanceOf(address);
      const decimals = await usdcContract.decimals();

      const formattedBalance = ethers.formatUnits(balance, decimals);

      return {
        success: true,
        address,
        balance: balance.toString(),
        formattedBalance: parseFloat(formattedBalance).toFixed(2),
        decimals: decimals.toString(),
        network,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      global.logger?.error(`Failed to get USDC balance for ${address}:`, error);
      throw new BlockchainError(`Failed to get USDC balance: ${error.message}`);
    }
  }

  /**
   * Extract token ID from mint transaction logs
   */
  private async getTokenIdFromTransaction(
    txHash: string,
    network: SupportedNetwork = 'BASE-SEPOLIA'
  ): Promise<string> {
    try {
      const provider = this.getProvider(network);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Parse NFTMinted event logs
      const nftContract = this.getNFTContract(network);
      const mintedEvents = receipt.logs
        .map((log) => {
          try {
            return nftContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter((event) => event && event.name === 'NFTMinted');

      if (mintedEvents.length === 0) {
        throw new Error('No NFTMinted events found in transaction');
      }

      return mintedEvents[0]!.args.tokenId.toString();
    } catch (error: any) {
      global.logger?.error(`Failed to extract token ID from transaction ${txHash}:`, error);
      // Return a placeholder if we can't extract the exact token ID
      return 'pending';
    }
  }

  /**
   * Extract token IDs from batch mint transaction logs
   */
  private async getTokenIdsFromBatchTransaction(
    txHash: string,
    network: SupportedNetwork = 'BASE-SEPOLIA'
  ): Promise<string[]> {
    try {
      const provider = this.getProvider(network);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Parse BatchMinted event logs
      const nftContract = this.getNFTContract(network);
      const batchEvents = receipt.logs
        .map((log) => {
          try {
            return nftContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter((event) => event && event.name === 'BatchMinted');

      if (batchEvents.length === 0) {
        throw new Error('No BatchMinted events found in transaction');
      }

      return batchEvents[0]!.args.tokenIds.map((id: bigint) => id.toString());
    } catch (error: any) {
      global.logger?.error(`Failed to extract token IDs from transaction ${txHash}:`, error);
      // Return empty array if we can't extract the exact token IDs
      return [];
    }
  }

  /**
   * Check if network is supported
   */
  public isNetworkSupported(network: string): network is SupportedNetwork {
    return Object.keys(this.providers).includes(network);
  }

  /**
   * Get all supported networks
   */
  public getSupportedNetworks(): SupportedNetwork[] {
    return Object.keys(this.providers) as SupportedNetwork[];
  }
}