import { Request, Response, NextFunction } from 'express';
import {
  createChat,
  getChatById,
  getChatListByUserId,
  getChatWithMessages,
  deleteChat,
  updateChatTitle,
  appendMessagePair,
  getChatHistory,
} from '../services/mongoService';
import {
  generalChatCompletion,
  documentChatCompletion,
  generalChatStream,
  documentChatStream,
} from '../services/aiService';
import { buildRagContext, isPineconeReady } from '../services/ragService';
import type { OllamaMessage } from '../types';

const VALID_USER_TYPES = new Set<string>(['student', 'teacher', 'researcher', 'general']);

// ---------------------------------------------------------------------------
// POST /api/chat/new
// ---------------------------------------------------------------------------

/**
 * Creates a new chat session in MongoDB with an atomic sequential ID.
 *
 * Body (all optional):  { user_id?: string, title?: string }
 * Response 201:         { chat_id, title, user_id, created_at }
 */
export const newChat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { user_id, title } = req.body as { user_id?: string; title?: string };
    const chat = await createChat({ user_id: user_id ?? null, title });
    res.status(201).json({
      chat_id:    chat.chat_id,
      title:      chat.title,
      user_id:    chat.user_id,
      created_at: chat.created_at,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/chat/:chatId
// ---------------------------------------------------------------------------

/**
 * Fetch a single chat session with paginated messages.
 *
 * Query params:  page (default 1), limit (default 50, max 200)
 */
export const getChat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { chatId } = req.params as { chatId: string };
    const page  = parseInt((req.query.page  as string) || '1',  10);
    const limit = parseInt((req.query.limit as string) || '50', 10);

    const result = await getChatWithMessages(chatId, page, limit);
    if (!result) {
      res.status(404).json({ error: 'Chat session not found', chat_id: chatId });
      return;
    }

    if (req.user && result.user_id && req.user.user_id !== result.user_id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/chat/list
// ---------------------------------------------------------------------------

/**
 * Paginated list of chat sessions for a user (metadata only, no messages).
 *
 * Query params:  user_id (required unless JWT present), page, limit, sort
 */
export const listChats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      user_id,
      page  = '1',
      limit = '20',
      sort  = 'updated_at',
    } = req.query as {
      user_id?: string;
      page?:    string;
      limit?:   string;
      sort?:    string;
    };

    // JWT user_id takes precedence to prevent spoofing the query param
    const resolvedUserId = req.user?.user_id ?? user_id;
    if (!resolvedUserId) {
      res.status(400).json({ error: 'user_id query parameter is required' });
      return;
    }

    const sortBy: 'updated_at' | 'created_at' =
      sort === 'created_at' ? 'created_at' : 'updated_at';

    const result = await getChatListByUserId(
      resolvedUserId,
      parseInt(page,  10),
      parseInt(limit, 10),
      sortBy
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/chat/:chatId/title
// ---------------------------------------------------------------------------

/** Update the title of an existing chat session. Body: { title: string } */
export const renameChat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { chatId } = req.params as { chatId: string };
    const { title } = req.body as { title?: string };

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title must be a non-empty string' });
      return;
    }

    if (req.user) {
      const existing = await getChatById(chatId);
      if (!existing) {
        res.status(404).json({ error: 'Chat session not found', chat_id: chatId });
        return;
      }
      if (existing.user_id && req.user.user_id !== existing.user_id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const updated = await updateChatTitle(chatId, title.trim());
    if (!updated) {
      res.status(404).json({ error: 'Chat session not found', chat_id: chatId });
      return;
    }

    res.json({ chat_id: updated.chat_id, title: updated.title });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/chat/:chatId
// ---------------------------------------------------------------------------

/** Delete a chat session and all its messages from MongoDB. */
export const removeChatSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { chatId } = req.params as { chatId: string };

    if (req.user) {
      const existing = await getChatById(chatId);
      if (!existing) {
        res.status(404).json({ error: 'Chat session not found', chat_id: chatId });
        return;
      }
      if (existing.user_id && req.user.user_id !== existing.user_id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    await deleteChat(chatId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/chat/:chatId/message
// ---------------------------------------------------------------------------

/**
 * Send a message and receive an AI response.
 *
 * Mode is determined automatically from the session state:
 *   • chat.documents.length > 0  →  DOCUMENT mode (RAG via ragService)
 *   • chat.documents.length === 0 → GENERAL mode
 *
 * Streaming: set  Accept: text/event-stream  to receive SSE tokens.
 *
 * Body:  { message: string, documentId?: string, userType?: string }
 */
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { chatId } = req.params as { chatId: string };
    const {
      message,
      documentId,
      userType = 'general',
    } = req.body as { message?: string; documentId?: string; userType?: string };

    // ── Input validation ─────────────────────────────────────────────────────
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'message is required and must be a non-empty string' });
      return;
    }

    const validatedUserType = VALID_USER_TYPES.has(userType) ? userType : 'general';
    const trimmedMessage    = message.trim();

    // ── Verify session ───────────────────────────────────────────────────────
    const chat = await getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat session not found', chat_id: chatId });
      return;
    }

    if (req.user && chat.user_id && req.user.user_id !== chat.user_id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // ── Build Ollama-compatible history ──────────────────────────────────────
    const stored = await getChatHistory(chatId);
    const history: OllamaMessage[] = stored.map((m) => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const hasDocuments = chat.documents.length > 0;
    const mode: 'document' | 'general' = hasDocuments ? 'document' : 'general';

    // ── SSE streaming path ───────────────────────────────────────────────────
    if (req.headers['accept']?.includes('text/event-stream')) {
      // Build document context BEFORE writing SSE headers so we can still send
      // plain JSON error responses for validation failures.
      let streamContext = '';
      let streamSources: object[] = [];

      if (hasDocuments) {
        const pineconeReady = await isPineconeReady();
        if (!pineconeReady) {
          res.status(503).json({ error: 'Document service not ready. Check Pinecone config.' });
          return;
        }

        try {
          const rag = await buildRagContext(trimmedMessage, chat.documents, documentId);
          streamContext = rag.context;
          streamSources = rag.sources;
        } catch (ragErr: any) {
          res.status(ragErr.status ?? 404).json({ error: ragErr.message });
          return;
        }
      }

      // Commit to SSE — no plain JSON responses beyond this point
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const sseEvent = (event: string, data: unknown): void => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        let aiResponse = '';

        if (hasDocuments) {
          aiResponse = await documentChatStream(
            trimmedMessage,
            streamContext,
            history,
            (token) => sseEvent('token', { token })
          );
        } else {
          aiResponse = await generalChatStream(
            trimmedMessage,
            history,
            (token) => sseEvent('token', { token })
          );
        }

        await appendMessagePair(chatId, trimmedMessage, aiResponse);

        if (chat.title === 'New Chat' && history.length === 0) {
          const autoTitle = trimmedMessage.slice(0, 60).replace(/\n/g, ' ');
          await updateChatTitle(chatId, autoTitle).catch(() => {});
        }

        const donePayload: Record<string, unknown> = {
          chat_id:   chatId,
          mode,
          userType:  validatedUserType,
          timestamp: new Date().toISOString(),
        };
        if (streamSources.length) donePayload.sources = streamSources;

        sseEvent('done', donePayload);
      } catch {
        sseEvent('error', { message: 'Streaming failed. Please try again.' });
      } finally {
        res.end();
      }
      return;
    }

    // ── Non-streaming (JSON) path ────────────────────────────────────────────
    let aiResponse: string;
    let sources: object[] = [];

    if (hasDocuments) {
      const pineconeReady = await isPineconeReady();
      if (!pineconeReady) {
        res.status(503).json({
          error:   'Service temporarily unavailable.',
          message: 'Document chat service is not ready. Check Pinecone configuration.',
        });
        return;
      }

      const rag = await buildRagContext(trimmedMessage, chat.documents, documentId);
      sources    = rag.sources;
      aiResponse = await documentChatCompletion(trimmedMessage, rag.context, history);
    } else {
      aiResponse = await generalChatCompletion(trimmedMessage, history);
    }

    await appendMessagePair(chatId, trimmedMessage, aiResponse);

    const payload: Record<string, unknown> = {
      chat_id:   chatId,
      response:  aiResponse,
      role:      'assistant',
      mode,
      userType:  validatedUserType,
      timestamp: new Date().toISOString(),
    };
    if (sources.length) payload.sources = sources;

    res.json(payload);
  } catch (err) {
    next(err);
  }
};
