/** Application-level state shape managed by AppContext. */

import type {
  Document,
  Message,
  Toast,
  UploadProgress,
  Theme,
  UserType,
  ChatMode,
  ChatSession,
} from './domain';

export interface AppState {
  documents: Document[];
  activeDocumentId: string | null;
  previewingDocument: Document | null;
  messages: Message[];
  messagesByMode?: Record<ChatMode, Message[]>;
  messagesByDocument?: Record<string, Message[]>;
  isLoading: boolean;
  isStreaming: boolean;
  uploadProgress: UploadProgress | null;
  theme: Theme;
  userType: UserType;
  mode: ChatMode;
  youtubeUrl?: string | null;
  siteUrl?: string | null;
  error: string | null;
  toasts: Toast[];
  chatSessions: ChatSession[];
  activeChatId: string | null;
  chatSessionsLoading: boolean;
}
