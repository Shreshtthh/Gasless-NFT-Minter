import express, { Request, Response } from 'express';
const { body, param, query, validationResult } = require('express-validator');
import { ApiResponse, MintNFTRequest, MintNFTResponse, SupportedBlockchain } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { nftService } from '../services/nftService';
import { circleService } from '../services/circleService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Handle validation errors
 */
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response: ApiResponse = {
      success: false,
      error: 'Validation failed',
      data: errors.array()
    };
    return res.status(400).json(response);
  }
  next();
};

/**
 * Mint NFT (gasless transaction)
 */
router.post('/mint', 
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('nftMetadata.name').notEmpty().withMessage('NFT name is required'),
    body('nftMetadata.description').notEmpty().withMessage('NFT description is required'),
    body('nftMetadata.image').isURL().withMessage('Valid image URL is required'),
    body('blockchain').isIn(['base', 'polygon', 'BASE-SEPOLIA', 'MATIC-AMOY', 'ETH-SEPOLIA']).withMessage('Supported blockchain is required'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const mintRequest: MintNFTRequest = {
      email: req.body.email,
      nftMetadata: req.body.nftMetadata,
      blockchain: req.body.blockchain as SupportedBlockchain,
      payWithUSDC: req.body.payWithUSDC || false
    };

    logger.info('NFT mint request received', {
      email: mintRequest.email,
      blockchain: mintRequest.blockchain,
      nftName: mintRequest.nftMetadata.name,
      payWithUSDC: mintRequest.payWithUSDC,
    });

    const mintResult = await nftService.mintNFT(mintRequest);

    const response: ApiResponse<MintNFTResponse> = {
      success: true,
      message: 'NFT minted successfully',
      data: mintResult,
    };

    res.status(201).json(response);
  })
);

/**
 * Get NFT owner
 */
router.get('/owner/:blockchain/:tokenId', 
  [
    param('blockchain').isIn(['base', 'polygon', 'ethereum']).withMessage('Supported blockchain is required'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { blockchain, tokenId } = req.params;

    logger.info('Get NFT owner request', { blockchain, tokenId });

    const owner = await nftService.getNFTOwner(blockchain, tokenId);

    const response: ApiResponse<{ owner: string; tokenId: string; blockchain: string }> = {
      success: true,
      message: 'NFT owner retrieved successfully',
      data: { owner, tokenId, blockchain },
    };

    res.json(response);
  })
);

/**
 * Get total supply of NFTs on a blockchain
 */
router.get('/supply/:blockchain', 
  [
    param('blockchain').isIn(['base', 'polygon', 'ethereum']).withMessage('Supported blockchain is required'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { blockchain } = req.params;

    logger.info('Get total supply request', { blockchain });

    const totalSupply = await nftService.getTotalSupply(blockchain);

    const response: ApiResponse<{ totalSupply: number; blockchain: string }> = {
      success: true,
      message: 'Total supply retrieved successfully',
      data: { totalSupply, blockchain },
    };

    res.json(response);
  })
);

/**
 * Get NFT metadata from IPFS
 */
router.get('/metadata', 
  [
    query('tokenUri').isURL().withMessage('Valid token URI is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { tokenUri } = req.query as { tokenUri: string };

    logger.info('Get NFT metadata request', { tokenUri });

    const metadata = await nftService.getNFTMetadata(tokenUri);

    const response: ApiResponse<any> = {
      success: true,
      message: 'NFT metadata retrieved successfully',
      data: metadata,
    };

    res.json(response);
  })
);

/**
 * Batch mint NFTs (for demo purposes)
 */
router.post('/batch-mint', 
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('nfts').isArray({ min: 1, max: 10 }).withMessage('NFTs array is required (1-10 items)'),
    body('blockchain').isIn(['base', 'polygon', 'BASE-SEPOLIA', 'MATIC-AMOY', 'ETH-SEPOLIA']).withMessage('Supported blockchain is required'),
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, nfts, blockchain, payWithUSDC = false } = req.body;

    logger.info('Batch NFT mint request', {
      email,
      blockchain,
      count: nfts.length,
      payWithUSDC,
    });

    const results: MintNFTResponse[] = [];
    const errors: any[] = [];

    for (let i = 0; i < nfts.length; i++) {
      try {
        const nftMetadata = nfts[i];
        const mintRequest: MintNFTRequest = {
          email,
          nftMetadata,
          blockchain: blockchain as SupportedBlockchain,
          payWithUSDC: i === 0 ? payWithUSDC : false,
        };
        
        const result = await nftService.mintNFT(mintRequest);
        results.push(result);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        errors.push({
          index: i,
          nftName: nfts[i]?.name || 'Unknown',
          error: error.message,
        });
      }
    }

    const response: ApiResponse<{
      successful: MintNFTResponse[];
      errors: any[];
      totalRequested: number;
      totalSuccessful: number;
      totalFailed: number;
    }> = {
      success: errors.length < nfts.length,
      message: `Batch mint completed: ${results.length} successful, ${errors.length} failed`,
      data: {
        successful: results,
        errors,
        totalRequested: nfts.length,
        totalSuccessful: results.length,
        totalFailed: errors.length,
      },
    };

    res.status(results.length > 0 ? 201 : 400).json(response);
  })
);

export default router;
