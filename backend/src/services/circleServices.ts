import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  CircleWalletCreateRequest,
  CircleWalletResponse,
  CircleWalletBalance,
  TransactionParams,
  TransactionResponse,
  GasEstimate,
  GasStationInfo,
  AuthChallenge,
  AuthVerification,
  AuthResult,
  SupportedNetwork,
  CircleApiError,
} from '../types';
import { CIRCLE_ENDPOINTS, GAS_STATION_ENDPOINTS, TIMEOUTS } from '../utils/constants';

export class CircleService {
  private circleAPI: AxiosInstance;
  private gasStationAPI: AxiosInstance;
  private apiKey: string;
  private entitySecret: string;
  private gasStationApiKey?: string;

  constructor() {
    this.apiKey = process.env.CIRCLE_API_KEY!;
    this.entitySecret = process.env.CIRCLE_ENTITY_SECRET!;
    this.gasStationApiKey = process.env.GAS_STATION_API_KEY;

    if (!this.apiKey || !this.entitySecret) {
      throw new Error('Circle API credentials not configured');
    }

    // Configure axios instance for Circle API
    this.circleAPI = axios.create({
      baseURL: process.env.CIRCLE_BASE_URL || 'https://api.circle.com',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUTS.API_REQUEST,
    });

    // Configure axios instance for Gas Station API
    this.gasStationAPI = axios.create({
      baseURL: process.env.GAS_STATION_BASE_URL || 'https://gas-station.circle.com',
      headers: {
        ...(this.gasStationApiKey && { Authorization: `Bearer ${this.gasStationApiKey}` }),
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUTS.API_REQUEST,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Circle API response interceptor
    this.circleAPI.interceptors.response.use(
      (response: AxiosResponse) => {
        global.logger?.info('Circle API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        global.logger?.error('Circle API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Gas Station API response interceptor
    this.gasStationAPI.interceptors.response.use(
      (response: AxiosResponse) => {
        global.logger?.info('Gas Station API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        global.logger?.error('Gas Station API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a new Circle Wallet for a user
   */
  async createWallet(userId: string, email: string): Promise<{
    success: boolean;
    data: CircleWalletResponse;
    walletId: string;
    address: string;
    blockchains: string[];
  }> {
    try {
      global.logger?.info(`Creating Circle Wallet for user: ${userId}`);

      const idempotencyKey = uuidv4();

      const walletData = {
        idempotencyKey,
        accountType: 'EOA' as const,
        blockchains: ['BASE-SEPOLIA', 'MATIC-MUMBAI'],
        metadata: {
          userId,
          email,
          createdAt: new Date().toISOString(),
        },
      };

      const response = await this.circleAPI.post<{ data: CircleWalletResponse }>(
        CIRCLE_ENDPOINTS.WALLETS,
        walletData
      );

      global.logger?.info(`Wallet created successfully for user ${userId}:`, {
        walletId: response.data.data.walletId,
        address: response.data.data.address,
      });

      return {
        success: true,
        data: response.data.data,
        walletId: response.data.data.walletId,
        address: response.data.data.address,
        blockchains: response.data.data.blockchains,
      };
    } catch (error: any) {
      global.logger?.error(`Failed to create wallet for user ${userId}:`, error);
      throw new CircleApiError(
        `Wallet creation failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Get wallet details by wallet ID
   */
  async getWallet(walletId: string): Promise<{
    success: boolean;
    data: CircleWalletResponse;
  }> {
    try {
      const response = await this.circleAPI.get<{ data: CircleWalletResponse }>(
        `${CIRCLE_ENDPOINTS.WALLETS}/${walletId}`
      );

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error: any) {
      global.logger?.error(`Failed to get wallet ${walletId}:`, error);
      throw new CircleApiError(
        `Get wallet failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Get wallet balance for USDC
   */
  async getWalletBalance(
    walletId: string,
    blockchain: SupportedNetwork = 'BASE-SEPOLIA'
  ): Promise<CircleWalletBalance> {
    try {
      const response = await this.circleAPI.get(
        `${CIRCLE_ENDPOINTS.WALLETS}/${walletId}/balances`,
        {
          params: { blockchain },
        }
      );

      const usdcBalance = response.data.data.tokenBalances?.find(
        (token: any) => token.token.symbol === 'USDC'
      );

      return {
        success: true,
        balance: usdcBalance ? usdcBalance.amount : '0',
        formattedBalance: usdcBalance
          ? (parseFloat(usdcBalance.amount) / 1000000).toFixed(2)
          : '0.00',
        blockchain,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error: any) {
      global.logger?.error(`Failed to get balance for wallet ${walletId}:`, error);
      throw new CircleApiError(
        `Get balance failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Create a gasless transaction using Circle Gas Station
   */
  async createGaslessTransaction(params: TransactionParams): Promise<TransactionResponse> {
    try {
      const {
        walletId,
        contractAddress,
        functionSignature,
        encodedParameters,
        blockchain = 'BASE-SEPOLIA',
        value = '0',
      } = params;

      global.logger?.info('Creating gasless transaction:', {
        walletId,
        contractAddress,
        functionSignature,
        blockchain,
      });

      const transactionData = {
        idempotencyKey: uuidv4(),
        walletId,
        blockchain,
        contractAddress,
        abiFunctionSignature: functionSignature,
        abiParameters: encodedParameters,
        value,
        gasLimit: '500000',
        metadata: {
          type: 'gasless_nft_mint',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await this.circleAPI.post<{ data: any }>(
        CIRCLE_ENDPOINTS.TRANSACTIONS,
        transactionData
      );

      global.logger?.info('Gasless transaction created:', {
        transactionId: response.data.data.id,
        state: response.data.data.state,
      });

      return {
        success: true,
        transactionId: response.data.data.id,
        state: response.data.data.state,
        txHash: response.data.data.txHash,
        data: response.data.data,
      };
    } catch (error: any) {
      global.logger?.error('Failed to create gasless transaction:', error);
      throw new CircleApiError(
        `Gasless transaction failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<TransactionResponse> {
    try {
      const response = await this.circleAPI.get<{ data: any }>(
        `${CIRCLE_ENDPOINTS.TRANSACTION_STATUS}/${transactionId}`
      );

      return {
        success: true,
        transactionId,
        state: response.data.data.state,
        txHash: response.data.data.txHash,
        blockHash: response.data.data.blockHash,
        blockHeight: response.data.data.blockHeight,
        gasUsed: response.data.data.gasUsed,
        gasPrice: response.data.data.gasPrice,
        data: response.data.data,
      };
    } catch (error: any) {
      global.logger?.error(`Failed to get transaction status ${transactionId}:`, error);
      throw new CircleApiError(
        `Get transaction status failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    transactionId: string,
    maxWaitTime: number = TIMEOUTS.TRANSACTION_CONFIRMATION,
    pollInterval: number = TIMEOUTS.POLLING_INTERVAL
  ): Promise<TransactionResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getTransactionStatus(transactionId);

        if (status.state === 'CONFIRMED') {
          global.logger?.info(`Transaction ${transactionId} confirmed:`, {
            txHash: status.txHash,
            gasUsed: status.gasUsed,
          });
          return status;
        }

        if (status.state === 'FAILED') {
          global.logger?.error(`Transaction ${transactionId} failed:`, status);
          throw new Error(
            `Transaction failed: ${status.data?.errorReason || 'Unknown error'}`
          );
        }

        global.logger?.info(`Transaction ${transactionId} status: ${status.state}`);

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error: any) {
        if (error.message.includes('Transaction failed')) {
          throw error;
        }

        global.logger?.warn(`Error polling transaction ${transactionId}:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Transaction ${transactionId} confirmation timeout after ${maxWaitTime}ms`);
  }

  /**
   * Estimate gas cost for a transaction
   */
  async estimateGasCost(params: {
    contractAddress: string;
    functionSignature: string;
    encodedParameters: any[];
    blockchain?: SupportedNetwork;
  }): Promise<GasEstimate> {
    try {
      const { contractAddress, functionSignature, encodedParameters, blockchain = 'BASE-SEPOLIA' } = params;

      const estimationData = {
        blockchain,
        contractAddress,
        abiFunctionSignature: functionSignature,
        abiParameters: encodedParameters,
      };

      const response = await this.circleAPI.post<{ data: any }>(
        CIRCLE_ENDPOINTS.ESTIMATE,
        estimationData
      );

      return {
        success: true,
        gasLimit: response.data.data.gasLimit,
        gasPrice: response.data.data.gasPrice,
        estimatedCost: response.data.data.estimatedCost,
        blockchain,
      };
    } catch (error: any) {
      global.logger?.error('Failed to estimate gas cost:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        gasLimit: '500000',
        gasPrice: '1000000000',
        estimatedCost: '0.005',
        blockchain: params.blockchain || 'BASE-SEPOLIA',
      };
    }
  }

  /**
   * Get user's transaction history
   */
  async getTransactionHistory(
    walletId: string,
    options: {
      blockchain?: SupportedNetwork;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ success: boolean; transactions: any[]; totalCount: number }> {
    try {
      const { blockchain = 'BASE-SEPOLIA', limit = 10, offset = 0 } = options;

      const response = await this.circleAPI.get(CIRCLE_ENDPOINTS.TRANSACTION_STATUS, {
        params: {
          walletIds: walletId,
          blockchain,
          limit,
          offset,
        },
      });

      return {
        success: true,
        transactions: response.data.data,
        totalCount: response.data.data.length,
      };
    } catch (error: any) {
      global.logger?.error(`Failed to get transaction history for wallet ${walletId}:`, error);
      throw new CircleApiError(
        `Transaction history failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Create a challenge for wallet authentication
   */
  async createChallenge(walletId: string): Promise<AuthChallenge> {
    try {
      const challengeData = {
        idempotencyKey: uuidv4(),
        walletId,
        metadata: {
          purpose: 'authentication',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await this.circleAPI.post<{ data: any }>(
        CIRCLE_ENDPOINTS.CHALLENGES,
        challengeData
      );

      return {
        challengeId: response.data.data.id,
        message: response.data.data.message,
        walletId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      };
    } catch (error: any) {
      global.logger?.error(`Failed to create challenge for wallet ${walletId}:`, error);
      throw new CircleApiError(
        `Challenge creation failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Verify a signed challenge
   */
  async verifyChallenge(challengeId: string, signature: string): Promise<AuthResult> {
    try {
      const verificationData = { signature };

      const response = await this.circleAPI.put<{ data: any }>(
        `${CIRCLE_ENDPOINTS.CHALLENGES}/${challengeId}`,
        verificationData
      );

      return {
        success: true,
        verified: response.data.data.status === 'VERIFIED',
        status: response.data.data.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      global.logger?.error(`Failed to verify challenge ${challengeId}:`, error);
      throw new CircleApiError(
        `Challenge verification failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Get supported blockchains
   */
  async getSupportedBlockchains(): Promise<{ success: boolean; blockchains: string[] }> {
    try {
      const response = await this.circleAPI.get(CIRCLE_ENDPOINTS.CONFIG);

      return {
        success: true,
        blockchains: response.data.data.blockchains || ['BASE-SEPOLIA', 'MATIC-MUMBAI', 'ETH-SEPOLIA'],
      };
    } catch (error: any) {
      global.logger?.error('Failed to get supported blockchains:', error);

      return {
        success: false,
        blockchains: ['BASE-SEPOLIA', 'MATIC-MUMBAI', 'ETH-SEPOLIA'],
      };
    }
  }

  /**
   * Get Gas Station information
   */
  async getGasStationInfo(): Promise<GasStationInfo> {
    try {
      if (!this.gasStationApiKey) {
        throw new Error('Gas Station API key not configured');
      }

      const response = await this.gasStationAPI.get(GAS_STATION_ENDPOINTS.INFO);

      return {
        success: true,
        balance: response.data.balance,
        supportedNetworks: response.data.supportedNetworks,
        transactionsCount: response.data.transactionsCount,
        totalGasSponsored: response.data.totalGasSponsored,
      };
    } catch (error: any) {
      global.logger?.error('Failed to get Gas Station info:', error);
      throw new CircleApiError(
        `Gas Station info failed: ${error.response?.data?.message || error.message}`,
        error.response?.data
      );
    }
  }
}