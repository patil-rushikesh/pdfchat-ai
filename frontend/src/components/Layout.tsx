import { useState } from 'react';
import Sidebar from './sidebar/Sidebar';
import ChatPanel from './chat/ChatPanel';
import DocumentPreviewPanel from './chat/DocumentPreviewPanel';
import { SidebarIcon, PanelLeftCloseIcon } from './common/icons';
import { useChat } from '../hooks/useChat';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { previewingDocument, hidePreview } = useChat();

  return (
    <div className="flex h-screen w-full relative overflow-hidden bg-white dark:bg-slate-950">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-10"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Mobile Sidebar Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className="md:hidden absolute top-4 left-4 z-30 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isSidebarOpen ? (
          <PanelLeftCloseIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        ) : (
          <SidebarIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        )}
      </button>

      {/* Desktop Sidebar Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className={`hidden md:flex absolute top-4 z-30 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 items-center justify-center group ${
          isSidebarOpen ? 'left-64' : 'left-4'
        }`}
        aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isSidebarOpen ? (
          <PanelLeftCloseIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
        ) : (
          <SidebarIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
        )}
      </button>

      {/* Sidebar */}
      {isSidebarOpen && (
        <div className="
          absolute md:relative
          h-full w-72 lg:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
          transition-all duration-300 ease-in-out z-20 flex-shrink-0
          animate-slide-in-right md:animate-fade-in
        ">
          <Sidebar />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0">
        <main className={`flex-1 transition-all duration-500 ease-in-out ${
          previewingDocument 
            ? 'mr-0 md:mr-[50%] lg:mr-[40%] xl:mr-[25%]' 
            : 'mr-0'
        }`}>
          <ChatPanel />
        </main>
      </div>

      {/* Document Preview Panel */}
      <DocumentPreviewPanel doc={previewingDocument} onClose={hidePreview} />
    </div>
  );
};

export default Layout;
