/**
 * Shared backend domain types.
 * Import from here to keep type definitions centralised.
 */

/** A message in Ollama's API format. */
export type OllamaMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type UserType = 'student' | 'teacher' | 'researcher' | 'general';

export type ChatMode = 'document' | 'general';

/** A single cited source returned alongside a document-mode AI response. */
export type Source = {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  confidence: number;
};

/** Return value of the RAG context-building step. */
export type RagResult = {
  context: string;
  sources: Source[];
};

/** Document reference stored in a MongoDB chat session. */
export type DocumentRef = {
  document_id: string;
  file_name: string;
  s3_url?: string;
};
