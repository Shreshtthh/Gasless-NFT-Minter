import express, { Request, Response } from 'express';
import { WalletController, walletValidation } from '../controllers/walletController';
import { asyncHandler } from '../middleware/auth';

const router = express.Router();
const walletController = new WalletController();

/**
 * @route   POST /api/wallet/create
 * @desc    Create a new Circle Wallet for a user
 * @access  Public
 */
router.post('/create', 
    walletValidation.createWallet,
    asyncHandler(async (req: Request, res: Response) => {
        await walletController.createWallet(req, res);
    })
);

/**
 * @route   GET /api/wallet/:userId
 * @desc    Get wallet details by user ID
 * @access  Public
 * @query   walletId - Circle Wallet ID (required)
 */
router.get('/:userId', 
    walletValidation.getWallet,
    asyncHandler(async (req: Request, res: Response) => {
        await walletController.getWallet(req, res);
    })
);

/**
 * @route   GET /api/wallet/:userId/balance
 * @desc    Get wallet balance for a specific network
 * @access  Public
 * @query   walletId - Circle Wallet ID (required)
 * @query   network - Network identifier (optional, default: BASE-SEPOLIA)
 */
router.get('/:userId/balance', 
    walletValidation.getBalance,
    asyncHandler(async (req: Request, res: Response) => {
        await walletController.getWalletBalance(req, res);
    })
);

/**
 * @route   GET /api/wallet/:userId/nfts
 * @desc    Get user's NFTs across all networks
 * @access  Public
 * @query   walletId - Circle Wallet ID (required)
 * @query   network - Network identifier (optional, checks all if not specified)
 */
router.get('/:userId/nfts', 
    walletValidation.getWallet,
    asyncHandler(async (req: Request, res: Response) => {
        await walletController.getUserNFTs(req, res);
    })
);

/**
 * @route   POST /api/wallet/challenge
 * @desc    Create authentication challenge for wallet
 * @access  Public
 */
router.post('/challenge', 
    walletValidation.createChallenge,
    asyncHandler(async (req: Request, res: Response) => {
        await walletController.createChallenge(req, res);
    })
);

/**
 * @route   POST /api/wallet/verify
 * @desc    Verify signed challenge
 * @access  Public
 */
router.post('/verify', 
    walletValidation.verifyChallenge,
    asyncHandler(async (req: Request, res: Response) => {
        await walletController.verifyChallenge(req, res);
    })
);

/**
 * @route   GET /api/wallet/networks
 * @desc    Get supported blockchain networks
 * @access  Public
 */
router.get('/networks', asyncHandler(async (req: Request, res: Response) => {
    await walletController.getSupportedNetworks(req, res);
}));

/**
 * @route   GET /api/wallet/gas-station/info
 * @desc    Get Gas Station information and statistics
 * @access  Public
 */
router.get('/gas-station/info', asyncHandler(async (req: Request, res: Response) => {
    await walletController.getGasStationInfo(req, res);
}));

export default router;
