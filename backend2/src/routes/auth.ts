import { Router, Request, Response } from 'express';
import { ApiResponse, User } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { validateUserRegistration } from '../middleware/validation';
import { generateToken } from '../utils/auth';
import { userService } from '../services/userService';
import { circleService } from '../services/circleService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Register or login user with email
 * Creates Circle wallet automatically
 */
router.post('/login', validateUserRegistration, asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  
  logger.info('User login/registration attempt', { email });
  
  // Check if user already exists
  let user = await userService.getUserByEmail(email);
  let isNewUser = false;
  
  if (!user) {
    // Create new user
    user = await userService.createUser(email);
    isNewUser = true;
    logger.info('New user created', { userId: user.id, email });
  }
  
  // Create Circle wallet if user doesn't have one
  if (!user.walletId || !user.walletAddress) {
    try {
      const wallets = await circleService.createWallet(['ETH', 'MATIC']);
      
      // Get the first created wallet (typically ETH)
      const primaryWallet = wallets[0];
      
      if (primaryWallet) {
        user = await userService.updateUserWallet(
          user.id,
          primaryWallet.id,
          primaryWallet.address
        );
        
        logger.info('Circle wallet created for user', {
          userId: user.id,
          walletId: primaryWallet.id,
          walletAddress: primaryWallet.address,
        });
      }
    } catch (error: any) {
      logger.error('Failed to create Circle wallet during login', {
        userId: user.id,
        error: error.message,
      });
      // Continue without wallet for now - can be created later
    }
  }
  
  // Generate JWT token
  const token = generateToken(user);
  
  const response: ApiResponse<{
    user: Partial<User>;
    token: string;
    isNewUser: boolean;
  }> = {
    success: true,
    message: isNewUser ? 'User registered successfully' : 'User logged in successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        walletId: user.walletId,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token,
      isNewUser
    }
  };
  
  res.status(isNewUser ? 201 : 200).json(response);
}));

export default router;
