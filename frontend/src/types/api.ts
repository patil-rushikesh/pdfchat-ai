/** API request/response type definitions for backend communication. */

export interface SessionInfo {
  chat_id: string;
  title: string;
  user_id: string | null;
  created_at: string;
  updated_at?: string;
  document_count?: number;
  message_count?: number;
}

export interface ChatListResult {
  chats: SessionInfo[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface BackendMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatDetailResult {
  chat_id: string;
  title: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  messages: BackendMessage[];
  documents: Array<{ document_id: string; file_name: string; s3_url: string }>;
  total_messages: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface SendMessageResult {
  chat_id: string;
  mode: 'general' | 'document';
  userType: string;
  timestamp: string;
  sources?: Array<{
    id: string;
    documentId: string;
    documentName: string;
    pageNumber: number;
    excerpt: string;
    confidence: number;
  }>;
}
