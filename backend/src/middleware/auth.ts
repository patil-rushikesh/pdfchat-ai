import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { firebaseAuth } from '../config/firebase';

export interface AuthUser {
  uid: string;
  user_id: string;
  email?: string;
  name?: string;
  picture?: string;
}

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
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return 'dev-only-insecure-secret-change-me';
  }
  return secret;
};

/**
 * Legacy helper retained for the older /api/auth/token endpoint.
 * New clients should use Firebase ID tokens instead.
 */
export const signToken = (user_id: string, expiresIn = '24h'): string => {
  return jwt.sign({ user_id }, JWT_SECRET(), { expiresIn } as jwt.SignOptions);
};

const setUserFromFirebaseToken = async (token: string, req: Request): Promise<void> => {
  const decoded = await firebaseAuth.verifyIdToken(token);
  req.user = {
    uid: decoded.uid,
    user_id: decoded.uid,
    email: decoded.email,
    name: typeof decoded.name === 'string' ? decoded.name : undefined,
    picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
  };
};

const setUserFromLegacyJwt = (token: string, req: Request): void => {
  const payload = jwt.verify(token, JWT_SECRET()) as { user_id: string };
  if (!payload.user_id || typeof payload.user_id !== 'string') {
    throw new Error('Invalid payload');
  }
  req.user = { uid: payload.user_id, user_id: payload.user_id };
};

/**
 * Express middleware that authenticates requests with a Firebase Bearer token.
 *
 * REQUIRE_AUTH=true rejects missing/invalid tokens. In development, missing
 * tokens can still pass through to preserve older local workflows.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const requireAuth = process.env.REQUIRE_AUTH !== 'false';
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    if (requireAuth) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    next();
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    res.status(401).json({ error: 'Authorization header must use Bearer scheme' });
    return;
  }

  try {
    await setUserFromFirebaseToken(token, req);
    next();
  } catch (firebaseErr) {
    try {
      setUserFromLegacyJwt(token, req);
      next();
    } catch {
      const message = firebaseErr instanceof Error
        ? firebaseErr.message
        : 'Invalid or malformed token.';
      res.status(401).json({ error: message });
    }
  }
};
