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
  const tabs = sqlExecution?.resultTabs || [];
  const activeTabId = sqlExecution?.activeTabId;
  const activeTabData = tabs.find(tab => tab.id === activeTabId);

  // Fallback: if no active tab but we have tabs, use the first one
  let displayData = activeTabData;
  if (!displayData && tabs.length > 0) {
    displayData = tabs[0];
  }
  
  // Last fallback: if no tabs but we have lastResults, create a virtual tab
  if (!displayData && sqlExecution?.lastResults) {
    displayData = {
      id: 'last-result',
      results: sqlExecution.lastResults,
      query: sqlExecution.lastQuery,
      status: 'success',
      timestamp: 'now'
    };
  }
  
  // Debug logging for error display (remove after testing)
  if (displayData?.error || displayData?.results?.status === 'error') {
    console.log('🎯 TerminalPanel error debug:', {
      hasTopLevelError: !!displayData?.error,
      resultsStatus: displayData?.results?.status,
      errorType: typeof displayData?.results?.error,
      errorKeys: displayData?.results?.error ? Object.keys(displayData?.results?.error) : 'none'
    });
  }

  // Handle tab switching
  const handleTabClick = (tabId) => {
    if (actions?.setActiveSqlTab) {
      actions.setActiveSqlTab(tabId);
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
      style={{ 
        height: `${height}px`,
        transition: 'all 0.3s ease-in-out'
      }}
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
              className={`px-3 py-1 text-sm rounded-t border-b-2 whitespace-nowrap flex items-center gap-2 ${
                tab.id === activeTabId
                  ? `${colors.text} border-blue-500 bg-white dark:bg-gray-700`
                  : `${colors.textMuted} border-transparent hover:${colors.text} hover:bg-gray-100 dark:hover:bg-gray-700`
              }`}
              style={{
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <span>{String(tab.id || '')}</span>
              {tab.isExecuting && (
                <div 
                  className="text-xs"
                  style={{
                    animation: 'spin 1s linear infinite'
                  }}
                >⟳</div>
              )}
              {tab.status === 'error' && !tab.isExecuting && (
                <div className="text-red-400 text-xs">⚠</div>
              )}
              {tab.status === 'success' && !tab.isExecuting && tab.results && (
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
            {displayData ? (
              <div className="p-4 h-full flex flex-col min-h-0">
                {/* Results/Error Display */}
                {(displayData.isExecuting || displayData.isLoading) ? (
                  <div className="flex-1 flex flex-col items-center justify-center loading-container">
                    <div className="text-4xl mb-4 smooth-spinner">⟳</div>
                    <div 
                      className={`text-lg font-medium mb-2 ${colors.textMuted}`}
                      style={{
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                      }}
                    >Executing PySpark Code...</div>
                    <div className={`text-sm opacity-70 ${colors.textMuted}`}>Please wait while your code is being processed</div>
                    {displayData.query && (
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-left max-w-2xl opacity-80">
                        <div className="font-medium mb-1">Running:</div>
                        <pre className="whitespace-pre-wrap overflow-hidden">
                          {displayData.query.length > 200 
                            ? displayData.query.substring(0, 200) + '...' 
                            : displayData.query
                          }
                        </pre>
                      </div>
                    )}
                  </div>
                ) : displayData.error || (displayData.results?.status === 'error') ? (
                  <div className="text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800 select-text error-text">
                    <div className="font-medium mb-2 select-text">Query Error:</div>
                    <pre className="text-sm whitespace-pre-wrap select-text cursor-text error-text" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                      {(() => {
                        // Handle different error formats
                        if (displayData.error) {
                          return typeof displayData.error === 'string' ? displayData.error : JSON.stringify(displayData.error);
                        }
                        
                        const resultError = displayData.results?.error;
                        if (resultError) {
                          // If error is an object with detail
                          if (resultError.detail) {
                            return resultError.detail;
                          }
                          // If error is an object with message
                          if (resultError.message) {
                            return resultError.message;
                          }
                          // If error is an object with type and message
                          if (resultError.type && resultError.message) {
                            return `${resultError.type}: ${resultError.message}`;
                          }
                          // If error is just a string
                          if (typeof resultError === 'string') {
                            return resultError;
                          }
                          // Fallback: stringify the object
                          return JSON.stringify(resultError);
                        }
                        
                        return 'Unknown error occurred';
                      })()}
                    </pre>
                  </div>
                ) : displayData.results ? (
                  <div className="flex-1 overflow-y-auto min-h-0 terminal-content">
                    <div className="space-y-4 p-2">
                      {/* Only render DataFrame outputs, ignore statistics and other types */}
                      {displayData.results?.outputs && Array.isArray(displayData.results.outputs) ? (
                        displayData.results.outputs
                          .filter(output => output.type === 'dataframe')
                          .map((output, index) => {
                            return output.data?.columns && output.data?.rows ? (
                              <div key={index} className="border rounded overflow-hidden">
                                {/* Show row info */}
                                <div className="mb-0 p-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                                  Showing {output.data.rows.length} rows
                                  {output.data.total_rows && output.data.total_rows > output.data.rows.length && (
                                    <span> of {output.data.total_rows} total</span>
                                  )}
                                  {output.data.truncated && (
                                    <span className="text-yellow-600 dark:text-yellow-400"> (truncated)</span>
                                  )}
                                  <span className="ml-2 text-blue-600">• Rendering {output.data.rows.length} table rows</span>
                                </div>
                                
                                <div className="overflow-auto max-h-80">
                                  <table className={`w-full text-sm border-collapse border ${colors.borderLight}`}>
                                    <thead>
                                      <tr className="bg-gray-100 dark:bg-gray-700">
                                        {output.data.columns.map((column, colIndex) => (
                                          <th key={colIndex} className={`border ${colors.borderLight} px-3 py-2 text-left font-medium ${colors.text} bg-gray-100 dark:bg-gray-700 select-text`}>
                                            {column}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                <tbody>
                                  {output.data.rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? colors.primary : colors.secondary}>
                                      {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className={`border ${colors.borderLight} px-3 py-2 ${colors.text} select-text`}>
                                          {typeof cell === 'object' && cell !== null 
                                            ? JSON.stringify(cell) 
                                            : String(cell ?? '')
                                          }
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : null;
                          })
                        ) : null}
                    </div>
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
