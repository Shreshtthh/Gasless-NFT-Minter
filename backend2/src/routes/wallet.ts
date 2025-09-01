import { Router, Request, Response } from 'express';
import { ApiResponse, WalletBalance, CircleWallet } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { validateWalletCreation, validateWalletBalance } from '../middleware/validation';
import { authenticateUser } from '../middleware/auth';
import { circleService } from '../services/circleService';
import { userService } from '../services/userService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Create a new Circle wallet for a user
 */
router.post('/create', validateWalletCreation, asyncHandler(async (req: Request, res: Response) => {
  const { email, blockchains = ['ETH', 'MATIC'] } = req.body;
  
  logger.info('Wallet creation request', { email, blockchains });
  
  // Get or create user
  let user = await userService.getUserByEmail(email);
  if (!user) {
    user = await userService.createUser(email);
  }
  
  // Check if user already has a wallet
  if (user.walletId) {
    const existingWallet = await circleService.getWallet(user.walletId);
    if (existingWallet) {
      const response: ApiResponse<{ wallet: CircleWallet }> = {
        success: true,
        message: 'User already has a wallet',
        data: {
          wallet: existingWallet,
        },
      };
      return res.json(response);
    }
  }
  
  // Create new Circle wallet
  const wallets = await circleService.createWallet(blockchains);
  const primaryWallet = wallets[0]; // Use first wallet as primary
  
  // Update user with wallet information
  if (primaryWallet) {
    await userService.updateUserWallet(
      user.id,
      primaryWallet.id,
      primaryWallet.address
    );
  }
  
  const response: ApiResponse<{ wallets: CircleWallet[] }> = {
    success: true,
    message: 'Wallets created successfully',
    data: {
      wallets,
    },
  };
  
  res.status(201).json(response);
}));

/**
 * Get wallet information by email
 */
router.get('/info/:email', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.params;
  
  // Get user by email
  const user = await userService.getUserByEmail(email);
  
  if (!user || !user.walletId) {
    const response: ApiResponse = {
      success: false,
      message: 'User or wallet not found',
    };
    return res.status(404).json(response);
  }
  
  // Get wallet information from Circle
  const wallet = await circleService.getWallet(user.walletId);
  
  if (!wallet) {
    const response: ApiResponse = {
      success: false,
      message: 'Wallet not found',
    };
    return res.status(404).json(response);
  }
  
  const response: ApiResponse<{ wallet: CircleWallet; user: { email: string } }> = {
    success: true,
    message: 'Wallet information retrieved successfully',
    data: {
      wallet,
      user: {
        email: user.email,
      },
    },
  };
  
  res.json(response);
}));

/**
 * Get wallet balance
 */
router.get('/balance/:walletId', validateWalletBalance, asyncHandler(async (req: Request, res: Response) => {
  const { walletId } = req.params;
  
  logger.info('Balance check request', { walletId });
  
  // Get wallet balance from Circle
  const balance = await circleService.getWalletBalance(walletId);
  
  const response: ApiResponse<{ balance: WalletBalance }> = {
    success: true,
    message: 'Wallet balance retrieved successfully',
    data: {
      balance,
    },
  };
  
  res.json(response);
}));

/**
 * Get all wallets for the wallet set
 */
router.get('/all', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Get all wallets request');
  
  // Get all wallets from Circle
  const wallets = await circleService.getWallets();
  
  const response: ApiResponse<{ wallets: CircleWallet[]; count: number }> = {
    success: true,
    message: 'Wallets retrieved successfully',
    data: {
      wallets,
      count: wallets.length,
    },
  };
  
  res.json(response);
}));

/**
 * Transfer USDC between wallets (for demo purposes)
 */
router.post('/transfer-usdc', asyncHandler(async (req: Request, res: Response) => {
  const { fromWalletId, toAddress, amount, blockchain } = req.body;
  
  if (!fromWalletId || !toAddress || !amount || !blockchain) {
    const response: ApiResponse = {
      success: false,
      error: 'Missing required parameters: fromWalletId, toAddress, amount, blockchain',
    };
    return res.status(400).json(response);
  }
  
  logger.info('USDC transfer request', {
    fromWalletId,
    toAddress,
    amount,
    blockchain,
  });
  
  // Map blockchain names to Circle blockchain types
  const circleBlockchain = blockchain === 'base' ? 'ETH' : 'MATIC';
  
  // Execute USDC transfer
  const transaction = await circleService.transferUSDC(
    fromWalletId,
    toAddress,
    amount,
    circleBlockchain
  );
  
  const response: ApiResponse<{ transaction: any }> = {
    success: true,
    message: 'USDC transfer initiated successfully',
    data: {
      transaction,
    },
  };
  
  res.json(response);
}));

export { router as walletRoutes };