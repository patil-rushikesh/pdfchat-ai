import { Request, Response, NextFunction } from 'express';
import { uploadToS3, isS3Configured } from '../services/s3Service';
import { createDocument } from '../models/documentModel';
import { attachDocumentToChat, getChatById } from '../services/mongoService';
import { embedChunks } from '../services/embeddingService';
import { upsertDocument, getPinecone } from '../services/pineconeService';
import { parsePdf, chunkText } from '../services/pdfService';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * POST /api/chat/:chatId/upload
 *
 * Multipart form-data body:  file=<PDF>  [user_id=<string>]
 *
 * Upload flow:
 *   1. Validate file & chat session
 *   2. Upload buffer → S3  (uploads/chatid_<n>/<filename>.pdf)
 *   3. Insert metadata row → PostgreSQL documents table
 *   4. Attach document reference → MongoDB chat.documents[]
 *   5. Parse + embed + index in Pinecone (best-effort, non-blocking)
 *   6. Return document metadata to client
 */
export const uploadChatDocument = async (
  req: MulterRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // ── S3 availability guard ────────────────────────────────────────────────
    if (!isS3Configured()) {
      res.status(503).json({
        error: 'File storage not configured.',
        message: 'S3_BUCKET_NAME environment variable is not set.',
      });
      return;
    }

    // ── File validation ──────────────────────────────────────────────────────
    if (!req.file) {
      res.status(400).json({ error: 'No file provided. Send a PDF as multipart field "file".' });
      return;
    }

    // MIME-type check (client-supplied, first line of defence)
    if (!req.file.mimetype.includes('pdf') && req.file.mimetype !== 'application/octet-stream') {
      res.status(400).json({ error: 'Only PDF files are accepted.' });
      return;
    }

    // Magic-bytes check — a valid PDF always starts with "%PDF-" (0x25 0x50 0x44 0x46 0x2D)
    const PDF_MAGIC = Buffer.from('%PDF-');
    if (
      req.file.buffer.length < PDF_MAGIC.length ||
      !req.file.buffer.slice(0, PDF_MAGIC.length).equals(PDF_MAGIC)
    ) {
      res.status(400).json({ error: 'File content does not appear to be a valid PDF.' });
      return;
    }

    // Empty-file guard
    if (req.file.size === 0) {
      res.status(400).json({ error: 'Uploaded file is empty.' });
      return;
    }

    // Sanitize the original filename so it is safe for S3 keys and DB storage.
    // Replace anything that is not alphanumeric, dot, hyphen, or underscore.
    const safeFileName = req.file.originalname
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 200)           // cap length
      || 'document.pdf';       // fallback if the name was entirely stripped

    const { chatId } = req.params as { chatId: string };
    const { user_id } = req.body as { user_id?: string };

    // ── Verify chat session exists in MongoDB ────────────────────────────────
    const chat = await getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat session not found', chat_id: chatId });
      return;
    }

    // Ownership check — only the session owner may upload documents
    if (req.user && chat.user_id && req.user.user_id !== chat.user_id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // ── Step 1 — Upload to S3 ────────────────────────────────────────────────
    const { s3_key, s3_url } = await uploadToS3(
      chatId,
      safeFileName,
      req.file.buffer,
      req.file.mimetype
    );

    // ── Step 2 — Store metadata in PostgreSQL ────────────────────────────────
    const docRecord = await createDocument({
      chat_id:   chatId,
      user_id:   req.user?.uid ?? user_id ?? chat.user_id ?? null,
      file_name: safeFileName,
      s3_key,
      s3_url,
      file_size: req.file.size,
    });

    // ── Step 3 — Attach reference to MongoDB chat ────────────────────────────
    await attachDocumentToChat(chatId, {
      document_id: docRecord.id,
      file_name:   docRecord.file_name,
      s3_url:      docRecord.s3_url,
    });

    // ── Step 4 — Index in Pinecone (best-effort, non-blocking) ───────────────
    // We do this after responding so the client isn't blocked by embedding time.
    // Errors here are logged but don't fail the upload.
    setImmediate(async () => {
      const pinecone = await getPinecone();
      if (!pinecone) return;
      try {
        const text = await parsePdf(req.file!.buffer);
        if (text && text.trim().length > 0) {
          const chunks     = chunkText(text);
          const embeddings = await embedChunks(chunks);
          await upsertDocument(embeddings, chunks, docRecord.id);
          console.log(`✅ Pinecone indexed document ${docRecord.id} (${chunks.length} chunks)`);
        }
      } catch (indexErr) {
        console.error(`⚠️  Pinecone indexing failed for ${docRecord.id}:`, (indexErr as Error).message);
      }
    });

    // ── Respond ───────────────────────────────────────────────────────────────
    res.status(201).json({
      document: {
        id:          docRecord.id,
        chat_id:     docRecord.chat_id,
        file_name:   docRecord.file_name,
        s3_url:      docRecord.s3_url,
        s3_key,
        file_size:   docRecord.file_size,
        uploaded_at: docRecord.uploaded_at,
      },
    });
  } catch (err) {
    next(err);
  }
};
