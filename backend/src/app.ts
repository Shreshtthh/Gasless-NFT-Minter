import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import winston from "winston";

// Import routes
import walletRoutes from "./routes/wallet";
import nftRoutes from "./routes/nft";

// Import middleware
import authMiddleware from "./middleware/auth";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/app.log" })
  ]
});

// Make logger available globally
declare global {
  // eslint-disable-next-line no-var
  var logger: winston.Logger;
}
global.logger = logger;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-User-ID"]
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100"),
  message: {
    error: "Too many requests from this IP, please try again later",
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000") / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: "Too many requests from this IP, please try again later",
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000") / 1000)
    });
  }
});

app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: req.method !== "GET" ? req.body : undefined
  });
  next();
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "1.0.0",
    environment: process.env.NODE_ENV ?? "development"
  });
});

// API routes
app.use("/api/wallet", walletRoutes);
app.use("/api/nft", nftRoutes);

// Circle webhooks endpoint (no auth required)
app.post("/webhooks/circle", express.raw({ type: "application/json" }), (req: Request, res: Response) => {
  try {
    if (process.env.WEBHOOK_SECRET) {
      const signature = req.headers["circle-signature"] as string | undefined;
      // Add signature verification logic here
      logger.info("Circle webhook received", { signature });
    }

    const event = JSON.parse(req.body.toString());
    logger.info("Circle webhook event:", event);

    switch (event.type) {
      case "transaction.confirmed":
        logger.info("Transaction confirmed:", event.data);
        break;
      case "transaction.failed":
        logger.error("Transaction failed:", event.data);
        break;
      default:
        logger.info("Unhandled webhook event type:", event.type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Webhook processing error:", error);
    res.status(400).json({ error: "Invalid webhook payload" });
  }
});

// API documentation endpoint
app.get("/api", (req: Request, res: Response) => {
  res.json({
    name: "Gasless NFT Minter API",
    version: "1.0.0",
    description: "Backend API for gasless NFT minting using Circle Wallets and Gas Station",
    endpoints: {
      health: "GET /health",
      wallet: {
        create: "POST /api/wallet/create",
        get: "GET /api/wallet/:userId",
        balance: "GET /api/wallet/:userId/balance"
      },
      nft: {
        mint: "POST /api/nft/mint",
        get: "GET /api/nft/:tokenId",
        userNFTs: "GET /api/nft/user/:userId",
        stats: "GET /api/nft/stats"
      }
    },
    documentation: "https://developers.circle.com/",
    support: "https://discord.com/channels/473781666251538452/1267777662164799602"
  });
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Route not found",
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      "GET /health",
      "GET /api",
      "POST /api/wallet/create",
      "GET /api/wallet/:userId",
      "POST /api/nft/mint",
      "GET /api/nft/stats"
    ]
  });
});

// Global error handler
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Global error handler:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(error.status || 500).json({
    error: error.message || "Internal server error",
    ...(isDevelopment && {
      stack: error.stack,
      details: error
    }),
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV ?? "development"} mode`);
    logger.info(`API documentation available at http://localhost:${PORT}/api`);
    logger.info(`Health check available at http://localhost:${PORT}/health`);
  });

  server.close((err) => {
    if (err) {
      logger.error("Error during server close:", err);
      process.exit(1);
    }

    logger.info("Server closed successfully");
    process.exit(0);
  });
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Gasless NFT Backend running on port ${PORT}`);
  logger.info(`📚 API documentation: http://localhost:${PORT}/api`);
  logger.info(`❤️ Health check: http://localhost:${PORT}/health`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
});

export default app;
