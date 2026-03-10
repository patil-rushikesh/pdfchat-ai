import React from 'react';
import type { Message as MessageType } from '../../types';
import { UserIcon, BrainCircuitIcon } from '../common/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SourceCitation from './SourceCitation';

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
}

const Message = ({ message, isStreaming = false }: MessageProps) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex items-start gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-red-600 text-white shadow-sm mt-0.5">
          <BrainCircuitIcon className="w-4 h-4" />
        </div>
      )}

      <div className={`relative max-w-xl lg:max-w-2xl px-4 py-3 rounded-2xl shadow-sm ${
        isUser
          ? 'bg-slate-900 dark:bg-slate-800 text-white rounded-br-sm'
          : 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-slate-800 rounded-bl-sm'
      }`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
        ) : (
          <>
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-1 prose-headings:my-2 prose-pre:bg-slate-800 dark:prose-pre:bg-slate-950 prose-code:text-red-500 dark:prose-code:text-red-400">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.text}
              </ReactMarkdown>
              {/* Streaming cursor */}
              {isStreaming && message.text && (
                <span className="inline-block w-0.5 h-4 bg-slate-500 dark:bg-slate-400 ml-0.5 align-middle animate-pulse" />
              )}
            </div>
            {message.sources && message.sources.length > 0 && (
              <SourceCitation sources={message.sources} />
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm mt-0.5">
          <UserIcon className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

export default Message;
