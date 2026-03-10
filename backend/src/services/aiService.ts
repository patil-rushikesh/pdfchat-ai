/**
 * aiService.ts
 *
 * Two explicit AI completion modes:
 *
 *   generalChatCompletion  — standard LLM conversation, no document context
 *   documentChatCompletion — RAG mode: answer grounded in retrieved document chunks
 *
 * Both call the local Ollama API but with distinct system prompts so the model
 * behaves appropriately for each mode.
 */

import axios from 'axios';

const OLLAMA_URL  = process.env.OLLAMA_URL  || 'http://localhost:11434';
const CHAT_MODEL  = process.env.OLLAMA_CHAT_MODEL || 'llama3.2:3b';

export type OllamaMessage = { role: string; content: string };

// ---------------------------------------------------------------------------
// Mode 1 — General Chat
// ---------------------------------------------------------------------------

const GENERAL_SYSTEM_PROMPT = `\
You are PaperMind AI, a helpful and knowledgeable assistant.

RULES:
- Answer the user's question clearly and concisely.
- You may use your general knowledge freely.
- If you are unsure, say so — do not make up facts.
- Be conversational and friendly.`;

/**
 * Standard LLM conversation with no document context.
 *
 * @param message - The user's latest message
 * @param history - Prior turns in { role, content } format (Ollama-compatible)
 */
export const generalChatCompletion = async (
  message: string,
  history: OllamaMessage[]
): Promise<string> => {
  const messages: OllamaMessage[] = [
    { role: 'system', content: GENERAL_SYSTEM_PROMPT },
    ...history,
    { role: 'user',   content: message },
  ];

  try {
    const res = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model:  CHAT_MODEL,
      messages,
      stream: false,
    });
    return res.data.message.content as string;
  } catch (err) {
    console.error('General chat completion error:', err);
    throw new Error('Ollama general chat failed');
  }
};

// ---------------------------------------------------------------------------
// Mode 2 — Document Chat (RAG)
// ---------------------------------------------------------------------------

const DOCUMENT_SYSTEM_PROMPT = `\
You are PaperMind AI, a precise document-analysis assistant.

RULES:
1. Base your answer ONLY on the DOCUMENT CONTEXT provided below.
2. If the answer is not present in the context, say: "I couldn't find that information in the document."
3. Do NOT use outside knowledge or hallucinate facts.
4. Quote or paraphrase from the context when helpful.
5. Be concise and accurate.`;

/**
 * RAG-mode completion: answer is grounded in retrieved document chunks.
 *
 * @param message - The user's latest message
 * @param context - Concatenated relevant chunks from Pinecone
 * @param history - Prior turns in { role, content } format
 */
export const documentChatCompletion = async (
  message: string,
  context: string,
  history: OllamaMessage[]
): Promise<string> => {
  const userPrompt = `DOCUMENT CONTEXT:\n${context}\n\nQUESTION:\n${message}`;

  const messages: OllamaMessage[] = [
    { role: 'system', content: DOCUMENT_SYSTEM_PROMPT },
    ...history,
    { role: 'user',   content: userPrompt },
  ];

  try {
    const res = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model:  CHAT_MODEL,
      messages,
      stream: false,
    });
    return res.data.message.content as string;
  } catch (err) {
    console.error('Document chat completion error:', err);
    throw new Error('Ollama document chat failed');
  }
};

// ---------------------------------------------------------------------------
// Streaming variants — used by the SSE endpoint
// ---------------------------------------------------------------------------

type OllamaStreamChunk = {
  message?: { content?: string };
  done?:    boolean;
};

/**
 * Stream a general chat completion token-by-token.
 * Calls `onToken` for each partial piece. Returns the full assembled text.
 */
export const generalChatStream = async (
  message: string,
  history: OllamaMessage[],
  onToken: (token: string) => void
): Promise<string> => {
  const messages: OllamaMessage[] = [
    { role: 'system', content: GENERAL_SYSTEM_PROMPT },
    ...history,
    { role: 'user',   content: message },
  ];

  const resp = await axios.post(
    `${OLLAMA_URL}/api/chat`,
    { model: CHAT_MODEL, messages, stream: true },
    { responseType: 'stream' }
  );

  let full = '';
  let buf  = '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = resp.data as any;

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf-8');
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as OllamaStreamChunk;
          const token = json.message?.content ?? '';
          if (token) { onToken(token); full += token; }
        } catch { /* skip malformed NDJSON */ }
      }
    });
    stream.on('end',   resolve);
    stream.on('error', reject);
  });

  return full;
};

/**
 * Stream a document-mode (RAG) completion token-by-token.
 */
export const documentChatStream = async (
  message: string,
  context: string,
  history: OllamaMessage[],
  onToken: (token: string) => void
): Promise<string> => {
  const userPrompt = `DOCUMENT CONTEXT:\n${context}\n\nQUESTION:\n${message}`;

  const messages: OllamaMessage[] = [
    { role: 'system', content: DOCUMENT_SYSTEM_PROMPT },
    ...history,
    { role: 'user',   content: userPrompt },
  ];

  const resp = await axios.post(
    `${OLLAMA_URL}/api/chat`,
    { model: CHAT_MODEL, messages, stream: true },
    { responseType: 'stream' }
  );

  let full = '';
  let buf  = '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = resp.data as any;

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf-8');
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as OllamaStreamChunk;
          const token = json.message?.content ?? '';
          if (token) { onToken(token); full += token; }
        } catch { /* skip */ }
      }
    });
    stream.on('end',   resolve);
    stream.on('error', reject);
  });

  return full;
};
