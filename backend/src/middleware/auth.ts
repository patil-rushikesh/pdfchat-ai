/**
 * JWT authentication middleware.
 *
 * Behaviour depends on the REQUIRE_AUTH environment variable:
 *
 *   REQUIRE_AUTH=true  → 401 when the token is absent or invalid
 *   REQUIRE_AUTH unset → validates the token when present, but continues
 *                        without setting req.user when the header is absent
 *                        (backward-compatible dev mode)
 *
 * A valid JWT sets req.user = { user_id: string } for use in downstream
 * handlers that need ownership checks.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  user_id: string;
}

// Augment Express Request so TypeScript knows about req.user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly in production; use a hard-coded dev key in development.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return 'dev-only-insecure-secret-change-me';
  }
  return secret;
};

/**
 * Sign a JWT for a given user_id.
 * Expires in 24 hours by default.
 */
export const signToken = (user_id: string, expiresIn = '24h'): string => {
  return jwt.sign({ user_id }, JWT_SECRET(), { expiresIn } as jwt.SignOptions);
};

/**
 * Express middleware that authenticates requests via a Bearer JWT.
 *
 * On success:  sets req.user and calls next()
 * On failure:  returns 401 (only when REQUIRE_AUTH=true)
 * No header:   continues when REQUIRE_AUTH is not set
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requireAuth = process.env.REQUIRE_AUTH === 'true';
  const authHeader  = req.headers['authorization'];

  if (!authHeader) {
    if (requireAuth) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    // Dev/fallback: no header → continue unauthenticated
    return next();
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    res.status(401).json({ error: 'Authorization header must use Bearer scheme' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET()) as { user_id: string };
    if (!payload.user_id || typeof payload.user_id !== 'string') {
      throw new Error('Invalid payload');
    }
    req.user = { user_id: payload.user_id };
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Token expired. Please re-authenticate.'
      : 'Invalid or malformed token.';
    res.status(401).json({ error: message });
  }
};
