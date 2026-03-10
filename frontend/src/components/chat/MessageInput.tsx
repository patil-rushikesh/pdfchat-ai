import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../../hooks/useChat';
import { SendIcon, PaperclipIcon } from '../common/icons';
import { useAppContext } from '../../context/AppContext';

const MessageInput = () => {
  const [text, setText] = useState('');
  const { sendMessage, isStreaming, uploadFile } = useChat();
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state } = useAppContext();

  const isPdfMode     = state.mode === 'pdf';
  const isGeneralMode = state.mode === 'general';
  const isYouTubeMode = state.mode === 'youtube';
  const isSiteMode    = state.mode === 'site';

  const canSend =
    isGeneralMode ||
    isPdfMode ||
    (isYouTubeMode && !!state.youtubeUrl) ||
    (isSiteMode && !!state.siteUrl);

  const isDisabled = isStreaming || !canSend;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isDisabled) {
      sendMessage(text);
      setText('');
    }
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = '';
    },
    [uploadFile]
  );

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [text]);

  const placeholder = (() => {
    if (isPdfMode)     return 'Ask about your document…';
    if (isGeneralMode) return 'Message PaperMind AI…';
    if (isYouTubeMode) return state.youtubeUrl ? 'Ask about the YouTube video…' : 'Paste a YouTube URL above first';
    if (isSiteMode)    return state.siteUrl ? 'Ask about the website…' : 'Enter a website URL above first';
    return 'Message PaperMind AI…';
  })();

  return (
    <div className="px-4 py-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl"
      >
        <div className="relative flex items-end gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-slate-300 dark:focus-within:border-slate-600 transition-all duration-200 px-3 py-2">

          {/* PDF Upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            title="Attach PDF"
            className="flex-shrink-0 self-end mb-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <PaperclipIcon className="w-4 h-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none text-sm leading-6 py-1 min-h-[28px] max-h-[200px]"
            rows={1}
            disabled={isDisabled && !text.trim()}
          />

          {/* Send / Stop button */}
          <button
            type="submit"
            disabled={isDisabled || !text.trim()}
            className={`flex-shrink-0 self-end mb-0.5 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
              !isDisabled && text.trim()
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
            aria-label="Send message"
          >
            <SendIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-600">
          PaperMind AI can make mistakes. Verify important information.
        </p>
      </form>
    </div>
  );
};

export default MessageInput;

