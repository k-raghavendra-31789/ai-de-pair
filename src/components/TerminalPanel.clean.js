import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import CustomScrollbar from './CustomScrollbar';
import ResizeHandle from './ResizeHandle';

const TerminalPanel = () => {
  const { colors } = useTheme();
  const { state, actions } = useAppState();
  
  // Get terminal state from context with defensive checks
  const { panelSizes, isTerminalVisible, isResizing, sqlExecution = {} } = state || {};
  const { toggleTerminal, setPanelSizes, setResizing } = actions || {};
  const height = panelSizes?.bottomPanelHeight || 300;
  
  const [activeTab, setActiveTab] = useState('results');
  const [dataTabs, setDataTabs] = useState([
    { id: 'results', label: 'Query Results', icon: '📊' }
  ]);

  // Watch for SQL execution results from AppState and create result tabs
  useEffect(() => {
    if (sqlExecution.lastQuery) {
      const { lastResults, lastQuery, lastError, isExecuting, isLoading, lastSourceFile, lastResultTabId } = sqlExecution;
      
      // Use functional updates to avoid dependency on dataTabs
      setDataTabs(currentTabs => {
        // Determine tab ID based on source file
        let targetTabId;
        let existingTabIndex = -1;
        
        if (lastSourceFile) {
          // For file-based queries, use consistent tab ID based on file name
          targetTabId = `result-${lastSourceFile}`;
          existingTabIndex = currentTabs.findIndex(tab => tab.id === targetTabId);
        } else if (lastResultTabId) {
          // Use provided tab ID
          targetTabId = lastResultTabId;
          existingTabIndex = currentTabs.findIndex(tab => tab.id === targetTabId);
        } else {
          // Default fallback
          targetTabId = 'results';
          existingTabIndex = currentTabs.findIndex(tab => tab.id === targetTabId);
        }

        const newTab = {
          id: targetTabId,
          label: lastSourceFile ? `Results: ${lastSourceFile}` : 'Query Results',
          icon: '📊',
          query: lastQuery,
          results: lastResults,
          error: lastError,
          isLoading: isLoading,
          isExecuting: isExecuting,
          sourceFile: lastSourceFile,
          timestamp: new Date().toLocaleTimeString(),
          status: lastError ? 'error' : lastResults ? 'success' : isExecuting ? 'executing' : 'idle'
        };

        let updatedTabs;
        if (existingTabIndex >= 0) {
          // Update existing tab
          updatedTabs = [...currentTabs];
          updatedTabs[existingTabIndex] = newTab;
        } else {
          // Add new tab (limit to 10 tabs)
          updatedTabs = [newTab, ...currentTabs].slice(0, 10);
        }

        return updatedTabs;
      });

      // Auto-switch to the updated/new tab
      if (lastSourceFile) {
        setActiveTab(`result-${lastSourceFile}`);
      } else if (lastResultTabId) {
        setActiveTab(lastResultTabId);
      } else {
        setActiveTab('results');
      }
    }
  }, [sqlExecution]);

  // Handle panel resize
  const handleResize = (newHeight) => {
    if (setPanelSizes) {
      setPanelSizes({ bottomPanelHeight: Math.max(200, Math.min(600, newHeight)) });
    }
  };

  const handleResizeStart = () => setResizing && setResizing(true);
  const handleResizeEnd = () => setResizing && setResizing(false);

  // Close tab function
  const closeTab = (tabId) => {
    setDataTabs(prev => {
      const filtered = prev.filter(tab => tab.id !== tabId);
      // If closing active tab, switch to the first remaining tab
      if (activeTab === tabId && filtered.length > 0) {
        setActiveTab(filtered[0].id);
      }
      return filtered;
    });
  };

  // Get active tab data
  const activeTabData = dataTabs.find(tab => tab.id === activeTab);

  if (!isTerminalVisible) return null;

  return (
    <div className={`${colors.primary} border-t ${colors.borderLight} ${isResizing ? 'select-none' : ''}`} style={{ height }}>
      {/* Resize Handle */}
      <ResizeHandle
        onResize={handleResize}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
        orientation="horizontal"
        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize bg-transparent hover:bg-blue-500 hover:bg-opacity-30 transition-colors z-10"
      />

      {/* Header with Tabs */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${colors.borderLight} bg-opacity-50`}>
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {dataTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors flex-shrink-0
                ${activeTab === tab.id
                  ? `${colors.accentBg} text-white`
                  : `${colors.secondary} ${colors.text} hover:${colors.tertiary}`
                }
              `}
            >
              <span>{tab.icon}</span>
              <span className="max-w-32 truncate">{tab.label}</span>
              {tab.id !== 'results' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 text-xs opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              )}
              {tab.status === 'executing' && (
                <div className="animate-spin text-xs">⟳</div>
              )}
              {tab.status === 'error' && (
                <div className="text-red-400 text-xs">⚠</div>
              )}
              {tab.status === 'success' && tab.results && (
                <div className="text-green-400 text-xs">✓</div>
              )}
            </button>
          ))}
        </div>
        
        <button
          onClick={toggleTerminal}
          className={`ml-2 p-1 rounded ${colors.hover} ${colors.textSecondary} hover:${colors.text} transition-colors flex-shrink-0`}
          title="Close Terminal"
        >
          ×
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <CustomScrollbar>
          <div className="h-full">
            {activeTabData ? (
              <div className="p-4 h-full">
                {/* Query Info */}
                {activeTabData.query && (
                  <div className="mb-4">
                    <div className={`text-xs ${colors.textMuted} mb-1`}>
                      Query executed at {activeTabData.timestamp}
                      {activeTabData.sourceFile && ` from ${activeTabData.sourceFile}`}
                    </div>
                    <pre className={`text-sm ${colors.secondary} p-2 rounded border ${colors.borderLight} overflow-x-auto`}>
                      {activeTabData.query}
                    </pre>
                  </div>
                )}

                {/* Results/Error Display */}
                {activeTabData.isExecuting || activeTabData.isLoading ? (
                  <div className={`text-center ${colors.textMuted} py-8`}>
                    <div className="animate-spin text-2xl mb-2">⟳</div>
                    <div>Executing query...</div>
                  </div>
                ) : activeTabData.error ? (
                  <div className="text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800">
                    <div className="font-medium mb-2">Query Error:</div>
                    <pre className="text-sm whitespace-pre-wrap">{activeTabData.error}</pre>
                  </div>
                ) : activeTabData.results ? (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200 dark:border-green-800">
                    <div className="text-green-600 dark:text-green-400 font-medium mb-2">Query Results:</div>
                    <pre className={`text-sm ${colors.text} whitespace-pre-wrap max-h-96 overflow-auto`}>
                      {typeof activeTabData.results === 'string' 
                        ? activeTabData.results 
                        : JSON.stringify(activeTabData.results, null, 2)
                      }
                    </pre>
                  </div>
                ) : (
                  <div className={`text-center ${colors.textMuted} py-8`}>
                    <div className="text-4xl mb-2">📊</div>
                    <div>No query results yet</div>
                    <div className="text-sm mt-1">Execute a SQL query to see results here</div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`text-center ${colors.textMuted} py-8`}>
                <div className="text-4xl mb-2">📊</div>
                <div>No active tab</div>
              </div>
            )}
          </div>
        </CustomScrollbar>
      </div>
    </div>
  );
};

export default TerminalPanel;
