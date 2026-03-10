/**
 * embeddingService.ts
 *
 * Generates vector embeddings for text using the local Ollama API.
 * These embeddings are used to index documents in Pinecone and to
 * query for relevant chunks during RAG retrieval.
 */

import axios from 'axios';
import { ENV } from '../config/env';

const EMBEDDING_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const BATCH_CONCURRENCY = 5;

/**
 * Generates a single vector embedding for the given text.
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
  try {
    const res = await axios.post(`${ENV.OLLAMA_URL}/api/embeddings`, {
      model: EMBEDDING_MODEL,
      prompt: text,
    });
    return res.data.embedding as number[];
  } catch (err) {
    console.error('Embedding error:', err);
    throw new Error('Failed to generate embedding');
  }
};

/**
 * Generates vector embeddings for each chunk in the array.
 * Processes chunks in batches to avoid overwhelming the Ollama API.
 */
export const embedChunks = async (chunks: string[]): Promise<number[][]> => {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_CONCURRENCY) {
    const batch = chunks.slice(i, i + BATCH_CONCURRENCY);

    const batchEmbeddings = await Promise.all(
      batch.map(async (chunk) => {
        const res = await axios.post(`${ENV.OLLAMA_URL}/api/embeddings`, {
          model: EMBEDDING_MODEL,
          prompt: chunk,
        });
        return res.data.embedding as number[];
      })
    );

    allEmbeddings.push(...batchEmbeddings);

    // Brief pause between batches to avoid overloading Ollama
    if (i + BATCH_CONCURRENCY < chunks.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return allEmbeddings;
};

// Alias kept for callers that imported the old name from geminiService
export const getEmbeddings = getEmbedding;
