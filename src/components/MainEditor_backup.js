import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import CustomScrollbar from './CustomScrollbar';

const MainEditor = ({ selectedFile, onFileOpen }) => {
  const { theme, toggleTheme, colors } = useTheme();
  const [openTabs, setOpenTabs] = useState([]);
  const [fileContents, setFileContents] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const dragTimeoutRef = useRef(null);
  const dragCounterRef = useRef(0);
  const saveTimeoutRef = useRef({});

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Tab Bar */}
      <div className={`${colors.secondary} ${colors.border} border-b flex items-center relative flex-shrink-0`}>
        <div className="flex items-center flex-1 overflow-x-auto">
          <div className="px-4 py-2">
            <span className="text-sm text-gray-400">Simple Test Editor</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-6 max-w-2xl">
          <div className={`text-lg mb-4 ${colors.text}`}>Welcome to VS Code Clone</div>
          <div className={`space-y-2 text-sm ${colors.textMuted}`}>
            <div>This is a simplified test version</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainEditor;
