import React from 'react';
import type { Message as MessageType } from '../../types';
import { UserIcon, BrainCircuitIcon } from '../common/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SourceCitation from './SourceCitation';

interface MessageProps {
  message: MessageType;
}

const Message = ({ message }: MessageProps) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex items-start gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-red-600 text-white shadow-sm">
          <BrainCircuitIcon className="w-5 h-5" />
        </div>
      )}

      <div className={`max-w-xl lg:max-w-3xl px-4 py-3 rounded-2xl shadow-sm transition-all duration-200 ${
        isUser 
          ? 'message-user rounded-br-lg' 
          : 'message-ai rounded-bl-lg'
      }`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        ) : (
          <>
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-900 dark:text-white">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.text}
              </ReactMarkdown>
            </div>
            {message.sources && message.sources.length > 0 && (
              <SourceCitation sources={message.sources} />
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm">  
          <UserIcon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
};

export default Message;
