/**
 * POST /api/auth/token
 *
 * Issues a short-lived JWT for an anonymous user_id.
 *
 * Body: { user_id: string }
 *
 * Response 200:
 *   { token: string, user_id: string, expires_at: string }
 *
 * This endpoint requires no authentication — it is the entry point that
 * converts a client-generated user_id into a signed token.  The user_id
 * is trusted (anonymous auth) — we sign it so the server can verify it
 * hasn't been tampered with on subsequent calls.
 */

import { Request, Response, NextFunction } from 'express';
import { signToken } from '../middleware/auth';

// Very simple UUID-ish sanity check — prevents obviously malformed input.
const USER_ID_RE = /^[a-zA-Z0-9_\-]{8,128}$/;

export const issueToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { user_id } = req.body as { user_id?: unknown };

    if (!user_id || typeof user_id !== 'string' || !USER_ID_RE.test(user_id.trim())) {
      res.status(400).json({
        error: 'user_id must be a non-empty alphanumeric string (8–128 characters)',
      });
      return;
    }

    const uid   = user_id.trim();
    const token = signToken(uid);

    // Decode the exp claim to return a human-readable expiry
    const parts = token.split('.');
    const payload_b64 = parts[1] ?? '';
    const decoded     = JSON.parse(
      Buffer.from(payload_b64, 'base64url').toString('utf-8')
    );
    const expires_at  = new Date((decoded.exp as number) * 1000).toISOString();

    res.json({ token, user_id: uid, expires_at });
  } catch (err) {
    next(err);
  }
};
