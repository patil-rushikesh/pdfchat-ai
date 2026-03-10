import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import * as apiService from '../services/apiService';
import { storeFile, getFile } from '../services/fileStoreService';
import { MAX_FILE_SIZE_BYTES, GREETING_MESSAGES } from '../constants';
import type { Document, HighlightInfo, ChatSession } from '../types';
import type { SessionInfo, BackendMessage } from '../types/api';

const GREETING_IDS = new Set(Object.values(GREETING_MESSAGES).map((m) => m.id));

export const useChat = () => {
  const { state, dispatch } = useAppContext();
  const { activeDocumentId } = state;

  // ── Toast helpers ────────────────────────────────────────────────────────

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      dispatch({ type: 'ADD_TOAST', payload: { id: Date.now().toString(), message, type } });
    },
    [dispatch]
  );

  // ── Chat session management ──────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    dispatch({ type: 'SET_CHAT_SESSIONS_LOADING', payload: true });
    try {
      const userId = apiService.getUserId();
      const result = await apiService.fetchChatList(userId);
      const sessions: ChatSession[] = result.chats.map((c: SessionInfo) => ({
        chat_id:        c.chat_id,
        title:          c.title,
        user_id:        c.user_id ?? undefined,
        created_at:     c.created_at,
        updated_at:     c.updated_at ?? c.created_at,
        message_count:  c.message_count,
        document_count: c.document_count,
      }));
      dispatch({ type: 'SET_CHAT_SESSIONS', payload: sessions });
    } catch {
      // Non-fatal — sidebar stays empty
    } finally {
      dispatch({ type: 'SET_CHAT_SESSIONS_LOADING', payload: false });
    }
  }, [dispatch]);

  const createNewSession = useCallback(
    async (title?: string): Promise<string> => {
      const userId = apiService.getUserId();
      const session = await apiService.createChatSession(userId, title);
      const chatSession: ChatSession = {
        chat_id:    session.chat_id,
        title:      session.title,
        user_id:    session.user_id ?? undefined,
        created_at: session.created_at,
        updated_at: session.created_at,
      };
      dispatch({ type: 'PREPEND_CHAT_SESSION', payload: chatSession });
      dispatch({ type: 'SET_ACTIVE_CHAT_ID', payload: session.chat_id });
      dispatch({
        type: 'SET_ACTIVE_CHAT_MESSAGES',
        payload: [{ ...GREETING_MESSAGES[state.mode === 'pdf' ? 'pdf' : 'general'] }],
      });
      return session.chat_id;
    },
    [dispatch, state.mode]
  );

  const selectSession = useCallback(
    async (chatId: string) => {
      if (state.activeChatId === chatId) return;
      dispatch({ type: 'SET_ACTIVE_CHAT_ID', payload: chatId });
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const data = await apiService.fetchChatById(chatId);
        if (data.messages.length === 0) {
          dispatch({ type: 'SET_ACTIVE_CHAT_MESSAGES', payload: [{ ...GREETING_MESSAGES.general }] });
        } else {
          const messages = data.messages.map((m: BackendMessage, i: number) => ({
            id:     `${chatId}_msg_${i}`,
            text:   m.content,
            sender: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
          }));
          dispatch({ type: 'SET_ACTIVE_CHAT_MESSAGES', payload: messages });
        }
      } catch {
        showToast('Failed to load chat messages.', 'error');
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [dispatch, showToast, state.activeChatId]
  );

  const deleteSession = useCallback(
    async (chatId: string) => {
      try {
        await apiService.deleteChatSession(chatId);
        dispatch({ type: 'REMOVE_CHAT_SESSION', payload: chatId });
        if (state.activeChatId === chatId) {
          dispatch({ type: 'SET_ACTIVE_CHAT_MESSAGES', payload: [{ ...GREETING_MESSAGES.general }] });
        }
        showToast('Chat deleted.', 'info');
      } catch {
        showToast('Failed to delete chat.', 'error');
      }
    },
    [dispatch, showToast, state.activeChatId]
  );

  // ── File upload ──────────────────────────────────────────────────────────

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast(`File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit.`, 'error');
        return;
      }
      dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: { fileName: file.name, progress: 0, status: 'uploading' } });
      dispatch({ type: 'SET_ERROR', payload: null });
      try {
        let chatId = state.activeChatId;
        if (!chatId) {
          chatId = await createNewSession(`PDF: ${file.name.slice(0, 40)}`);
        }
        const response = await apiService.uploadFileToChatSession(chatId, file, (progress) => {
          dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', payload: { progress } });
        });
        dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', payload: { status: 'processing', progress: 100 } });
        const newDocument: Document = { id: response.document.id, name: response.document.name || file.name };
        storeFile(newDocument.id, file);
        dispatch({ type: 'ADD_DOCUMENT', payload: newDocument });
        dispatch({ type: 'SET_ACTIVE_DOCUMENT', payload: newDocument.id });
        dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', payload: { status: 'complete', progress: 100 } });
        showToast(`'${newDocument.name}' uploaded!`, 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        dispatch({ type: 'SET_ERROR', payload: msg });
        dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', payload: { status: 'error', error: msg } });
        showToast(msg, 'error');
      } finally {
        setTimeout(() => dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: null }), 2500);
      }
    },
    [dispatch, showToast, state.activeChatId, createNewSession]
  );

  const setActiveDocument = useCallback(
    (docId: string | null) => {
      dispatch({ type: 'SET_ACTIVE_DOCUMENT', payload: docId });
      if (state.previewingDocument) dispatch({ type: 'HIDE_PREVIEW' });
    },
    [dispatch, state.previewingDocument]
  );

  // ── Send message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMessage = { id: Date.now().toString(), text, sender: 'user' as const };
      dispatch({ type: 'ADD_USER_MESSAGE', payload: userMessage });
      const aiMessageId = (Date.now() + 1).toString();
      dispatch({ type: 'START_AI_RESPONSE', payload: { id: aiMessageId } });

      try {
        if (state.mode === 'youtube') {
          if (!state.youtubeUrl) { showToast('Please paste a YouTube URL first.', 'error'); return; }
          dispatch({ type: 'APPEND_AI_RESPONSE', payload: { id: aiMessageId, chunk: `YouTube analysis coming soon.` } });
          return;
        }
        if (state.mode === 'site') {
          if (!state.siteUrl) { showToast('Please enter a website URL first.', 'error'); return; }
          dispatch({ type: 'APPEND_AI_RESPONSE', payload: { id: aiMessageId, chunk: `Website analysis coming soon.` } });
          return;
        }

        // PDF / General → session-based API with SSE streaming
        let chatId = state.activeChatId;
        if (!chatId) {
          chatId = await createNewSession();
        }

        const isFirstMessage = state.messages.every((m) => GREETING_IDS.has(m.id));

        const result = await apiService.sendSessionMessage(chatId, text, (chunk) => {
          dispatch({ type: 'APPEND_AI_RESPONSE', payload: { id: aiMessageId, chunk } });
        });

        if (result.sources?.length) {
          dispatch({ type: 'ADD_SOURCES_TO_MESSAGE', payload: { messageId: aiMessageId, sources: result.sources } });
        }

        if (isFirstMessage) {
          const autoTitle = text.slice(0, 55).replace(/\n/g, ' ');
          dispatch({ type: 'UPDATE_CHAT_SESSION_TITLE', payload: { chat_id: chatId, title: autoTitle } });
          apiService.renameChatSession(chatId, autoTitle).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to get AI response';
        dispatch({ type: 'SET_ERROR', payload: msg });
        showToast(msg, 'error');
      } finally {
        dispatch({ type: 'FINISH_AI_RESPONSE' });
      }
    },
    [dispatch, showToast, state.activeChatId, state.messages, state.mode, state.siteUrl, state.youtubeUrl, createNewSession]
  );

  // ── Document preview ─────────────────────────────────────────────────────

  const showPreview = useCallback(
    (docOrId: Document | string, highlightInfo?: HighlightInfo) => {
      const doc =
        typeof docOrId === 'string' ? state.documents.find((d: Document) => d.id === docOrId) : docOrId;
      if (!doc) { showToast('Document not found', 'error'); return; }
      const file = getFile(doc.id);
      if (file) {
        dispatch({ type: 'SHOW_PREVIEW', payload: { ...doc, fileUrl: URL.createObjectURL(file), highlightInfo } });
      } else {
        showToast('File not found. Please re-upload.', 'error');
      }
    },
    [dispatch, showToast, state.documents]
  );

  const hidePreview = useCallback(() => {
    if (state.previewingDocument?.fileUrl) URL.revokeObjectURL(state.previewingDocument.fileUrl);
    dispatch({ type: 'HIDE_PREVIEW' });
  }, [dispatch, state.previewingDocument]);

  return {
    ...state,
    uploadFile,
    sendMessage,
    setActiveDocument,
    showPreview,
    hidePreview,
    loadSessions,
    createNewSession,
    selectSession,
    deleteSession,
    showToast,
  };
};
