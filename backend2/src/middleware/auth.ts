import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { AppError } from './errorHandler';
import { AuthRequest } from '../types';
import { userService } from '../services/userService';

/**
 * Middleware to authenticate user using JWT token
 */
export const authenticateUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new AppError('No token provided', 401);
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from database/storage
    const user = await userService.getUserById(decoded.userId);
    
    if (!user) {
      throw new AppError('User not found', 401);
    }

    // Attach user to request object
    req.user = user;
    next();
    
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        const decoded = verifyToken(token);
        const user = await userService.getUserById(decoded.userId);
        
        if (user) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};