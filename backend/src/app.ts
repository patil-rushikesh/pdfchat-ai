import express, { Request, Response, NextFunction, Application } from "express";
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import apiRoutes from './routes/api';
import { errorHandler } from './middleware/errorHandler';
import { ENV } from './config/env';

const app: Application = express();

// Trust proxy for production deployments (only when behind a real proxy)
if (ENV.NODE_ENV === 'production') {
  // Only trust proxy when actually behind a proxy, not in development
  app.set('trust proxy', 'loopback');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression middleware
app.use(compression());

// Body parsing with reasonable limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS configuration
const isDev = ENV.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Always allow same-origin / non-browser requests (no Origin header)
    if (!origin) return callback(null, true);

    // In development allow everything so any localhost port works
    if (isDev) return callback(null, true);

    // In production restrict to the configured frontend URL
    const allowed = ENV.FRONTEND_URL === '*' || origin === ENV.FRONTEND_URL;
    if (allowed) return callback(null, true);

    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Rate limiting (configured to work with trust proxy)
if (ENV.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: ENV.RATE_LIMIT_WINDOW_MS,
    max: ENV.RATE_LIMIT_MAX_REQUESTS,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    // Configure rate limiting to work with trust proxy
    keyGenerator: (req) => {
      // Use X-Forwarded-For header if available, otherwise use IP
      return req.headers['x-forwarded-for'] as string || req.ip || req.socket.remoteAddress || 'unknown';
    }
  });

  app.use('/api/', limiter);
}

// Health check endpoints
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ENV.NODE_ENV
  });
});

app.get('/ready', (req: Request, res: Response) => {
  res.json({ 
    ready: true, 
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV
  });
});

// API routes
app.use('/api', apiRoutes);

// 404 handler for unmatched routes
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Not found', 
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use(errorHandler);

export default app;
