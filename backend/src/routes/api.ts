import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import {
  newChat,
  getChat,
  listChats,
  renameChat,
  removeChatSession,
  sendMessage,
} from '../controllers/chatSessionController';
import { uploadChatDocument } from '../controllers/uploadController';
import { getDocumentSignedUrl } from '../controllers/documentController';
import { issueToken } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router: Router = express.Router();

// ---------------------------------------------------------------------------
// Multer — PDF uploads only, 50 MB cap
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accept PDFs and fallback octet-stream (the magic-bytes check in the
    // controller is the authoritative validation).
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted.'));
    }
  },
});

// ---------------------------------------------------------------------------
// Per-endpoint rate limiter for AI message endpoint (expensive operations)
// ---------------------------------------------------------------------------
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1-minute window
  max: 20,                 // 20 messages per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please wait a moment before trying again.' },
});

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'API routes are working!', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** POST /api/auth/token  — exchange user_id for a signed JWT */
router.post('/auth/token', issueToken);

// ---------------------------------------------------------------------------
// Chat Session routes  (all protected by optional JWT auth)
// ---------------------------------------------------------------------------

/** POST /api/chat/new  — create a new chat session */
router.post('/chat/new', authenticate, newChat);

/** POST /api/chat/:chatId/message  — send a message and get AI response */
router.post('/chat/:chatId/message', authenticate, messageLimiter, sendMessage);

/** POST /api/chat/:chatId/upload   — upload a PDF to S3, store metadata */
router.post('/chat/:chatId/upload', authenticate, upload.single('file'), (req, res, next) =>
  uploadChatDocument(req as any, res, next)
);

/** GET /api/chat/list  — paginated chat list (MUST be before /:chatId) */
router.get('/chat/list', authenticate, listChats);

/** GET /api/chats  — paginated chat list (legacy path alias) */
router.get('/chats', authenticate, listChats);

/** GET /api/chat/:chatId  — fetch a single chat with paginated messages */
router.get('/chat/:chatId', authenticate, (req, res, next) => getChat(req, res, next));

/** PATCH /api/chat/:chatId/title  — rename a chat */
router.patch('/chat/:chatId/title', authenticate, renameChat);

/** DELETE /api/chat/:chatId  — delete a chat session */
router.delete('/chat/:chatId', authenticate, removeChatSession);

// ---------------------------------------------------------------------------
// Document routes
// ---------------------------------------------------------------------------

/**
 * GET /api/chat/:chatId/documents/:docId/signed-url
 * Returns a short-lived presigned S3 URL for downloading the original PDF.
 */
router.get(
  '/chat/:chatId/documents/:docId/signed-url',
  authenticate,
  getDocumentSignedUrl
);

export default router;
