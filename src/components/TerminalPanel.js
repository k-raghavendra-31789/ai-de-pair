import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import { useErrorCorrection } from '../hooks/useErrorCorrection';
import aiErrorCorrectionService from '../services/AIErrorCorrectionService';
import { IoClose, IoTerminal } from 'react-icons/io5';

const TerminalPanel = ({ onHeaderMouseDown }) => {
  const { colors } = useTheme();
  const { state, actions } = useAppState();
  
  // Error correction functionality
  const {
    isErrorCorrectionMode,
    currentError,
    initializeErrorCorrection,
    exitErrorCorrectionMode,
    hasActiveError
  } = useErrorCorrection();
  
  // Get terminal state from context with defensive checks
  const { panelSizes, isTerminalVisible, isResizing, sqlExecution = {} } = state || {};
  const { toggleTerminal, setPanelSizes, setResizing } = actions || {};
  const height = panelSizes?.bottomPanelHeight || 300;
  
  // Scroll state for large datasets
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef(null);
  
  // Handle scroll events to show/hide scroll-to-top button
  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    setShowScrollTop(scrollTop > 200);
  };
  
  // Scroll to top function
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };
  
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

  // Error detection and context extraction
  useEffect(() => {
    if (displayData) {
      const errorContext = aiErrorCorrectionService.extractErrorContext(displayData);
      
      // If we detect an error and not already in correction mode, set up the context
      if (errorContext.hasError && !isErrorCorrectionMode) {
        aiErrorCorrectionService.setErrorContext(errorContext);
        console.log('🎯 TerminalPanel: Error detected and context set:', {
          errorType: errorContext.errorType,
          hasError: errorContext.hasError
        });
      }
      
      // If error is resolved, exit correction mode
      if (!errorContext.hasError && isErrorCorrectionMode) {
        exitErrorCorrectionMode();
        console.log('🎯 TerminalPanel: Error resolved, exiting correction mode');
      }
    }
  }, [displayData, isErrorCorrectionMode, exitErrorCorrectionMode]);

  // Handle tab switching
  const handleTabClick = (tabId) => {
    if (actions?.setActiveSqlTab) {
      actions.setActiveSqlTab(tabId);
    }
  };

  // Handle tab removal
  const handleTabClose = (tabId, event) => {
    event.stopPropagation(); // Prevent tab switching when closing
    if (actions?.removeSqlTab) {
      actions.removeSqlTab(tabId);
    }
  };

  if (!isTerminalVisible) return null;

  return (
    <div 
      className={`border-t ${colors.borderLight} ${colors.primary} flex flex-col ${isResizing ? 'select-none cursor-row-resize' : ''}`}
      style={{ 
        height: `${height}px`,
        transition: isResizing ? 'none' : 'all 0.3s ease-in-out'
      }}
    >
      {/* Header with tabs - draggable for resizing */}
      <div 
        className={`flex items-center justify-between px-4 py-2 border-b ${colors.borderLight} ${colors.secondary} cursor-row-resize hover:bg-gray-600/50 select-none`}
        onMouseDown={onHeaderMouseDown}
        title="Drag to resize terminal panel"
        style={{ userSelect: 'none' }}
      >
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`px-3 py-1 text-sm rounded-t border-b-2 whitespace-nowrap flex items-center gap-2 group cursor-pointer ${
                tab.id === activeTabId
                  ? `${colors.text} border-blue-400 dark:border-blue-500 ${colors.primary}`
                  : `${colors.textMuted} border-transparent hover:${colors.text} ${colors.hover}`
              }`}
              style={{
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering resize
                  handleTabClick(tab.id);
                }}
                className="flex items-center gap-2 flex-1"
              >
                <IoTerminal className="text-sm" />
                <span>{String(tab.id || '')}</span>
                {tab.isExecuting && (
                  <div 
                    className="text-xs text-blue-400"
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
              </div>
              
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering resize
                  handleTabClose(tab.id, e);
                }}
                className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 ${colors.textMuted}`}
                title="Close tab"
              >
                <IoClose size={12} />
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering resize
            toggleTerminal();
          }}
          className={`ml-2 p-2 rounded ${colors.hover} ${colors.textSecondary} hover:${colors.text} transition-colors flex-shrink-0`}
          title="Close Terminal"
        >
          <IoClose size={16} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <div 
          className="h-full overflow-auto terminal-scrollbar"
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{
            scrollBehavior: 'smooth'
          }}
        >
            {displayData ? (
              <div className="h-full flex flex-col min-h-0">
                {/* Results/Error Display */}
                {(displayData.isExecuting || displayData.isLoading) ? (
                  <div className="flex-1 flex flex-col items-center justify-center loading-container">
                    {/* Wave Loading Animation */}
                    <div className="wave-loader">
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                      <div className="wave-bar"></div>
                    </div>
                  </div>
                ) : displayData.error || (displayData.results?.status === 'error') ? (
                  <div className={`text-red-300 dark:text-red-400 ${colors.secondary} rounded border border-red-300 dark:border-red-700 select-text error-text relative`}>
                    {/* Error correction controls - only show when error context is available */}
                    {aiErrorCorrectionService.getErrorContext()?.hasError && (
                      <div className="absolute top-2 right-2 z-10 flex gap-2">
                        {/* AI Fix Button */}
                        <button
                          onClick={() => {
                            const errorContext = aiErrorCorrectionService.getErrorContext();
                            if (errorContext?.hasError) {
                              console.log('🎯 TerminalPanel: AI Fix button clicked, activating error correction mode');
                              
                              // Initialize error correction mode and notify parent
                              initializeErrorCorrection(errorContext, (context) => {
                                // Dispatch custom event to notify MonacoEditor to activate correction mode
                                const correctionEvent = new CustomEvent('activateErrorCorrection', {
                                  detail: {
                                    errorContext: context,
                                    source: 'terminal'
                                  }
                                });
                                window.dispatchEvent(correctionEvent);
                              });
                            }
                          }}
                          className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 border border-purple-400/50 rounded-lg px-4 py-2 text-sm text-white flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-purple-500/25 hover:scale-105 font-medium"
                          title="Fix this error with AI"
                        >
                          <span>✨</span>
                          <span>AI Fix</span>
                        </button>
                      </div>
                    )}
                    
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
                                <div className={`mb-0 p-2 text-xs ${colors.textMuted} ${colors.secondary} sticky top-0 z-10`}>
                                  Showing {output.data.rows.length} rows
                                  {output.data.total_rows && output.data.total_rows > output.data.rows.length && (
                                    <span> of {output.data.total_rows} total</span>
                                  )}
                                  {output.data.truncated && (
                                    <span className="text-yellow-500 dark:text-yellow-400"> (truncated)</span>
                                  )}
                                  <span className="ml-2 text-blue-500 dark:text-blue-400">• Rendering {output.data.rows.length} table rows</span>
                                </div>
                                
                                <div className="terminal-table-container">
                                  <table className={`w-full text-sm border-collapse border ${colors.borderLight} terminal-data-table`}>
                                    <thead className="sticky top-0 z-20">
                                      <tr className={`${colors.secondary}`}>
                                        {output.data.columns.map((column, colIndex) => (
                                          <th key={colIndex} className={`border ${colors.borderLight} px-3 py-2 text-left font-medium ${colors.text} ${colors.secondary} select-text`}>
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
                <div>No results to display</div>
              </div>
            )}
          </div>
        
        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className={`absolute bottom-4 right-4 p-2 rounded-full ${colors.accent} text-white shadow-lg hover:opacity-80 transition-opacity z-10`}
            title="Scroll to top"
            style={{
              animation: 'fadeIn 0.3s ease-in-out'
            }}
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
