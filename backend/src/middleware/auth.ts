import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

// User context interface
export interface UserContext {
    userId?: string;
    walletId?: string;
    sessionId?: string;
    ip: string | undefined;
    userAgent?: string;
}

// Extended request interface with user context
declare global {
    namespace Express {
        interface Request {
            userContext?: UserContext;
            logger?: any;
            user?: any;
        }
    }
}

/**
 * Optional JWT authentication middleware
 * This can be used for protected routes in the future
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        res.status(401).json({
            error: 'Access token required',
            message: 'Please provide a valid access token'
        });
        return;
    }
    
    jwt.verify(token, process.env.JWT_SECRET || '', (err: jwt.VerifyErrors | null, user: any) => {
        if (err) {
            global.logger?.warn('JWT verification failed:', err.message);
            res.status(403).json({
                error: 'Invalid token',
                message: 'The provided token is invalid or expired'
            });
            return;
        }
        
        req.user = user;
        next();
    });
};

/**
 * Optional API key authentication middleware
 * This can be used for server-to-server communication
 */
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        res.status(401).json({
            error: 'Invalid API key',
            message: 'Please provide a valid API key in the x-api-key header'
        });
        return;
    }
    
    next();
};

/**
 * User identification middleware
 * Extracts user information from headers for logging/tracking
 */
export const identifyUser = (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.headers['x-user-id'] as string || req.body.userId || req.query.userId as string;
    const walletId = req.headers['x-wallet-id'] as string || req.body.walletId || req.query.walletId as string;
    const sessionId = req.headers['x-session-id'] as string || req.body.sessionId;
    
    req.userContext = {
        userId,
        walletId,
        sessionId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };
    
    // Add user context to logger if available
    if (global.logger && userId) {
        req.logger = global.logger.child({
            userId,
            walletId,
            sessionId,
            ip: req.ip
        });
    }
    
    next();
};

/**
 * Rate limiting middleware for expensive operations
 */
export const rateLimitExpensive = (maxRequests = 5, windowMs = 60000) => {
    const requests = new Map<string, number[]>();
    
    return (req: Request, res: Response, next: NextFunction): void => {
        const key = req.userContext?.userId || req.ip || 'unknown';
        const now = Date.now();
        
        // Clean up old entries
        if (requests.has(key)) {
            const userRequests = requests.get(key) || [];
            const validRequests = userRequests.filter(timestamp => 
                now - timestamp < windowMs
            );
            requests.set(key, validRequests);
        }
        
        const userRequests = requests.get(key) || [];
        
        if (userRequests.length >= maxRequests) {
            global.logger?.warn('Rate limit exceeded for expensive operation:', {
                key,
                requests: userRequests.length,
                maxRequests,
                windowMs
            });
            
            res.status(429).json({
                error: 'Rate limit exceeded',
                message: `Too many requests. Limit: ${maxRequests} per ${windowMs/1000} seconds`,
                retryAfter: Math.ceil(windowMs / 1000)
            });
            return;
        }
        
        userRequests.push(now);
        requests.set(key, userRequests);
        
        next();
    };
};

/**
 * Request validation middleware
 * Validates common request parameters
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
    // Validate content type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        if (!req.is('application/json')) {
            res.status(400).json({
                error: 'Invalid content type',
                message: 'Content-Type must be application/json'
            });
            return;
        }
    }
    
    // Validate request size
    const contentLength = parseInt(req.headers['content-length'] as string) || 0;
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (contentLength > maxSize) {
        res.status(413).json({
            error: 'Request too large',
            message: `Request size exceeds maximum limit of ${maxSize} bytes`
        });
        return;
    }
    
    next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Add security headers
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    
    next();
};

/**
 * CORS preflight handler
 */
export const handlePreflight = (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    
    next();
};

/**
 * Request logging middleware
 */
export const logRequest = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Log request
    global.logger?.info('Incoming request:', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
        userContext: req.userContext
    });
    
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        global.logger?.info('Request completed:', {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userContext: req.userContext
        });
    });
    
    next();
};

/**
 * Error boundary middleware for async routes
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export default {
    authenticateToken,
    authenticateApiKey,
    identifyUser,
    rateLimitExpensive,
    validateRequest,
    securityHeaders,
    handlePreflight,
    logRequest,
    asyncHandler
};
