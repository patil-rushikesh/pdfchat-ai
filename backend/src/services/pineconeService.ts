/**
 * pineconeService.ts
 *
 * Manages all Pinecone interactions:
 *   – Lazy singleton initialisation via getPinecone()
 *   – upsertDocument:  store chunk embeddings for a document namespace
 *   – queryDocument:   retrieve top-K chunks for a query embedding
 *
 * All public functions call getPinecone() internally — no client parameter
 * needs to be passed or stored externally.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { ENV } from '../config/env';

let _client: Pinecone | null = null;

/**
 * Returns the shared Pinecone client, initialising it on first call.
 * Returns null if required env vars are absent (non-fatal graceful degradation).
 */
export const getPinecone = async (): Promise<Pinecone | null> => {
  if (_client) return _client;

  if (!ENV.PINECONE_API_KEY || !ENV.PINECONE_INDEX) {
    console.warn('⚠️  PINECONE_API_KEY or PINECONE_INDEX not set — document chat disabled.');
    return null;
  }

  try {
    _client = new Pinecone({ apiKey: ENV.PINECONE_API_KEY });
    console.log('✅ Pinecone initialised');
    return _client;
  } catch (err) {
    console.error('❌ Failed to initialise Pinecone:', err);
    return null;
  }
};

const getIndex = (client: Pinecone) => {
  if (!ENV.PINECONE_INDEX) throw new Error('PINECONE_INDEX env var is not set');
  return client.index(ENV.PINECONE_INDEX);
};

export type PineconeMatch = {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Upserts chunk embeddings for a single document into its own namespace.
 */
export const upsertDocument = async (
  embeddings: number[][],
  chunks: string[],
  docId: string
): Promise<void> => {
  const client = await getPinecone();
  if (!client) throw new Error('Pinecone is not initialised');

  const index = getIndex(client);
  const namespace = index.namespace(docId);

  const vectors = chunks
    .map((chunk, i) => {
      const values = embeddings[i];
      if (!values?.length) throw new Error(`Invalid embedding at index ${i}`);
      return { id: `${docId}-chunk-${i}`, values, metadata: { text: chunk } };
    })
    .filter((v) => v.values.length > 0);

  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    await namespace.upsert(vectors.slice(i, i + BATCH_SIZE));
  }
};

/**
 * Queries a document namespace for the top-K chunks most similar to the embedding.
 */
export const queryDocument = async (
  embedding: number[],
  docId: string,
  topK = 5
): Promise<PineconeMatch[]> => {
  const client = await getPinecone();
  if (!client) throw new Error('Pinecone is not initialised');

  const index = getIndex(client);
  const namespace = index.namespace(docId);

  const result = await namespace.query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return (result.matches ?? []) as PineconeMatch[];
};

// ---------------------------------------------------------------------------
// Legacy exports — kept so callers still compile during incremental migration.
// These forward to the new parameter-free functions.
// ---------------------------------------------------------------------------

/** @deprecated Use getPinecone() */
export const initPinecone = getPinecone;

/** @deprecated Use upsertDocument() */
export const upsertToPinecone = async (
  _client: Pinecone,
  embeddings: number[][],
  chunks: string[],
  docId: string
): Promise<void> => upsertDocument(embeddings, chunks, docId);

/** @deprecated Use queryDocument() */
export const queryPinecone = async (
  _client: Pinecone,
  embedding: number[],
  docId: string,
  topK = 5
): Promise<PineconeMatch[]> => queryDocument(embedding, docId, topK);

