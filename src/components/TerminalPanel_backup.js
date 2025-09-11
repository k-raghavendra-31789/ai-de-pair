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
  
  // Get tabs and active tab with defensive checks
  const tabs = sqlExecution?.tabs || [];
  const activeTabId = sqlExecution?.activeTabId;
  const activeTabData = tabs.find(tab => tab.id === activeTabId);

  // Handle tab switching
  const handleTabClick = (tabId) => {
    if (actions?.setActiveTab) {
      actions.setActiveTab(tabId);
    }
  };

  // Handle resizing
  const handleMouseDown = (e) => {
    if (!setResizing) return;
    
    e.preventDefault();
    setResizing(true);
    
    const startY = e.clientY;
    const startHeight = height;
    
    const handleMouseMove = (e) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
      
      if (setPanelSizes) {
        setPanelSizes(prev => ({
          ...prev,
          bottomPanelHeight: newHeight
        }));
      }
    };
    
    const handleMouseUp = () => {
      setResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isTerminalVisible) return null;

  return (
    <div 
      className={`border-t ${colors.borderLight} ${colors.primary} flex flex-col ${isResizing ? 'select-none' : ''}`}
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <ResizeHandle onMouseDown={handleMouseDown} />
      
      {/* Header with tabs */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${colors.borderLight} bg-gray-50 dark:bg-gray-800`}>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`px-3 py-1 text-sm rounded-t border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                tab.id === activeTabId
                  ? `${colors.text} border-blue-500 bg-white dark:bg-gray-700`
                  : `${colors.textMuted} border-transparent hover:${colors.text} hover:bg-gray-100 dark:hover:bg-gray-700`
              }`}
            >
              <span>{tab.id}</span>
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
              <div className="p-4 h-full overflow-y-auto">
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
                  <div className="space-y-4">
                    {/* Only render DataFrame outputs, ignore statistics and other types */}
                    {activeTabData.results?.outputs && Array.isArray(activeTabData.results.outputs) ? (
                      activeTabData.results.outputs
                        .filter(output => output.type === 'dataframe')
                        .map((output, index) => (
                          output.data?.columns && output.data?.rows ? (
                            <div key={index} className="overflow-auto">
                              <table className={`w-full text-sm border-collapse border ${colors.borderLight}`}>
                                <thead>
                                  <tr className={`${colors.secondary}`}>
                                    {output.data.columns.map((column, colIndex) => (
                                      <th key={colIndex} className={`border ${colors.borderLight} px-3 py-2 text-left font-medium ${colors.text}`}>
                                        {column}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {output.data.rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? colors.primary : colors.secondary}>
                                      {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className={`border ${colors.borderLight} px-3 py-2 ${colors.text}`}>
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null
                        ))
                    ) : null}
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
