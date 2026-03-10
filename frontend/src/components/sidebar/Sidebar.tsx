
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useChat } from '../../hooks/useChat';
import { useAppContext } from '../../context/AppContext';
import { BrainCircuitIcon, PlusIcon, TrashIcon, MessageCircleIcon, FileTextIcon } from '../common/icons';
import type { ChatSession } from '../../types';

// ── Relative time helper ────────────────────────────────────────────────────
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)   return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

const Sidebar = () => {
  const { state, dispatch } = useAppContext();
  const { loadSessions, createNewSession, selectSession, deleteSession } = useChat();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load chat list on mount
  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewChat = async () => {
    try {
      await createNewSession();
      // Switch mode to general if not already in a chat-friendly mode
      if (state.mode !== 'pdf' && state.mode !== 'general') {
        dispatch({ type: 'SET_MODE', payload: 'general' });
      }
    } catch {
      // toast handled inside createNewSession
    }
  };

  const handleSelectChat = (session: ChatSession) => {
    selectSession(session.chat_id);
  };

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setDeletingId(chatId);
    try {
      await deleteSession(chatId);
    } finally {
      setDeletingId(null);
    }
  };

  const modes = [
    { key: 'general', label: 'General', icon: MessageCircleIcon },
    { key: 'pdf',     label: 'PDF Chat', icon: FileTextIcon },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white select-none">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
          <BrainCircuitIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">PaperMind AI</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Your AI document assistant</p>
        </div>
      </div>

      {/* ── New Chat Button ── */}
      <div className="px-3 py-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-sm font-medium border border-slate-700 hover:border-slate-600 transition-all duration-150 group"
        >
          <PlusIcon className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-white transition-colors" />
          New Chat
        </button>
      </div>

      {/* ── Mode Pills ── */}
      <div className="px-3 pb-3 flex gap-1.5">
        {modes.map((m) => {
          const isActive = state.mode === m.key;
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => {
                dispatch({ type: 'SET_MODE', payload: m.key as any });
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="px-3 mb-1">
        <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest">Recent chats</p>
      </div>

      {/* ── Chat History List ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent px-2 pb-4 space-y-0.5">
        {state.chatSessionsLoading ? (
          /* Skeleton loading */
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg animate-pulse">
              <div className="w-7 h-7 bg-slate-800 rounded-md flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-800 rounded w-3/4" />
                <div className="h-2 bg-slate-800/60 rounded w-1/3" />
              </div>
            </div>
          ))
        ) : state.chatSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
              <MessageCircleIcon className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-xs text-slate-500">No chats yet.</p>
            <p className="text-xs text-slate-600 mt-1">Click "New Chat" to get started.</p>
          </div>
        ) : (
          state.chatSessions.map((session) => {
            const isActive = state.activeChatId === session.chat_id;
            const isDeleting = deletingId === session.chat_id;
            return (
              <button
                key={session.chat_id}
                onClick={() => handleSelectChat(session)}
                className={`w-full group flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 relative ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-red-500 rounded-r" />
                )}

                <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isActive ? 'bg-red-600/20 text-red-400' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'
                }`}>
                  <MessageCircleIcon className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate leading-tight ${isActive ? 'text-white' : ''}`}>
                    {session.title}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {timeAgo(session.updated_at || session.created_at)}
                    {session.document_count ? ` · ${session.document_count} doc${session.document_count > 1 ? 's' : ''}` : ''}
                  </p>
                </div>

                {/* Delete button */}
                {!isDeleting && (
                  <button
                    onClick={(e) => handleDelete(e, session.chat_id)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-all duration-150 mt-0.5"
                    title="Delete chat"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                )}
                {isDeleting && (
                  <div className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border border-slate-600 border-t-slate-400 animate-spin" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
