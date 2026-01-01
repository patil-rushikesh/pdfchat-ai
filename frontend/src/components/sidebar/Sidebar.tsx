
import React, { useState } from 'react';
import DocumentList from './DocumentList';
import { 
  BrainCircuitIcon, 
  PlusIcon, 
  MessageCircleIcon, 
  YoutubeIcon, 
  FileTextIcon, 
  GlobeIcon 
} from '../common/icons';
import { useAppContext } from '../../context/AppContext';

const Sidebar = () => {
  const [isNewChatHovered, setIsNewChatHovered] = useState(false);
  const { state, dispatch } = useAppContext();

  const modes = [
    { key: 'general', label: 'General', icon: MessageCircleIcon, description: 'Chat with AI' },
    { key: 'pdf', label: 'PDF', icon: FileTextIcon, description: 'Chat with docs' },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
      {/* App Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 text-white rounded-lg flex items-center justify-center flex-shrink-0">
            <BrainCircuitIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">PdfChat</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">AI Assistant</p>
          </div>
        </div>
      </div>
      
      {/* New Chat Button */}
      <div className="p-4">
        <button 
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-lg flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md group font-medium"
          onMouseEnter={() => setIsNewChatHovered(true)}
          onMouseLeave={() => setIsNewChatHovered(false)}
        >
          <PlusIcon className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
          <span>New Chat</span>
          {isNewChatHovered && (
            <span className="text-xs opacity-75 ml-auto">⌘N</span>
          )}
        </button>
      </div>

      {/* Chat Modes */}
      <div className="px-4 pb-4">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-3">
          Chat Modes
        </div>
        <div className="space-y-2">
          {modes.map((mode) => {
            const isActive = state.mode === (mode.key as any);
            const Icon = mode.icon;
            return (
              <button
                key={mode.key}
                onClick={() => {
                  dispatch({ type: 'SET_MODE', payload: mode.key as any });
                  try {
                    const url = `/${mode.key}`;
                    if (window.location.pathname !== url) {
                      window.history.pushState({}, '', url);
                    }
                  } catch (e) {}
                }}
                className={`w-full p-3 rounded-lg text-left transition-all duration-200 group relative overflow-hidden
                  ${isActive
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-red-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm`}>
                      {mode.label}
                    </div>
                    <div className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                      {mode.description}
                    </div>
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Documents Section - Only show for PDF mode */}
      {state.mode === 'pdf' && (
        <div className="flex-grow overflow-y-auto px-4 pb-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-3">
            Your Documents
          </div>
          <div className="space-y-3">
            <DocumentList />
          </div>
        </div>
      )}

      {/* Spacer for non-PDF modes */}
      {state.mode !== 'pdf' && <div className="flex-grow" />}
    </div>
  );
};

export default Sidebar;
