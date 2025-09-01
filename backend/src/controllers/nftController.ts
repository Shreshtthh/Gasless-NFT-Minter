import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import CircleService from '../services/circleServices';
import BlockchainService from '../services/blockchainService';
import axios from 'axios';

type Network = 'BASE-SEPOLIA' | 'MATIC-MUMBAI' | 'ETH-SEPOLIA';

interface MintRequest {
    recipientAddress: string;
    tokenURI: string;
}

interface BatchMintResult {
    success: boolean;
    tokenIds: string[];
    transactionHash: string;
    gasUsed: string;
    blockHash: string;
    blockHeight: string;
    network: Network;
    mintedCount: number;
    timestamp: string;
    error?: string;
}

interface NFTDetails {
    success: boolean;
    tokenId: string;
    owner: string;
    tokenURI: string;
    network: Network;
    contractAddress?: string;
    timestamp: string;
    transactionHash?: string;
}

interface NFTMetadata {
    tokenId: string;
    tokenURI: string;
    owner: string;
    error?: string;
    metadata?: any;
}

class NFTController {
    private circleService: CircleService;
    private blockchainService: BlockchainService;

    constructor() {
        this.circleService = new CircleService();
        this.blockchainService = new BlockchainService();
    }
    
    /**
     * Mint a single NFT using gasless transaction
     */
    async mintNFT(req: Request, res: Response): Promise<void> {
        try {
            // Validate request
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            
            const {
                walletId,
                recipientAddress,
                tokenURI,
                metadata,
                network = 'BASE-SEPOLIA'
            } = req.body;
            
            global.logger?.info(`Starting NFT mint for wallet: ${walletId}`);
            
            // Validate network
            if (!this.blockchainService.isNetworkSupported(network)) {
                res.status(400).json({
                    error: 'Unsupported network',
                    supportedNetworks: this.blockchainService.getSupportedNetworks()
                });
                return;
            }
            
            // Generate unique mint ID for tracking
            const mintId = uuidv4();
            
            // Check NFT contract status
            let contractStats;
            try {
                contractStats = await this.blockchainService.getNFTStats(network);
                if (parseInt(contractStats.remainingSupply) === 0) {
                    res.status(400).json({
                        error: 'Sold out',
                        message: 'No more NFTs available to mint',
                        contractStats
                    });
                    return;
                }
            } catch (error) {
                global.logger?.warn('Could not get contract stats:', error);
            }
            
            // Estimate gas cost before minting
            let gasEstimate;
            try {
                gasEstimate = await this.circleService.estimateGasCost({
                    contractAddress: process.env.NFT_CONTRACT_ADDRESS!,
                    functionSignature: 'mint(address,string)',
                    encodedParameters: [recipientAddress, tokenURI],
                    blockchain: network
                });
            } catch (error) {
                global.logger?.warn('Gas estimation failed:', error);
                gasEstimate = { 
                    success: false, 
                    estimatedCost: '0.005',
                    gasLimit: '500000'
                };
            }
            
            // Perform the gasless mint
            const mintResult = await this.blockchainService.mintNFT({
                walletId,
                recipientAddress,
                tokenURI,
                network
            });
            
            if (!mintResult.success) {
                res.status(500).json({
                    error: 'Minting failed',
                    message: 'Could not mint NFT',
                    mintId
                });
                return;
            }
            
            // Get updated contract stats
            let updatedStats;
            try {
                updatedStats = await this.blockchainService.getNFTStats(network);
            } catch (error) {
                global.logger?.warn('Could not get updated stats:', error);
            }
            
            const response = {
                success: true,
                data: {
                    mintId,
                    tokenId: mintResult.tokenId,
                    transactionHash: mintResult.transactionHash,
                    blockHash: mintResult.blockHash,
                    blockHeight: mintResult.blockHeight,
                    recipient: recipientAddress,
                    tokenURI,
                    network,
                    walletId,
                    gasUsed: mintResult.gasUsed,
                    gasSaved: gasEstimate.estimatedCost,
                    contractAddress: process.env.NFT_CONTRACT_ADDRESS,
                    timestamp: mintResult.timestamp,
                    metadata: metadata || null
                },
                contractStats: updatedStats,
                message: 'NFT minted successfully without gas fees!'
            };
            
            global.logger?.info(`NFT minted successfully:`, {
                mintId,
                tokenId: mintResult.tokenId,
                txHash: mintResult.transactionHash,
                gasUsed: mintResult.gasUsed
            });
            
            res.status(201).json(response);
            
        } catch (error: any) {
            global.logger?.error('NFT minting error:', error);
            
            res.status(500).json({
                error: 'NFT minting failed',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Batch mint multiple NFTs
     */
    async batchMintNFTs(req: Request, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            
            const {
                walletId,
                mintRequests,
                network = 'BASE-SEPOLIA'
            } = req.body;
            
            // Validate mint requests
            if (!Array.isArray(mintRequests) || mintRequests.length === 0) {
                res.status(400).json({
                    error: 'Invalid mint requests',
                    message: 'mintRequests must be a non-empty array'
                });
                return;
            }
            
            if (mintRequests.length > 10) {
                res.status(400).json({
                    error: 'Too many requests',
                    message: 'Maximum 10 NFTs can be minted in a single batch'
                });
                return;
            }
            
            global.logger?.info(`Starting batch mint for ${mintRequests.length} NFTs`);
            
            const recipients = mintRequests.map((req: MintRequest) => req.recipientAddress);
            const tokenURIs = mintRequests.map((req: MintRequest) => req.tokenURI);
            
            const batchId = uuidv4();
            
            // Check contract capacity
            const contractStats = await this.blockchainService.getNFTStats(network);
            if (parseInt(contractStats.remainingSupply) < mintRequests.length) {
                res.status(400).json({
                    error: 'Insufficient supply',
                    message: `Only ${contractStats.remainingSupply} NFTs remaining, requested ${mintRequests.length}`,
                    contractStats
                });
                return;
            }
            
            // Perform batch mint
            const batchResult = await this.blockchainService.batchMintNFTs({
                walletId,
                recipients,
                tokenURIs,
                network
            });
            
                if (!batchResult.success) {
                    res.status(500).json({
                        error: 'Batch minting failed',
                        message: 'Could not batch mint NFTs',
                        batchId
                    });
                    return;
                }            // Get updated contract stats
            const updatedStats = await this.blockchainService.getNFTStats(network);
            
            const response = {
                success: true,
                data: {
                    batchId,
                    tokenIds: batchResult.tokenIds,
                    transactionHash: batchResult.transactionHash,
                    blockHash: batchResult.blockHash,
                    blockHeight: batchResult.blockHeight,
                    mintedCount: batchResult.mintedCount,
                    recipients,
                    tokenURIs,
                    network,
                    walletId,
                    gasUsed: batchResult.gasUsed,
                    contractAddress: process.env.NFT_CONTRACT_ADDRESS,
                    timestamp: batchResult.timestamp
                },
                contractStats: updatedStats,
                message: `${batchResult.mintedCount} NFTs minted successfully without gas fees!`
            };
            
            global.logger?.info(`Batch mint successful:`, {
                batchId,
                tokenIds: batchResult.tokenIds,
                txHash: batchResult.transactionHash
            });
            
            res.status(201).json(response);
            
        } catch (error: any) {
            global.logger?.error('Batch minting error:', error);
            
            res.status(500).json({
                error: 'Batch minting failed',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Get NFT details by token ID
     */
    async getNFT(req: Request, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            
            const { tokenId } = req.params;
            const { network = 'BASE-SEPOLIA' } = req.query;
            
            if (!this.blockchainService.isNetworkSupported(network as string)) {
                res.status(400).json({
                    error: 'Unsupported network',
                    supportedNetworks: this.blockchainService.getSupportedNetworks()
                });
                return;
            }
            
            global.logger?.info(`Getting NFT details for token ${tokenId} on ${network}`);
            
            const nftDetails = await this.blockchainService.getNFTDetails(tokenId, network as Network);
            
            if (!nftDetails.success) {
                res.status(404).json({
                    error: 'NFT not found',
                    message: `Token ID ${tokenId} not found on ${network}`
                });
                return;
            }
            
            // Try to fetch metadata if tokenURI is available
            let metadata = null;
            if (nftDetails.tokenURI) {
                try {
                    const metadataResponse = await axios.get(nftDetails.tokenURI, {
                        timeout: 5000
                    });
                    metadata = metadataResponse.data;
                } catch (error) {
                    global.logger?.warn(`Could not fetch metadata for token ${tokenId}:`, error);
                }
            }
            
            const response = {
                success: true,
                data: {
                    ...nftDetails,
                    metadata,
                    openSeaUrl: `https://testnets.opensea.io/assets/${(network as string).toLowerCase()}/${process.env.NFT_CONTRACT_ADDRESS}/${tokenId}`,
                    explorerUrl: this.getExplorerUrl('', network as Network) // We don't have transaction hash in the type
                }
            };
            
            res.json(response);
            
        } catch (error: any) {
            global.logger?.error('Get NFT error:', error);
            
            res.status(500).json({
                error: 'Failed to get NFT details',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Get user's NFTs
     */
    async getUserNFTs(req: Request, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            
            const { userId } = req.params;
            const { walletId, network, includeMetadata = 'false' } = req.query;
            
            if (!walletId) {
                res.status(400).json({
                    error: 'Missing walletId parameter'
                });
                return;
            }
            
            global.logger?.info(`Getting NFTs for user ${userId}`);
            
            // Get wallet address
            const walletResult = await this.circleService.getWallet(walletId as string);
            if (!walletResult.success) {
                res.status(404).json({
                    error: 'Wallet not found'
                });
                return;
            }
            
            const walletAddress = walletResult.data.address;
            const networksToCheck = network ? [network as Network] : this.blockchainService.getSupportedNetworks();
            
            const nftsByNetwork: Record<string, any> = {};
            let totalNFTs = 0;
            
            for (const net of networksToCheck) {
                try {
                    const userNFTs = await this.blockchainService.getUserNFTs(walletAddress, net);
                    
                    if (userNFTs.success && includeMetadata === 'true') {
                        // Fetch metadata for each NFT
                        for (const nft of userNFTs.nfts) {
                            if (nft.tokenURI && !nft.error) {
                                try {
                                    const metadataResponse = await axios.get(nft.tokenURI, {
                                        timeout: 3000
                                    });
                                    (nft as any).metadata = metadataResponse.data;
                                } catch (error) {
                                    global.logger?.warn(`Failed to fetch metadata for token ${nft.tokenId}:`, error);
                                    (nft as any).metadata = null;
                                }
                            }
                        }
                    }
                    
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
                        nfts: []
                    };
                }
            }
            
            const response = {
                success: true,
                data: {
                    userId,
                    walletId,
                    walletAddress,
                    totalNFTs,
                    nftsByNetwork,
                    includeMetadata: includeMetadata === 'true',
                    supportedNetworks: this.blockchainService.getSupportedNetworks(),
                    timestamp: new Date().toISOString()
                }
            };
            
            res.json(response);
            
        } catch (error: any) {
            global.logger?.error('Get user NFTs error:', error);
            
            res.status(500).json({
                error: 'Failed to get user NFTs',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Get NFT contract statistics
     */
    async getNFTStats(req: Request, res: Response): Promise<void> {
        try {
            const { network = 'BASE-SEPOLIA' } = req.query;
            
            if (!this.blockchainService.isNetworkSupported(network as string)) {
                res.status(400).json({
                    error: 'Unsupported network',
                    supportedNetworks: this.blockchainService.getSupportedNetworks()
                });
                return;
            }
            
            global.logger?.info(`Getting NFT stats for ${network}`);
            
            const stats = await this.blockchainService.getNFTStats(network as Network);
            
            if (!stats.success) {
                res.status(500).json({
                    error: 'Failed to get contract stats',
                    message: 'Could not retrieve NFT contract statistics'
                });
                return;
            }
            
            // Get Gas Station info for additional context
            let gasStationInfo;
            try {
                gasStationInfo = await this.circleService.getGasStationInfo();
            } catch (error) {
                global.logger?.warn('Could not get gas station info:', error);
                gasStationInfo = { success: false };
            }
            
            const response = {
                success: true,
                data: {
                    ...stats,
                    gasStationInfo: gasStationInfo.success ? gasStationInfo : null,
                    supportedNetworks: this.blockchainService.getSupportedNetworks(),
                    explorerUrl: this.getContractExplorerUrl(network as Network),
                    openSeaUrl: `https://testnets.opensea.io/collection/${stats.contractName?.toLowerCase().replace(/\s+/g, '-')}`
                }
            };
            
            res.json(response);
            
        } catch (error: any) {
            global.logger?.error('Get NFT stats error:', error);
            
            res.status(500).json({
                error: 'Failed to get NFT statistics',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Estimate minting cost (for transparency, even though it's gasless)
     */
    async estimateMintCost(req: Request, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            
            const {
                recipientAddress,
                tokenURI,
                network = 'BASE-SEPOLIA',
                batchSize = 1
            } = req.body;
            
            if (!this.blockchainService.isNetworkSupported(network)) {
                res.status(400).json({
                    error: 'Unsupported network',
                    supportedNetworks: this.blockchainService.getSupportedNetworks()
                });
                return;
            }
            
            global.logger?.info(`Estimating mint cost for ${batchSize} NFTs on ${network}`);
            
            // Estimate single mint
            const singleMintEstimate = await this.circleService.estimateGasCost({
                contractAddress: process.env.NFT_CONTRACT_ADDRESS!,
                functionSignature: 'mint(address,string)',
                encodedParameters: [recipientAddress, tokenURI],
                blockchain: network
            });
            
            // Estimate batch mint if batchSize > 1
            let batchMintEstimate = null;
            if (batchSize > 1) {
                const recipients = new Array(batchSize).fill(recipientAddress);
                const tokenURIs = new Array(batchSize).fill(tokenURI);
                
                batchMintEstimate = await this.circleService.estimateGasCost({
                    contractAddress: process.env.NFT_CONTRACT_ADDRESS!,
                    functionSignature: 'batchMint(address[],string[])',
                    encodedParameters: [recipients, tokenURIs],
                    blockchain: network
                });
            }
            
            // Calculate savings
            const singleCostEth = parseFloat(singleMintEstimate.estimatedCost || '0.005');
            const batchCostEth = batchMintEstimate ? parseFloat(batchMintEstimate.estimatedCost || '0.01') : null;
            const individualCostEth = batchCostEth ? batchCostEth / batchSize : singleCostEth;
            const savingsPerNFT = Math.max(0, singleCostEth - individualCostEth);
            
            // Rough ETH to USD conversion (you might want to use a real API for this)
            const ethToUsd = 2000; // Placeholder - use real price feed in production
            
            const response = {
                success: true,
                data: {
                    network,
                    batchSize,
                    estimates: {
                        singleMint: {
                            gasLimit: singleMintEstimate.gasLimit,
                            gasPrice: singleMintEstimate.gasPrice,
                            costInEth: singleCostEth.toFixed(6),
                            costInUsd: (singleCostEth * ethToUsd).toFixed(2)
                        },
                        batchMint: batchMintEstimate ? {
                            gasLimit: batchMintEstimate.gasLimit,
                            gasPrice: batchMintEstimate.gasPrice,
                            totalCostInEth: batchCostEth?.toFixed(6) || '0',
                            costPerNFTInEth: individualCostEth.toFixed(6),
                            totalCostInUsd: (batchCostEth || 0 * ethToUsd).toFixed(2),
                            costPerNFTInUsd: (individualCostEth * ethToUsd).toFixed(2)
                        } : null
                    },
                    savings: {
                        gaslessUser: {
                            costInEth: '0.000000',
                            costInUsd: '0.00',
                            savedInEth: batchMintEstimate ? (batchCostEth?.toFixed(6) || '0') : singleCostEth.toFixed(6),
                            savedInUsd: batchMintEstimate ? ((batchCostEth || 0) * ethToUsd).toFixed(2) : (singleCostEth * ethToUsd).toFixed(2)
                        },
                        batchEfficiency: batchMintEstimate ? {
                            savingsPerNFTInEth: savingsPerNFT.toFixed(6),
                            savingsPerNFTInUsd: (savingsPerNFT * ethToUsd).toFixed(2),
                            totalBatchSavingsInEth: (savingsPerNFT * batchSize).toFixed(6),
                            totalBatchSavingsInUsd: (savingsPerNFT * batchSize * ethToUsd).toFixed(2)
                        } : null
                    },
                    disclaimer: 'These are estimates. Actual gas costs may vary. With Circle Gas Station, users pay $0 in gas fees.',
                    timestamp: new Date().toISOString()
                }
            };
            
            res.json(response);
            
        } catch (error: any) {
            global.logger?.error('Estimate mint cost error:', error);
            
            res.status(500).json({
                error: 'Failed to estimate mint cost',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Get transaction status
     */
    async getTransactionStatus(req: Request, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            
            const { transactionId } = req.params;
            
            global.logger?.info(`Getting transaction status for: ${transactionId}`);
            
            const status = await this.circleService.getTransactionStatus(transactionId);
            
            if (!status.success) {
                res.status(404).json({
                    error: 'Transaction not found',
                    message: 'Could not retrieve transaction status'
                });
                return;
            }
            
            const response = {
                success: true,
                data: {
                    transactionId,
                    ...status,
                    explorerUrl: status.txHash ? this.getExplorerUrl(status.txHash, 'BASE-SEPOLIA') : null
                }
            };
            
            res.json(response);
            
        } catch (error: any) {
            global.logger?.error('Get transaction status error:', error);
            
            res.status(500).json({
                error: 'Failed to get transaction status',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Helper method to generate block explorer URLs
     */
    getExplorerUrl(txHash: string, network: Network): string {
        const explorers: Record<Network, string> = {
            'BASE-SEPOLIA': `https://sepolia.basescan.org/tx/${txHash}`,
            'MATIC-MUMBAI': `https://mumbai.polygonscan.com/tx/${txHash}`,
            'ETH-SEPOLIA': `https://sepolia.etherscan.io/tx/${txHash}`
        };
        
        return explorers[network] || `https://sepolia.basescan.org/tx/${txHash}`;
    }
    
    /**
     * Helper method to generate contract explorer URLs
     */
    getContractExplorerUrl(network: Network): string | null {
        const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
        if (!contractAddress) return null;
        
        const explorers: Record<Network, string> = {
            'BASE-SEPOLIA': `https://sepolia.basescan.org/address/${contractAddress}`,
            'MATIC-MUMBAI': `https://mumbai.polygonscan.com/address/${contractAddress}`,
            'ETH-SEPOLIA': `https://sepolia.etherscan.io/address/${contractAddress}`
        };
        
        return explorers[network] || `https://sepolia.basescan.org/address/${contractAddress}`;
    }
}

// Validation middleware for routes
const nftValidation = {
    mintNFT: [
        body('walletId')
            .isString()
            .notEmpty()
            .withMessage('walletId is required'),
        body('recipientAddress')
            .isEthereumAddress()
            .withMessage('Valid Ethereum address required for recipient'),
        body('tokenURI')
            .isURL()
            .withMessage('Valid URL required for tokenURI'),
        body('network')
            .optional()
            .isString()
            .isIn(['BASE-SEPOLIA', 'MATIC-MUMBAI', 'ETH-SEPOLIA'])
            .withMessage('Invalid network')
    ],
    
    batchMintNFTs: [
        body('walletId')
            .isString()
            .notEmpty()
            .withMessage('walletId is required'),
        body('mintRequests')
            .isArray({ min: 1, max: 10 })
            .withMessage('mintRequests must be an array with 1-10 items'),
        body('mintRequests.*.recipientAddress')
            .isEthereumAddress()
            .withMessage('Valid Ethereum address required for each recipient'),
        body('mintRequests.*.tokenURI')
            .isURL()
            .withMessage('Valid URL required for each tokenURI'),
        body('network')
            .optional()
            .isString()
            .isIn(['BASE-SEPOLIA', 'MATIC-MUMBAI', 'ETH-SEPOLIA'])
            .withMessage('Invalid network')
    ],
    
    getNFT: [
        param('tokenId')
            .isNumeric()
            .withMessage('tokenId must be a number')
    ],
    
    getUserNFTs: [
        param('userId')
            .isString()
            .notEmpty()
            .withMessage('userId is required')
    ],
    
    estimateMintCost: [
        body('recipientAddress')
            .isEthereumAddress()
            .withMessage('Valid Ethereum address required'),
        body('tokenURI')
            .isURL()
            .withMessage('Valid URL required for tokenURI'),
        body('batchSize')
            .optional()
            .isInt({ min: 1, max: 10 })
            .withMessage('batchSize must be between 1 and 10')
    ],
    
    getTransactionStatus: [
        param('transactionId')
            .isUUID()
            .withMessage('Valid transaction ID (UUID) required')
    ]
};

export { NFTController, nftValidation };
