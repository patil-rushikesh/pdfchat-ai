import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useAppContext } from '../../context/AppContext';
import Message from './Message';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import WelcomeScreen from './WelcomeScreen';
import ComingSoonOverlay from '../common/ComingSoonOverlay';
import { FileTextIcon, UploadCloudIcon } from '../common/icons';

const ChatPanel = () => {
  const { messages, isStreaming, activeDocumentId, documents, uploadFile } = useChat();
  const { state } = useAppContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const activeDocument = documents.find(d => d.id === activeDocumentId);
  const activeSession  = state.chatSessions.find(s => s.chat_id === state.activeChatId);

  // Check if we should show welcome screen (only greeting message exists)
  const shouldShowWelcome = messages.length === 1 && messages[0].id.includes('greeting');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  const lastAiMsgId = [...messages].reverse().find(m => m.sender === 'ai')?.id;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white dark:bg-slate-950 relative">
      {/* Coming Soon Overlay for youtube/site modes */}
      <ComingSoonOverlay
        mode={state.mode}
        isVisible={state.mode !== 'pdf' && state.mode !== 'general'}
      />

      {/* ── Chat Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between h-12 px-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="flex items-center gap-2 min-w-0">
          {activeSession ? (
            <>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                {activeSession.title}
              </span>
              {activeSession.document_count ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] font-medium flex-shrink-0">
                  <FileTextIcon className="w-2.5 h-2.5" />
                  {activeSession.document_count} doc{activeSession.document_count > 1 ? 's' : ''}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-500">
              {state.mode === 'general' ? 'General Chat' : state.mode === 'pdf' ? 'PDF Chat' : 'PaperMind AI'}
            </span>
          )}
        </div>

        {/* Upload PDF button in header — only for pdf mode or active session */}
        {(state.mode === 'pdf' || state.activeChatId) && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <UploadCloudIcon className="w-3.5 h-3.5" />
              Upload PDF
            </button>
          </>
        )}
      </div>

      {/* URL Prompts */}
      {!shouldShowWelcome && state.mode === 'youtube' && !state.youtubeUrl && (
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto px-4 py-6"><YouTubeUrlPrompt /></div>
        </div>
      )}
      {!shouldShowWelcome && state.mode === 'site' && !state.siteUrl && (
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto px-4 py-6"><SiteUrlPrompt /></div>
        </div>
      )}

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        {shouldShowWelcome ? (
          <div className="animate-fade-in">
            <WelcomeScreen mode={state.mode} hasDocument={!!activeDocument} />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4">
            <div className="space-y-6 py-6">
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
                >
                  <Message
                    message={msg}
                    isStreaming={isStreaming && msg.id === lastAiMsgId}
                  />
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.sender !== 'ai' && (
                <TypingIndicator />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
        <MessageInput />
      </div>
    </div>
  );
};

export default ChatPanel;

// Inline prompt components for URLs
const YouTubeUrlPrompt: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [val, setVal] = useState(state.youtubeUrl ?? '');
  const onSave = () => dispatch({ type: 'SET_YOUTUBE_URL', payload: val || null });
  
  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">YouTube Video URL</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Enter a YouTube URL to analyze the video content</p>
      </div>
      <div className="flex gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="input-modern flex-1"
        />
        <button 
          onClick={onSave} 
          className="btn-primary"
        >
          Set URL
        </button>
      </div>
    </div>
  );
};

const SiteUrlPrompt: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [val, setVal] = useState(state.siteUrl ?? '');
  const onSave = () => dispatch({ type: 'SET_SITE_URL', payload: val || null });
  
  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">Website URL</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Enter a website URL to analyze the content</p>
      </div>
      <div className="flex gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="https://example.com"
          className="input-modern flex-1"
        />
        <button 
          onClick={onSave} 
          className="btn-primary"
        >
          Set URL
        </button>
      </div>
    </div>
  );
};
