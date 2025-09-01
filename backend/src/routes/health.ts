import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { userService } from '../services/userService';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    message: 'Gasless NFT Minter Backend is healthy',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV,
    },
  };
  
  res.json(response);
}));

/**
 * Detailed health check with service status
 */
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Check database/user service
  let userServiceStatus = 'healthy';
  let userCount = 0;
  try {
    userCount = await userService.getUserCount();
  } catch (error) {
    userServiceStatus = 'unhealthy';
  }
  
  const responseTime = Date.now() - startTime;
  
  const response: ApiResponse = {
    success: true,
    message: 'Detailed health check',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      responseTime: `${responseTime}ms`,
      services: {
        userService: {
          status: userServiceStatus,
          userCount,
        },
        circleAPI: {
          status: 'configured',
          hasApiKey: !!process.env.CIRCLE_API_KEY,
          hasGasStationKey: !!process.env.CIRCLE_GAS_STATION_API_KEY,
        },
        blockchain: {
          baseConfigured: !!process.env.NFT_CONTRACT_ADDRESS_BASE,
          polygonConfigured: !!process.env.NFT_CONTRACT_ADDRESS_POLYGON,
        },
      },
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024,
        external: process.memoryUsage().external / 1024 / 1024,
      },
    },
  };
  
  res.json(response);
}));

export { router as healthRoutes };