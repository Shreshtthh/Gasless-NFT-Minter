import express, { Request, Response } from 'express';
import { NFTController, nftValidation } from '../controllers/nftController';
import { asyncHandler } from '../middleware/auth';

const router = express.Router();
const nftController = new NFTController();

/**
 * @route   POST /api/nft/mint
 * @desc    Mint a single NFT using gasless transaction
 * @access  Public
 */
router.post('/mint', 
    nftValidation.mintNFT,
    asyncHandler(async (req: Request, res: Response) => {
        await nftController.mintNFT(req, res);
    })
);

/**
 * @route   POST /api/nft/batch-mint
 * @desc    Batch mint multiple NFTs
 * @access  Public
 */
router.post('/batch-mint', 
    nftValidation.batchMintNFTs,
    asyncHandler(async (req: Request, res: Response) => {
        await nftController.batchMintNFTs(req, res);
    })
);

/**
 * @route   GET /api/nft/:tokenId
 * @desc    Get NFT details by token ID
 * @access  Public
 * @query   network - Network identifier (optional, default: BASE-SEPOLIA)
 */
router.get('/:tokenId', 
    nftValidation.getNFT,
    asyncHandler(async (req: Request, res: Response) => {
        await nftController.getNFT(req, res);
    })
);

/**
 * @route   GET /api/nft/user/:userId
 * @desc    Get user's NFTs
 * @access  Public
 * @query   walletId - Circle Wallet ID (required)
 * @query   network - Network identifier (optional, checks all if not specified)
 * @query   includeMetadata - Include NFT metadata (optional, default: false)
 */
router.get('/user/:userId', 
    nftValidation.getUserNFTs,
    asyncHandler(async (req: Request, res: Response) => {
        await nftController.getUserNFTs(req, res);
    })
);

/**
 * @route   GET /api/nft/stats
 * @desc    Get NFT contract statistics
 * @access  Public
 * @query   network - Network identifier (optional, default: BASE-SEPOLIA)
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
    await nftController.getNFTStats(req, res);
}));

/**
 * @route   POST /api/nft/estimate-cost
 * @desc    Estimate minting cost (for transparency)
 * @access  Public
 */
router.post('/estimate-cost', 
    nftValidation.estimateMintCost,
    asyncHandler(async (req: Request, res: Response) => {
        await nftController.estimateMintCost(req, res);
    })
);

/**
 * @route   GET /api/nft/transaction/:transactionId
 * @desc    Get transaction status
 * @access  Public
 */
router.get('/transaction/:transactionId', 
    nftValidation.getTransactionStatus,
    asyncHandler(async (req: Request, res: Response) => {
        await nftController.getTransactionStatus(req, res);
    })
);

export default router;
