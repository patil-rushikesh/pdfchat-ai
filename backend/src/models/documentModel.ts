import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/postgres';

export interface DocumentRecord {
  id: string;
  chat_id: string;
  user_id: string | null;
  file_name: string;
  s3_key: string;
  s3_url: string;
  file_size: number;
  uploaded_at: Date;
}

export interface CreateDocumentInput {
  chat_id: string;
  user_id?: string | null;
  file_name: string;
  s3_key: string;
  s3_url: string;
  file_size: number;
}

/**
 * Insert a new document metadata record and return it.
 */
export const createDocument = async (
  input: CreateDocumentInput
): Promise<DocumentRecord> => {
  const id = uuidv4();
  const rows = await query<DocumentRecord>(
    `INSERT INTO documents (id, chat_id, user_id, file_name, s3_key, s3_url, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, input.chat_id, input.user_id ?? null, input.file_name, input.s3_key, input.s3_url, input.file_size]
  );
  if (!rows[0]) throw new Error('Document insert returned no rows');
  return rows[0];
};

/**
 * Fetch all documents belonging to a specific chat session.
 */
export const getDocumentsByChatId = async (
  chatId: string
): Promise<DocumentRecord[]> => {
  return query<DocumentRecord>(
    'SELECT * FROM documents WHERE chat_id = $1 ORDER BY uploaded_at ASC',
    [chatId]
  );
};

/**
 * Fetch a single document by its UUID.
 */
export const getDocumentById = async (
  id: string
): Promise<DocumentRecord | null> => {
  const rows = await query<DocumentRecord>(
    'SELECT * FROM documents WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
};

/**
 * Fetch all documents uploaded by a specific user.
 */
export const getDocumentsByUserId = async (
  userId: string
): Promise<DocumentRecord[]> => {
  return query<DocumentRecord>(
    'SELECT * FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC',
    [userId]
  );
};

/**
 * Delete a document metadata record. Does NOT delete the S3 object.
 */
export const deleteDocument = async (id: string): Promise<void> => {
  await query('DELETE FROM documents WHERE id = $1', [id]);
};
