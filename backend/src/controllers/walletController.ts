import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { CircleService } from '../services/circleService';
import { BlockchainService } from '../services/blockchainService';
import { 
  ApiResponse, 
  CircleWalletResponse, 
  CircleWalletBalance, 
  SupportedNetwork,
  ValidationError,
  NotFoundError 
} from '../types';
import { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../utils/constants';

export class WalletController {
  private circleService: CircleService;
  private blockchainService: BlockchainService;

  constructor() {
    this.circleService = new CircleService();
    this.blockchainService = new BlockchainService();
  }

  /**
   * Create a new Circle Wallet for a user
   */
  public async createWallet(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details: errors.array(),
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const { userId, email }: { userId: string; email: string } = req.body;

      global.logger?.info(`Creating wallet for user: ${userId}`);

      // Create Circle Wallet
      const walletResult = await this.circleService.createWallet(userId, email);

      if (!walletResult.success) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: ERROR_MESSAGES.INTERNAL_ERROR,
          message: 'Could not create Circle Wallet',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Get initial USDC balance for each supported network
      const balances: Record<string, CircleWalletBalance> = {};
      const supportedNetworks = this.blockchainService.getSupportedNetworks();

      for (const network of supportedNetworks) {
        try {
          const balance = await this.circleService.getWalletBalance(
            walletResult.walletId,
            network
          );
          balances[network] = balance;
        } catch (error) {
          global.logger?.warn(`Failed to get balance for ${network}:`, error);
          balances[network] = {
            success: false,
            balance: '0',
            formattedBalance: '0.00',
            blockchain: network,
            lastUpdated: new Date().toISOString(),
          };
        }
      }

      const response: ApiResponse<{
        userId: string;
        email: string;
        walletId: string;
        address: string;
        blockchains: string[];
        balances: Record<string, CircleWalletBalance>;
        createdAt: string;
      }> = {
        success: true,
        data: {
          userId,
          email,
          walletId: walletResult.walletId,
          address: walletResult.address,
          blockchains: walletResult.blockchains,
          balances,
          createdAt: new Date().toISOString(),
        },
        message: SUCCESS_MESSAGES.WALLET_CREATED,
        timestamp: new Date().toISOString(),
      };

      global.logger?.info(`Wallet created successfully for user ${userId}:`, {
        walletId: walletResult.walletId,
        address: walletResult.address,
      });

      res.status(HTTP_STATUS.CREATED).json(response);
    } catch (error: any) {
      global.logger?.error('Wallet creation error:', error);

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error.message,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  }

  /**
   * Get wallet details by user ID
   */
  public async getWallet(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details: errors.array(),
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const { userId }: { userId: string } = req.params as any;
      const { walletId }: { walletId?: string } = req.query as any;

      if (!walletId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.MISSING_WALLET_ID,
          message: 'walletId is required as a query parameter',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      global.logger?.info(`Getting wallet details for user: ${userId}`);

      // Get wallet details from Circle
      const walletResult = await this.circleService.getWallet(walletId);

      if (!walletResult.success) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: ERROR_MESSAGES.WALLET_NOT_FOUND,
          message: 'Could not retrieve wallet details',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Get current balances for all supported networks
      const balances: Record<string, CircleWalletBalance> = {};
      const supportedNetworks = this.blockchainService.getSupportedNetworks();

      for (const network of supportedNetworks) {
        try {
          const balance = await this.circleService.getWalletBalance(walletId, network);
          balances[network] = balance;
        } catch (error) {
          global.logger?.warn(`Failed to get balance for ${network}:`, error);
          balances[network] = {
            success: false,
            balance: '0',
            formattedBalance: '0.00',
            blockchain: network,
            lastUpdated: new Date().toISOString(),
          };
        }
      }

      // Get transaction history
      let transactionHistory: any[] = [];
      try {
        const history = await this.circleService.getTransactionHistory(walletId, {
          limit: 10,
        });
        transactionHistory = history.transactions;
      } catch (error) {
        global.logger?.warn('Failed to get transaction history:', error);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          userId,
          walletId: walletResult.data.walletId,
          address: walletResult.data.address,
          blockchains: walletResult.data.blockchains,
          balances,
          transactionHistory,
          state: walletResult.data.state,
          createdDate: walletResult.data.createDate,
          updatedDate: walletResult.data.updateDate,
        },
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error: any) {
      global.logger?.error('Get wallet error:', error);

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error.message,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  }

  /**
   * Get wallet balance for a specific network
   */
  public async getWalletBalance(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details: errors.array(),
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const { userId }: { userId: string } = req.params as any;
      const { walletId, network = 'BASE-SEPOLIA' as SupportedNetwork }: { 
        walletId?: string; 
        network?: SupportedNetwork 
      } = req.query as any;

      if (!walletId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.MISSING_WALLET_ID,
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      if (!this.blockchainService.isNetworkSupported(network)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.NETWORK_NOT_SUPPORTED,
          data: { supportedNetworks: this.blockchainService.getSupportedNetworks() },
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      global.logger?.info(`Getting balance for user ${userId} on ${network}`);

      // Get Circle Wallet balance
      const circleBalance = await this.circleService.getWalletBalance(walletId, network);

      // Get on-chain USDC balance as verification
      let onChainBalance = null;
      try {
        const walletDetails = await this.circleService.getWallet(walletId);
        if (walletDetails.success && walletDetails.data.address) {
          onChainBalance = await this.blockchainService.getUSDCBalance(
            walletDetails.data.address,
            network
          );
        }
      } catch (error) {
        global.logger?.warn('Failed to get on-chain balance:', error);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          userId,
          walletId,
          network,
          circleBalance,
          onChainBalance,
        },
        message: SUCCESS_MESSAGES.BALANCE_RETRIEVED,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error: any) {
      global.logger?.error('Get balance error:', error);

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error.message,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  }

  /**
   * Get user's NFTs across all networks
   */
  public async getUserNFTs(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details: errors.array(),
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const { userId }: { userId: string } = req.params as any;
      const { walletId, network }: { walletId?: string; network?: SupportedNetwork } = req.query as any;

      if (!walletId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.MISSING_WALLET_ID,
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      global.logger?.info(`Getting NFTs for user: ${userId}`);

      // Get wallet address
      const walletResult = await this.circleService.getWallet(walletId);
      if (!walletResult.success) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: ERROR_MESSAGES.WALLET_NOT_FOUND,
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const walletAddress = walletResult.data.address;
      const networksToCheck = network ? [network] : this.blockchainService.getSupportedNetworks();

      const nftsByNetwork: Record<string, any> = {};
      let totalNFTs = 0;

      for (const net of networksToCheck) {
        try {
          const userNFTs = await this.blockchainService.getUserNFTs(walletAddress, net);
          if (userNFTs.success) {
            nftsByNetwork[net] = userNFTs;
            totalNFTs += parseInt(userNFTs.balance) || 0;
          }
        } catch (error: any) {
          global.logger?.warn(`Failed to get NFTs for network ${net}:`, error);
          nftsByNetwork[net] = {
            success: false,
            error: error.message,
            balance: '0',
            nfts: [],
          };
        }
      }

      const response: ApiResponse = {
        success: true,
        data: {
          userId,
          walletId,
          walletAddress,
          totalNFTs,
          nftsByNetwork,
          supportedNetworks: this.blockchainService.getSupportedNetworks(),
        },
        message: SUCCESS_MESSAGES.NFTS_RETRIEVED,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error: any) {
      global.logger?.error('Get user NFTs error:', error);

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error.message,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  }

  /**
   * Create authentication challenge for wallet
   */
  public async createChallenge(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details: errors.array(),
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const { walletId }: { walletId: string } = req.body;

      global.logger?.info(`Creating challenge for wallet: ${walletId}`);

      const challengeResult = await this.circleService.createChallenge(walletId);

      const response: ApiResponse = {
        success: true,
        data: challengeResult,
        message: SUCCESS_MESSAGES.CHALLENGE_CREATED,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error: any) {
      global.logger?.error('Create challenge error:', error);

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error.message,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  }

  /**
   * Verify signed challenge
   */
  public async verifyChallenge(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details: errors.array(),
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const { challengeId, signature }: { challengeId: string; signature: string } = req.body;

      global.logger?.info(`Verifying challenge: ${challengeId}`);

      const verificationResult = await this.circleService.verifyChallenge(challengeId, signature);

      const response: ApiResponse = {
        success: verificationResult.success,
        data: verificationResult,
        message: verificationResult.verified
          ? SUCCESS_MESSAGES.CHALLENGE_VERIFIED
          : 'Challenge verification failed',
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error: any) {
      global.logger?.error('Verify challenge error:', error);

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error.message,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  }

  /**
   * Get supported blockchains
   */
  public async getSupportedNetworks(req: Request, res: Response): Promise<void> {
    try {
      const circleNetworks = await this.circleService.getSupportedBlockchains();
      const blockchainNetworks = this.blockchainService.getSupportedNetworks();

      const response: ApiResponse = {
        success: true,
        data: {
          circleSupported: circleNetworks.blockchains,
          backendSupported: blockchainNetworks,
          available: blockchainNetworks.filter((network) =>
            circleNetworks.blockchains.includes(network)
          ),
        },
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error: any) {
      global.logger?.error('Get supported networks error:', error);

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error.message,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  }

  /**
   * Get Gas Station information
   */
  public async getGasStationInfo(req: Request, res: Response): Promise<void> {
    try {
      const gasStationInfo = await this.circleService.getGasStationInfo();

      const response: ApiResponse = {
        success: true,
        data: gasStationInfo,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error: any) {
      global.logger?.error('Get gas station info error:', error);

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        message: error.message,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  }
}