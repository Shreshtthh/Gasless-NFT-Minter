import { Request, Response, NextFunction } from 'express';
const { body, param, validationResult } = require('express-validator');
import { AppError } from './errorHandler';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error: any) => error.msg).join(', ');
    throw new AppError(errorMessages, 400);
  }
  
  next();
};

/**
 * Validation rules for user registration
 */
export const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  handleValidationErrors,
];

/**
 * Validation rules for NFT minting
 */
export const validateNFTMint = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('nftMetadata.name')
    .notEmpty()
    .withMessage('NFT name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('NFT name must be between 1 and 100 characters'),
  body('nftMetadata.description')
    .notEmpty()
    .withMessage('NFT description is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('NFT description must be between 1 and 1000 characters'),
  body('nftMetadata.image')
    .notEmpty()
    .withMessage('NFT image URL is required')
    .isURL()
    .withMessage('Please provide a valid image URL'),
  body('blockchain')
    .isIn(['base', 'polygon'])
    .withMessage('Blockchain must be either "base" or "polygon"'),
  body('payWithUSDC')
    .optional()
    .isBoolean()
    .withMessage('payWithUSDC must be a boolean value'),
  handleValidationErrors,
];

/**
 * Validation rules for wallet creation
 */
export const validateWalletCreation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('blockchains')
    .isArray()
    .withMessage('Blockchains must be an array')
    .custom((blockchains: string[]) => {
      const validBlockchains = ['ETH', 'MATIC'];
      return blockchains.every((blockchain: string) => 
        validBlockchains.includes(blockchain)
      );
    })
    .withMessage('Invalid blockchain specified'),
  handleValidationErrors,
];

/**
 * Validation rules for getting wallet balance
 */
export const validateWalletBalance = [
  param('walletId')
    .isUUID()
    .withMessage('Please provide a valid wallet ID'),
  handleValidationErrors,
];

/**
 * Validation rules for blockchain parameter
 */
export const validateBlockchain = [
  param('blockchain')
    .isIn(['base', 'polygon'])
    .withMessage('Blockchain must be either "base" or "polygon"'),
  handleValidationErrors,
];
