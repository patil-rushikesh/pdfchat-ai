/**
 * GET /api/chat/:chatId/documents/:docId/signed-url
 *
 * Returns a time-limited presigned S3 GET URL so the frontend can download
 * the original PDF directly from S3 without exposing permanent credentials.
 *
 * The URL is valid for SIGNED_URL_EXPIRES seconds (default: 1 hour).
 *
 * Response 200:
 *   { url: string, expires_in: number, expires_at: string }
 */

import { Request, Response, NextFunction } from 'express';
import { getDocumentById } from '../models/documentModel';
import { getPresignedUrl, isS3Configured } from '../services/s3Service';

const SIGNED_URL_EXPIRES = parseInt(process.env.SIGNED_URL_EXPIRES ?? '3600', 10);

export const getDocumentSignedUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!isS3Configured()) {
      res.status(503).json({ error: 'File storage is not configured.' });
      return;
    }

    const { chatId, docId } = req.params as { chatId: string; docId: string };

    const doc = await getDocumentById(docId);
    if (!doc) {
      res.status(404).json({ error: 'Document not found', doc_id: docId });
      return;
    }

    // Verify the document belongs to the requested chat session
    if (doc.chat_id !== chatId) {
      res.status(404).json({ error: 'Document does not belong to this chat session' });
      return;
    }

    // Ownership check — only the document's owner may download it
    if (req.user && doc.user_id && req.user.user_id !== doc.user_id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const url        = await getPresignedUrl(doc.s3_key, SIGNED_URL_EXPIRES);
    const expires_at = new Date(Date.now() + SIGNED_URL_EXPIRES * 1000).toISOString();

    res.json({ url, expires_in: SIGNED_URL_EXPIRES, expires_at });
  } catch (err) {
    next(err);
  }
};
