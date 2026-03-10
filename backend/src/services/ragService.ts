/**
 * ragService.ts
 *
 * Orchestrates document retrieval and context assembly for RAG (Retrieval-
 * Augmented Generation) queries.
 *
 * Responsibilities:
 *   – Embed the user query via embeddingService
 *   – Query each target document's Pinecone namespace
 *   – Merge, rank, and truncate retrieved chunks into a context string
 *   – Return the context and cite sources back to the caller
 *
 * Controllers stay thin — they call buildRagContext() and hand the result
 * directly to the AI completion layer.
 */

import { getEmbedding } from './embeddingService';
import { queryDocument, getPinecone } from './pineconeService';
import type { RagResult, Source, DocumentRef } from '../types';

const MAX_CONTEXT_CHARS = 4_000;
const MAX_SOURCES = 8;

/**
 * Returns true when Pinecone is configured and reachable.
 * Use this to guard document-chat endpoints before accepting SSE headers.
 */
export const isPineconeReady = async (): Promise<boolean> => {
  const client = await getPinecone();
  return client !== null;
};

/**
 * Build RAG context for a user query across one or more documents.
 *
 * @param query     The user's question (plain text)
 * @param documents All documents attached to the current chat session
 * @param docId     Optional: restrict retrieval to a single document
 *
 * @throws If no matching documents exist or no relevant chunks are found
 */
export const buildRagContext = async (
  query: string,
  documents: DocumentRef[],
  docId?: string
): Promise<RagResult> => {
  const targetDocs = docId
    ? documents.filter((d) => d.document_id === docId)
    : documents;

  if (targetDocs.length === 0) {
    throw Object.assign(new Error('No matching documents found in this chat.'), { status: 404 });
  }

  const queryEmbedding = await getEmbedding(query);

  // Query each document namespace in parallel; silently skip individual failures
  const chunkResults = await Promise.allSettled(
    targetDocs.map((doc) =>
      queryDocument(queryEmbedding, doc.document_id).then((chunks) =>
        chunks.map((c) => ({ ...c, _docName: doc.file_name, _docId: doc.document_id }))
      )
    )
  );

  const allChunks = chunkResults
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (allChunks.length === 0) {
    throw Object.assign(
      new Error('No relevant content found in the document(s). Try rephrasing.'),
      { status: 404 }
    );
  }

  // Assemble context up to the character limit, tracking which chunks were used
  let context = '';
  const usedChunks: typeof allChunks = [];

  for (const chunk of allChunks) {
    const text = typeof chunk.metadata?.text === 'string' ? chunk.metadata.text : '';
    if (!text) continue;
    if ((context + text).length > MAX_CONTEXT_CHARS) break;
    context += (context ? '\n\n' : '') + text;
    usedChunks.push(chunk);
  }

  const sources: Source[] = usedChunks.slice(0, MAX_SOURCES).map((chunk, i) => {
    const text = typeof chunk.metadata?.text === 'string' ? chunk.metadata.text : '';
    return {
      id:           `src-${Date.now()}-${i}`,
      documentId:   chunk._docId,
      documentName: chunk._docName || 'Document',
      pageNumber:   (chunk.metadata?.page as number) ?? 1,
      excerpt:      text.slice(0, 200) + (text.length > 200 ? '…' : ''),
      confidence:   chunk.score ?? 0.8,
    };
  });

  return { context, sources };
};
