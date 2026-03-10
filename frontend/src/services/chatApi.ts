/**
 * chatApi.ts
 *
 * Chat session CRUD and AI message sending (SSE streaming).
 */

import axios from 'axios';
import { authHeader } from './authApi';
import type { SessionInfo, ChatListResult, ChatDetailResult, SendMessageResult } from '../types/api';

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3001';

const apiClient = axios.create({ baseURL: `${API_BASE_URL}/api` });

// Attach the JWT on every outgoing request
apiClient.interceptors.request.use(async (config) => {
  const header = await authHeader();
  if (header) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = header;
  }
  return config;
});

/** Create a new chat session. */
export const createChatSession = async (
  userId: string,
  title?: string
): Promise<SessionInfo> => {
  const res = await apiClient.post('/chat/new', { user_id: userId, title });
  return res.data;
};

/** Fetch a paginated list of chat sessions for the user. */
export const fetchChatList = async (
  userId: string,
  page  = 1,
  limit = 30
): Promise<ChatListResult> => {
  const res = await apiClient.get('/chat/list', {
    params: { user_id: userId, page, limit },
  });
  return res.data;
};

/** Fetch a single chat with paginated messages. */
export const fetchChatById = async (
  chatId: string,
  page  = 1,
  limit = 100
): Promise<ChatDetailResult> => {
  const res = await apiClient.get(`/chat/${chatId}`, { params: { page, limit } });
  return res.data;
};

/**
 * Send a message to a chat session using SSE streaming.
 * Falls back to full-JSON when SSE is not returned by the server.
 *
 * @param chatId   Target chat session ID
 * @param message  User message text
 * @param onChunk  Called with each streamed token
 */
export const sendSessionMessage = async (
  chatId: string,
  message: string,
  onChunk: (chunk: string) => void
): Promise<SendMessageResult> => {
  const response = await fetch(`${API_BASE_URL}/api/chat/${chatId}/message`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'text/event-stream',
      'Authorization': await authHeader(),
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Request failed' })) as Record<string, unknown>;
    throw new Error((err.error as string) || (err.message as string) || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';

  // Non-SSE fallback (plain JSON response)
  if (!contentType.includes('text/event-stream')) {
    const data = await response.json();
    onChunk((data as any).response ?? '');
    return data;
  }

  // SSE stream parsing
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer       = '';
  let currentEvent = '';
  let doneData: SendMessageResult = {
    chat_id:   chatId,
    mode:      'general',
    userType:  'general',
    timestamp: new Date().toISOString(),
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === 'token' && data.token)  { onChunk(data.token); }
          else if (currentEvent === 'done')             { doneData = data; }
          else if (currentEvent === 'error')            { throw new Error(data.message || 'Stream error'); }
        } catch (e) {
          if (currentEvent === 'error') throw e;
        }
        currentEvent = '';
      }
    }
  }

  return doneData;
};

/** Delete a chat session and all its messages. */
export const deleteChatSession = async (chatId: string): Promise<void> => {
  await apiClient.delete(`/chat/${chatId}`);
};

/** Rename a chat session. */
export const renameChatSession = async (chatId: string, title: string): Promise<void> => {
  await apiClient.patch(`/chat/${chatId}/title`, { title });
};
