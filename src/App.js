import React, { useRef, useEffect, useCallback } from 'react';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';
import FileExplorer from './components/FileExplorer';
import MainEditor from './components/MainEditor';
import ChatPanel from './components/ChatPanel';
import TerminalPanel from './components/TerminalPanel';
import ResizeHandle from './components/ResizeHandle';

const VSCodeInterface = () => {
  const { theme, colors } = useTheme();
  const { state, actions } = useAppState();
  
  // Extract state from context
  const {
    selectedFile,
    availableFiles,
    openTabs,
    excelFiles,
    chatInput,
    panelSizes,
    isTerminalVisible
  } = state;
  
  // Extract actions from context
  const {
    setSelectedFile,
    setAvailableFiles,
    updateTabs,
    setExcelData,
    setChatInput,
    setPanelSizes,
    toggleTerminal
  } = actions;
  
  const fileExplorerRef = useRef(null);
  const containerRef = useRef(null);
  
  // Extract panel sizes from context
  const { leftPanelWidth, rightPanelWidth, bottomPanelHeight } = panelSizes;

  // Simple resize handlers
  const handleLeftMouseDown = useCallback((e) => {
    e.preventDefault();
    actions.setResizing(true);
    
    const handleMouseMove = (e) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      actions.setPanelSizes({ leftPanelWidth: newWidth });
    };
    
    const handleMouseUp = () => {
      actions.setResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [actions]);

  const handleRightMouseDown = useCallback((e) => {
    e.preventDefault();
    actions.setResizing(true);
    
    const handleMouseMove = (e) => {
      const containerWidth = containerRef.current?.offsetWidth || 1200;
      const newWidth = Math.max(300, Math.min(800, containerWidth - e.clientX));
      actions.setPanelSizes({ rightPanelWidth: newWidth });
    };
    
    const handleMouseUp = () => {
      actions.setResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [actions]);

  const handleBottomMouseDown = useCallback((e) => {
    e.preventDefault();
    actions.setResizing(true);
    
    const handleMouseMove = (e) => {
      const containerHeight = containerRef.current?.offsetHeight || 800;
      const newHeight = Math.max(100, Math.min(400, containerHeight - e.clientY));
      actions.setPanelSizes({ bottomPanelHeight: newHeight });
    };
    
    const handleMouseUp = () => {
      actions.setResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [actions]);

  // Function to get all files from FileExplorer
  const getAllAvailableFiles = () => {
    if (fileExplorerRef.current && fileExplorerRef.current.getAllFiles) {
      return fileExplorerRef.current.getAllFiles();
    }
    return [];
  };

  // Function to get open tabs from MainEditor
  const getOpenTabs = () => {
    if (mainEditorRef.current && mainEditorRef.current.getOpenTabs) {
      return mainEditorRef.current.getOpenTabs();
    }
    return openTabs;
  };

  // Function to get Excel files from MainEditor
  const getExcelFiles = () => {
    if (mainEditorRef.current && mainEditorRef.current.getExcelFiles) {
      return mainEditorRef.current.getExcelFiles();
    }
    return excelFiles;
  };

  // Update open tabs when they change in MainEditor
  useEffect(() => {
    const updateOpenTabs = () => {
      const tabs = getOpenTabs();
      const excel = getExcelFiles();
      updateTabs(tabs);
      setExcelData(excel);
    };
    
    // Update tabs periodically or when MainEditor changes
    const interval = setInterval(updateOpenTabs, 1000);
    return () => clearInterval(interval);
  }, [updateTabs, setExcelData]);

  // Update available files when FileExplorer changes
  const handleFilesUpdate = useCallback((files) => {
    setAvailableFiles(files);
  }, [setAvailableFiles]);

  const handleFileOpen = (fileName) => {
    // Update the selected file when a file is opened via drag and drop
    setSelectedFile(fileName);
  };

  // Add a callback to handle file renames from FileExplorer
  const mainEditorRef = useRef(null);
  
  const handleFileRenamed = (oldName, newName, fileHandle) => {
    if (mainEditorRef.current && mainEditorRef.current.handleFileRenamed) {
      mainEditorRef.current.handleFileRenamed(oldName, newName, fileHandle);
    }
  };

  const handleFileDeleted = (fileName) => {
    if (mainEditorRef.current && mainEditorRef.current.handleFileDeleted) {
      mainEditorRef.current.handleFileDeleted(fileName);
    }
  };

  // Add keyboard shortcut for terminal toggle (Ctrl+` like VS Code)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array since toggleTerminal doesn't need to be reactive

  return (
    <div 
      ref={containerRef}
      className={`h-screen ${colors.text} flex ${colors.primary} overflow-hidden ${theme}`}
      style={{ height: '100vh', maxHeight: '100vh' }}
    >
      {/* Left FileExplorer - fixed */}
      <FileExplorer 
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        width={leftPanelWidth}
        onFileRenamed={handleFileRenamed}
        onFileDeleted={handleFileDeleted}
        onFilesUpdate={handleFilesUpdate}
        ref={fileExplorerRef}
      />
      
      <ResizeHandle onMouseDown={handleLeftMouseDown} orientation="vertical" />
      
      {/* Right side - MainEditor/ChatPanel above, Terminal below */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top section - MainEditor and ChatPanel */}
        <div 
          className="flex overflow-hidden"
          style={{ height: !isTerminalVisible ? '100%' : `calc(100% - ${bottomPanelHeight}px - 1px)` }}
        >
          <div className="flex-1 overflow-hidden">
            <MainEditor 
              selectedFile={selectedFile} 
              onFileOpen={handleFileOpen}
              ref={mainEditorRef}
              isTerminalVisible={isTerminalVisible}
            />
          </div>
          
          <ResizeHandle onMouseDown={handleRightMouseDown} orientation="vertical" />
          
          <div style={{ width: rightPanelWidth }} className="flex-shrink-0 overflow-hidden h-full">
            <ChatPanel 
              width={rightPanelWidth}
              getAllAvailableFiles={getAllAvailableFiles}
            />
          </div>
        </div>
        
        {/* Show terminal controls */}
        {isTerminalVisible && (
          <>
            {/* Horizontal resize handle */}
            <ResizeHandle onMouseDown={handleBottomMouseDown} orientation="horizontal" />
            
            {/* Bottom Terminal panel - spans full width of right side */}
            <TerminalPanel />
          </>
        )}
        
        {/* Terminal toggle button when hidden */}
        {!isTerminalVisible && (
          <div className={`${colors.secondary} ${colors.border} border-t flex items-center justify-between px-3 py-1`}>
            <span className={`text-xs ${colors.textSecondary}`}>Terminal</span>
            <button
              onClick={toggleTerminal}
              className={`p-1 rounded text-xs ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600`}
              title="Open terminal"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75zM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8zm0 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75z"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <VSCodeInterface />
      </AppStateProvider>
    </ThemeProvider>
  );
}

