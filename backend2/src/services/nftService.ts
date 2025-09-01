import { ethers } from 'ethers';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { circleService } from './circleService';
import { userService } from './userService';
import {
  NFTMetadata,
  MintNFTRequest,
  MintNFTResponse,
  BlockchainConfig,
  SupportedBlockchain,
} from '../types';

// Corrected ERC-721 ABI for your contract
const ERC721_ABI = [
  'function mintTo(address to, string memory uri) external returns (uint256)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function totalSupply() external view returns (uint256)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function balanceOf(address owner) external view returns (uint256)',
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

class NFTService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();

  constructor() {
    // ✅ Initialize providers dynamically from config
    for (const [key, chainConfig] of Object.entries(config.blockchains)) {
      this.providers.set(key, new ethers.JsonRpcProvider(chainConfig.rpcUrl));
    }
    
    // Validate contract addresses are configured
    this.validateContractConfiguration();
  }

  /**
   * Validate that contract addresses are configured
   */
  private validateContractConfiguration(): void {
    const baseAddress = config.blockchains.base.nftContractAddress;
    const polygonAddress = config.blockchains.polygon.nftContractAddress;
    
    if (!baseAddress || baseAddress === '0x000...' || baseAddress.length < 42) {
      logger.warn('⚠️  Base NFT contract address not configured. Please deploy contract and update NFT_CONTRACT_ADDRESS_BASE in .env');
    }
    
    if (!polygonAddress || polygonAddress === '0x000...' || polygonAddress.length < 42) {
      logger.warn('⚠️  Polygon NFT contract address not configured. Please deploy contract and update NFT_CONTRACT_ADDRESS_POLYGON in .env');
    }
  }

  /**
   * ✅ Map Circle blockchain names back to internal config names
   */
  private mapToInternalBlockchain(blockchain: SupportedBlockchain): string {
    const internalMapping: Record<SupportedBlockchain, string> = {
      'BASE-SEPOLIA': 'base',
      'MATIC-AMOY': 'polygon', 
      'ETH-SEPOLIA': 'ethereum',
      'BASE': 'base',
      'MATIC': 'polygon',
      'ETH': 'ethereum'
    };
    return internalMapping[blockchain] || 'base';
  }

  /**
   * Upload NFT metadata to IPFS (simplified version using a public gateway)
   * In production, you'd use a service like Pinata or your own IPFS node
   */
  private async uploadMetadataToIPFS(metadata: NFTMetadata): Promise<string> {
    try {
      // For demo purposes, we'll create a mock IPFS URL
      // In production, you would upload to actual IPFS
      const mockHash = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      const ipfsUrl = `https://ipfs.io/ipfs/${mockHash}`;
      
      logger.info('NFT metadata uploaded to IPFS (mock)', {
        ipfsUrl,
        metadata: metadata.name,
      });
      
      return ipfsUrl;
    } catch (error: any) {
      logger.error('Failed to upload metadata to IPFS', {
        error: error.message,
      });
      throw new Error(`Failed to upload metadata: ${error.message}`);
    }
  }

  /**
   * Get blockchain configuration
   */
  private getBlockchainConfig(blockchain: string): BlockchainConfig {
    const config_chain = config.blockchains[blockchain];
    if (!config_chain) {
      throw new Error(`Unsupported blockchain: ${blockchain}`);
    }
    return config_chain;
  }

  /**
   * ✅ Mint NFT using gasless transaction with proper blockchain mapping
   */
  async mintNFT(request: MintNFTRequest): Promise<MintNFTResponse> {
    try {
      const { email, nftMetadata, blockchain, payWithUSDC = false } = request;
      
      // ✅ Map blockchain name to internal config key
      const internalBlockchain = this.mapToInternalBlockchain(blockchain);
      const blockchainConfig = this.getBlockchainConfig(internalBlockchain);
      
      // Get or create user
      let user = await userService.getUserByEmail(email);
      if (!user) {
        user = await userService.createUser(email);
      }

      // Create wallet if user doesn't have one
      if (!user.walletId || !user.walletAddress) {
        // ✅ Pass blockchain directly (already in correct format)
        const wallets = await circleService.createWallet([blockchain]);
        const wallet = wallets.find(w => w.blockchain === blockchain);
        
        if (!wallet) {
          throw new Error(`Failed to create wallet for ${blockchain}`);
        }

        user = await userService.updateUserWallet(user.id, wallet.id, wallet.address);
      }

      // Upload metadata to IPFS
      const metadataUri = await this.uploadMetadataToIPFS(nftMetadata);
      
      // Handle USDC payment if requested
      if (payWithUSDC) {
        await this.handleUSDCPayment(user.walletId!, blockchainConfig);
      }

      // Use correct function signature for your contract
      const abiFunctionSignature = 'mintTo(address,string)';
      const abiParameters = [
        user.walletAddress,  // to address
        metadataUri,        // token URI (your contract auto-generates tokenId)
      ];

      // ✅ Execute gasless mint transaction with blockchain parameter
      const transaction = await circleService.executeGaslessTransaction(
        user.walletId!,
        blockchainConfig.nftContractAddress,
        abiFunctionSignature,
        abiParameters,
        blockchain // Pass original blockchain parameter
      );

      // Parse tokenId from transaction receipt
      let tokenId = 'unknown';
      try {
        // ✅ Use internal blockchain name for provider lookup
        const provider = this.providers.get(internalBlockchain);
        if (provider && transaction.transactionHash) {
          const receipt = await provider.getTransactionReceipt(transaction.transactionHash);
          if (receipt && receipt.logs.length > 0) {
            // Parse Transfer event to get tokenId
            const contract = new ethers.Contract(
              blockchainConfig.nftContractAddress,
              ERC721_ABI,
              provider
            );
            
            // Find Transfer event in logs
            for (const log of receipt.logs) {
              try {
                const parsed = contract.interface.parseLog(log);
                if (parsed?.name === 'Transfer' && parsed.args.from === ethers.ZeroAddress) {
                  // This is a mint transaction (from zero address)
                  tokenId = parsed.args.tokenId.toString();
                  break;
                }
              } catch (parseError: any) {
                // Skip logs that don't match our contract interface
                continue;
              }
            }
          }
        }
      } catch (parseError: any) {
        logger.warn('Could not parse tokenId from transaction receipt', { 
          parseError: parseError.message,
          transactionHash: transaction.transactionHash 
        });
      }

      logger.info('NFT minted successfully', {
        userId: user.id,
        email: user.email,
        tokenId,
        blockchain: internalBlockchain,
        transactionId: transaction.transactionId,
        transactionHash: transaction.transactionHash,
        metadataUri,
      });

      return {
        transactionHash: transaction.transactionHash,
        nftId: tokenId,
        contractAddress: blockchainConfig.nftContractAddress,
        walletAddress: user.walletAddress!,
        blockchain: internalBlockchain, // ✅ Return internal blockchain name
        gasSponsored: true,
      };

    } catch (error: any) {
      logger.error('Failed to mint NFT', {
        email: request.email,
        blockchain: request.blockchain,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to mint NFT: ${error.message}`);
    }
  }

  /**
   * Handle USDC payment for NFT metadata storage
   */
  private async handleUSDCPayment(
    walletId: string,
    blockchainConfig: BlockchainConfig
  ): Promise<void> {
    try {
      // Check wallet USDC balance
      const balance = await circleService.getWalletBalance(walletId);
      const usdcBalance = balance.balances.find(b => 
        b.token.toLowerCase() === blockchainConfig.usdcContractAddress.toLowerCase()
      );

      if (!usdcBalance) {
        throw new Error('Insufficient USDC balance for metadata storage payment');
      }

      // Convert USDC amount (1 USDC = 1,000,000 units with 6 decimals)
      const paymentAmount = (parseFloat(config.usdc.metadataStorageCost) * Math.pow(10, config.usdc.decimals)).toString();
      
      if (parseFloat(usdcBalance.amount) < parseFloat(paymentAmount)) {
        throw new Error('Insufficient USDC balance for metadata storage payment');
      }

      // For demo purposes, we'll just log the payment
      // In production, you would transfer USDC to a service wallet
      logger.info('USDC payment processed for metadata storage', {
        walletId,
        amount: config.usdc.metadataStorageCost,
        blockchain: blockchainConfig.name,
      });

    } catch (error: any) {
      logger.error('Failed to process USDC payment', {
        walletId,
        error: error.message,
      });
      throw new Error(`USDC payment failed: ${error.message}`);
    }
  }

  /**
   * Get NFT metadata from IPFS
   */
  async getNFTMetadata(tokenUri: string): Promise<NFTMetadata> {
    try {
      const response = await axios.get(tokenUri);
      return response.data as NFTMetadata;
    } catch (error: any) {
      logger.error('Failed to get NFT metadata', {
        tokenUri,
        error: error.message,
      });
      throw new Error(`Failed to get NFT metadata: ${error.message}`);
    }
  }

  /**
   * Get NFT owner
   */
  async getNFTOwner(blockchain: string, tokenId: string): Promise<string> {
    try {
      const blockchainConfig = this.getBlockchainConfig(blockchain);
      const provider = this.providers.get(blockchain);
      
      if (!provider) {
        throw new Error(`Provider not found for blockchain: ${blockchain}`);
      }

      const contract = new ethers.Contract(
        blockchainConfig.nftContractAddress,
        ERC721_ABI,
        provider
      );

      const owner = await contract.ownerOf(tokenId);
      return owner;

    } catch (error: any) {
      logger.error('Failed to get NFT owner', {
        blockchain,
        tokenId,
        error: error.message,
      });
      throw new Error(`Failed to get NFT owner: ${error.message}`);
    }
  }

  /**
   * Get total supply of NFTs on a blockchain
   */
  async getTotalSupply(blockchain: string): Promise<number> {
    try {
      const blockchainConfig = this.getBlockchainConfig(blockchain);
      const provider = this.providers.get(blockchain);
      
      if (!provider) {
        throw new Error(`Provider not found for blockchain: ${blockchain}`);
      }

      const contract = new ethers.Contract(
        blockchainConfig.nftContractAddress,
        ERC721_ABI,
        provider
      );

      const totalSupply = await contract.totalSupply();
      return parseInt(totalSupply.toString());

    } catch (error: any) {
      logger.error('Failed to get total supply', {
        blockchain,
        error: error.message,
      });
      throw new Error(`Failed to get total supply: ${error.message}`);
    }
  }
}

export const nftService = new NFTService();
