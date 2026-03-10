/** Core domain types — user-facing entities. */

export type Sender = 'user' | 'ai';

export interface ChatSession {
  chat_id: string;
  title: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  document_count?: number;
}

export interface MessageSource {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  sources?: MessageSource[];
}

export interface HighlightInfo {
  pageNumber: number;
  startIndex?: number;
  endIndex?: number;
  excerpt: string;
}

export interface Document {
  id: string;
  name: string;
  /** Generated on-demand for PDF preview; not persisted. */
  fileUrl?: string;
  highlightInfo?: HighlightInfo;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface UploadProgress {
  fileName: string;
  progress: number; // 0–100
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export type Theme = 'dark' | 'light' | 'blue' | 'green' | 'purple' | 'orange';
export type UserType = 'student' | 'teacher' | 'researcher' | 'general';
export type ChatMode = 'pdf' | 'general' | 'youtube' | 'site';
