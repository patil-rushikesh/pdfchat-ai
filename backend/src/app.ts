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
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    console.log(`CORS: Request from origin: ${origin}`);
    
    // Always allow localhost origins for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('CORS: Allowing localhost origin');
      return callback(null, true);
    }
    
    // Allow requests from your frontend domain
    const allowedOrigins = ENV.FRONTEND_URL === '*' ? ['*'] : [ENV.FRONTEND_URL];
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    
    if (isAllowed) {
      console.log('CORS: Allowing origin');
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      console.log(`Allowed origins: ${JSON.stringify(allowedOrigins)}`);
      callback(new Error('Not allowed by CORS'), false);
    }
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
