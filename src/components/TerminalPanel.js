import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import CustomScrollbar from './CustomScrollbar';
import ResizeHandle from './ResizeHandle';
import { connectionManager } from '../services/ConnectionManager';

const TerminalPanel = () => {
  const { colors } = useTheme();
  const { state, actions } = useAppState();
  
  // Get terminal state from context with defensive checks
  const { panelSizes, isTerminalVisible, dbConnections = [], isResizing, sqlExecution = {} } = state || {};
  const { toggleTerminal, setPanelSizes, setResizing } = actions || {};
  const height = panelSizes?.bottomPanelHeight || 300;
  
  const [activeTab, setActiveTab] = useState('configure');
  const [dataTabs, setDataTabs] = useState([
    { id: 'configure', label: 'Configure DB', icon: '⚙️' }
  ]);

  // Database connection state (internal to component)
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResults, setSqlResults] = useState(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [reconnectConnectionId, setReconnectConnectionId] = useState(null);

  // Watch for SQL execution results from AppState and create result tabs
  useEffect(() => {
    console.log('TerminalPanel useEffect triggered. SQL execution state:', sqlExecution);
    
    if (sqlExecution.lastQuery) {
      const { lastResults, lastQuery, lastError, isExecuting, isLoading, lastSourceFile, lastResultTabId } = sqlExecution;
      
      console.log('Processing SQL execution state:', { lastResults, lastQuery, lastError, isExecuting, isLoading, lastSourceFile, lastResultTabId });
      
      // Use functional updates to avoid dependency on dataTabs
      setDataTabs(currentTabs => {
        // Determine tab ID based on source file
        let targetTabId;
        let existingTabIndex = -1;
        
        if (lastSourceFile) {
          // For file-based queries, use consistent tab ID based on file name
          targetTabId = `result-${lastSourceFile}`;
          existingTabIndex = currentTabs.findIndex(tab => tab.id === targetTabId);
        } else {
          // For non-file queries, look for existing tab with same query
          existingTabIndex = currentTabs.findIndex(tab => 
            tab.query === lastQuery && tab.id !== 'configure' && !tab.sourceFile
          );
          targetTabId = existingTabIndex >= 0 ? currentTabs[existingTabIndex].id : lastResultTabId;
        }
        
        // Determine tab state and icon
        let tabIcon, tabState;
        if ((isExecuting || isLoading) && !lastResults && !lastError) {
          tabIcon = '⏳';
          tabState = 'loading';
        } else if (lastError) {
          tabIcon = '❌';
          tabState = 'error';
        } else if (lastResults) {
          tabIcon = '✅';
          tabState = 'success';
        } else {
          tabIcon = '📊';
          tabState = 'pending';
        }
        
        if (existingTabIndex >= 0) {
          // Update existing tab
          const existingTab = currentTabs[existingTabIndex];
          const updatedTab = {
            ...existingTab,
            icon: tabIcon,
            query: lastQuery,
            results: lastResults,
            error: lastError,
            state: tabState,
            isExecuting: isExecuting || isLoading,
            sourceFile: lastSourceFile,
            lastUpdated: new Date().toLocaleTimeString(),
            closable: true // Ensure result tabs are closable
          };
          
          console.log('Updating existing tab:', updatedTab);
          
          const updated = [...currentTabs];
          updated[existingTabIndex] = updatedTab;
          
          // Make sure the tab is active
          setActiveTab(existingTab.id);
          
          return updated;
        } else {
          // Create new tab only if we don't already have one
          const timestamp = new Date().toLocaleTimeString();
          const tabLabel = lastSourceFile 
            ? `${lastSourceFile.replace('.sql', '')} Results` 
            : `Results ${timestamp}`;
          
          const newTab = {
            id: targetTabId,
            label: tabLabel,
            icon: tabIcon,
            query: lastQuery,
            results: lastResults,
            error: lastError,
            state: tabState,
            isExecuting: isExecuting || isLoading,
            sourceFile: lastSourceFile,
            lastUpdated: timestamp,
            closable: true // Ensure result tabs are closable
          };
          
          console.log('Creating new tab:', newTab);
          
          // Make sure the tab is active
          setActiveTab(targetTabId);
          
          return [...currentTabs, newTab];
        }
      });
    }
  }, [sqlExecution]);

  // Check for connections that need tokens after page refresh
  useEffect(() => {
    if (state.activeConnectionId && state.dbConnections.length > 0) {
      const activeConnection = state.dbConnections.find(c => c.id === state.activeConnectionId);
      if (activeConnection) {
        // Import the service to check if token exists
        import('../services/DatabaseConnectionService').then(module => {
          const { databaseConnectionService } = module;
          const hasToken = databaseConnectionService.hasValidToken(state.activeConnectionId);
          
          if (!hasToken) {
            // Active connection exists but no access token - show reconnect modal
            setReconnectConnectionId(state.activeConnectionId);
            setShowReconnectModal(true);
          }
        });
      }
    }
  }, [state.activeConnectionId, state.dbConnections]);

  // Connection management handlers
  const addConnection = async (connectionData) => {
    try {
      const result = await connectionManager.addConnection(connectionData, { actions });
      setShowAddConnection(false);
      // Show success feedback
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const editConnection = (connection) => {
    setEditingConnection(connection);
  };

  const saveConnection = async (connectionId, updates) => {
    try {
      actions.updateDbConnection(connectionId, updates);
      setEditingConnection(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const testConnection = async (connectionId) => {
    try {
      setTestingConnection(connectionId);
      // For now, testing is not implemented - just return success
      setTestingConnection(null);
      return { success: true };
    } catch (error) {
      setTestingConnection(null);
      return { success: false, error: error.message };
    }
  };

  const deleteConnection = (connectionId) => {
    if (window.confirm('Are you sure you want to delete this connection?')) {
      // Remove from app state
      actions.deleteDbConnection(connectionId);
    }
  };

  const handleReconnect = async (accessToken) => {
    try {
      const { ConnectionManager } = await import('../services/ConnectionManager');
      const result = ConnectionManager.reconnectWithToken(reconnectConnectionId, accessToken, actions);
      
      if (result.success) {
        setShowReconnectModal(false);
        setReconnectConnectionId(null);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const executeSql = async () => {
    if (!state.activeConnectionId) {
      alert('Please select an active connection first');
      return;
    }

    if (!sqlQuery.trim()) {
      alert('Please enter a SQL query');
      return;
    }

    setIsExecutingSql(true);
    setSqlResults(null);

    try {
      const result = await connectionManager.executeSQL(state.activeConnectionId, sqlQuery.trim(), { actions });
      setSqlResults(result);
      
      // Create a new tab for the results
      addNewDataTab(sqlQuery.trim(), result);
    } catch (error) {
      setSqlResults({ success: false, error: error.message });
    }

    setIsExecutingSql(false);
  };

  // Resize functionality
  const handleResizeStart = (e) => {
    e.preventDefault();
    setResizing && setResizing(true);
    
    const startY = e.clientY;
    const startHeight = height;
    
    const handleMouseMove = (e) => {
      const deltaY = startY - e.clientY; // Inverted because we want to drag up to increase height
      const newHeight = Math.max(100, Math.min(800, startHeight + deltaY)); // Min 100px, max 800px
      
      setPanelSizes && setPanelSizes({
        ...panelSizes,
        bottomPanelHeight: newHeight
      });
    };
    
    const handleMouseUp = () => {
      setResizing && setResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // If height is too small, don't render content
  const isCollapsed = height < 50;

  // Sample data for the data panel - will be replaced with real data later
  const sampleData = [];

  const addNewDataTab = (query = null, results = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const newTabId = `result-${Date.now()}`;
    const newTab = {
      id: newTabId,
      label: query ? `Query ${timestamp}` : `Results ${dataTabs.length}`,
      icon: '�',
      query: query,
      results: results
    };
    setDataTabs([...dataTabs, newTab]);
    setActiveTab(newTabId);
    return newTabId;
  };

  const removeDataTab = (tabId) => {
    console.log('Removing tab:', tabId, 'Current tabs:', dataTabs.map(t => ({ id: t.id, label: t.label })));
    
    // Don't allow removing the configure tab
    if (tabId === 'configure') {
      console.log('Cannot remove configure tab');
      return;
    }
    
    setDataTabs(currentTabs => {
      const newTabs = currentTabs.filter(tab => tab.id !== tabId);
      console.log('New tabs after removal:', newTabs.map(t => ({ id: t.id, label: t.label })));
      return newTabs;
    });
    
    // If the active tab was removed, switch to configure tab
    if (activeTab === tabId) {
      console.log('Active tab was removed, switching to configure');
      setActiveTab('configure');
    }
  };

  const tabs = [
    ...dataTabs.map(tab => {
      // Add connection indicator to the first tab if there's an active connection
      let label = tab.label;
      let icon = tab.icon;
      
      if (tab.id === 'configure' && state.activeConnectionId) {
        const activeConnection = dbConnections.find(c => c.id === state.activeConnectionId);
        if (activeConnection) {
          const status = state.connectionStatus[state.activeConnectionId];
          const isConnected = status?.isConnected;
          // Gray for not tested, green for connected, red for error
          icon = isConnected === null ? '⚪' : isConnected ? '🟢' : '🔴';
          label = `${tab.label} (${activeConnection.name})`;
        }
      }
      
      return {
        ...tab,
        label,
        icon,
        closable: dataTabs.length > 1
      };
    }),
    {
      id: 'add-new',
      label: '+',
      icon: '',
      isAddButton: true
    }
  ];

  const renderContent = () => {
    const currentTab = dataTabs.find(tab => tab.id === activeTab);
    if (!currentTab) return null;

    // If it's the configure tab, show the connection management UI
    if (currentTab.id === 'configure') {
      return renderConfigureTab();
    }
    
    // If it's a results tab, show the tabular data
    if (currentTab.id.startsWith('result-')) {
      return renderResultsTab(currentTab);
    }

    return null;
  };

  const renderConfigureTab = () => {
    return (
      <div className="h-full flex flex-col">
        {/* Database Connections Section */}
        <div className="flex-1 p-4">
          <div className="h-full flex flex-col">
              {/* Header */}
              <div className={`${colors.border} border-b pb-3 mb-4`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-lg font-semibold ${colors.text}`}>Database Connections</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddConnection(true)}
                      className={`
                        px-3 py-1 text-sm rounded-md ${colors.accentBg} text-white 
                        hover:opacity-80 transition-opacity flex items-center gap-2
                      `}
                    >
                      <span className="text-xs">+</span>
                      Add Connection
                    </button>
                  </div>
                </div>
                
                {/* Active Connection Status */}
                {state.activeConnectionId && (
                  <div className={`text-sm ${colors.textSecondary} flex items-center gap-2`}>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Active: {dbConnections.find(c => c.id === state.activeConnectionId)?.name}
                  </div>
                )}
              </div>

              {/* Connections Grid */}
              <div className="flex-1 overflow-y-auto">
                {dbConnections.length === 0 ? (
                  <div className={`flex items-center justify-center h-full ${colors.textMuted}`}>
                    <div className="text-center">
                      <div className="text-4xl mb-4">�</div>
                      <div className="text-lg mb-2">No Database Connections</div>
                      <div className="text-sm mb-4">Add your first connection to get started</div>
                      <button
                        onClick={() => setShowAddConnection(true)}
                        className={`
                          px-4 py-2 rounded-md ${colors.accentBg} text-white 
                          hover:opacity-80 transition-opacity
                        `}
                      >
                        Add Connection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {dbConnections.map(connection => (
                      <ConnectionCard
                        key={connection.id}
                        connection={connection}
                        isActive={state.activeConnectionId === connection.id}
                        status={state.connectionStatus[connection.id]}
                        onActivate={() => actions.setActiveConnection(connection.id)}
                        onTest={() => testConnection(connection.id)}
                        onEdit={() => editConnection(connection)}
                        onDelete={() => deleteConnection(connection.id)}
                        colors={colors}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Add Connection Modal */}
        {showAddConnection && (
          <AddConnectionModal
            onClose={() => setShowAddConnection(false)}
            onAdd={addConnection}
            colors={colors}
          />
        )}

        {/* Edit Connection Modal */}
        {editingConnection && (
          <EditConnectionModal
            connection={editingConnection}
            onClose={() => setEditingConnection(null)}
            onSave={saveConnection}
            colors={colors}
          />
        )}

        {/* Reconnect Modal */}
        {showReconnectModal && reconnectConnectionId && (
          <ReconnectModal
            connection={state.dbConnections.find(c => c.id === reconnectConnectionId)}
            onClose={() => {
              setShowReconnectModal(false);
              setReconnectConnectionId(null);
            }}
            onReconnect={handleReconnect}
            colors={colors}
          />
        )}
      </div>
    );
  };

  const renderResultsTab = (tab) => {
    // Handle loading state
    if (tab.state === 'loading' || (tab.isExecuting && !tab.results && !tab.error)) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-spin">⏳</div>
            <p className={`${colors.text} text-lg`}>Executing Query...</p>
            {tab.sourceFile && (
              <p className={`${colors.textSecondary} text-sm mt-1`}>
                from {tab.sourceFile}
              </p>
            )}
            <p className={`${colors.textSecondary} text-sm mt-2`}>
              {tab.query && tab.query.length > 80 ? `${tab.query.substring(0, 80)}...` : tab.query}
            </p>
          </div>
        </div>
      );
    }

    // Handle error state
    if (tab.error) {
      return (
        <div className="h-full flex flex-col">
          {/* Error Header */}
          <div className={`${colors.border} border-b p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-semibold ${colors.text} flex items-center gap-2`}>
                  <span className="text-red-400">❌</span>
                  Query Failed
                  {tab.sourceFile && (
                    <span className={`text-sm ${colors.textSecondary} font-normal`}>
                      from {tab.sourceFile}
                    </span>
                  )}
                </h3>
                {tab.query && (
                  <p className={`text-sm ${colors.textSecondary} mt-1 font-mono`}>
                    {tab.query.length > 100 ? `${tab.query.substring(0, 100)}...` : tab.query}
                  </p>
                )}
                {tab.lastUpdated && (
                  <p className={`text-xs ${colors.textMuted} mt-1`}>
                    Last updated: {tab.lastUpdated}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Error Details */}
          <div className="flex-1 overflow-auto p-4">
            <div className="text-red-400 text-center py-8">
              <div className="text-4xl mb-4">❌</div>
              <p className="text-lg mb-2">Query Execution Failed</p>
              <div className={`${colors.secondary} ${colors.border} border rounded p-4 text-left`}>
                <pre className="text-sm text-red-300 whitespace-pre-wrap">{tab.error}</pre>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Handle no results
    if (!tab.results) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className={`text-4xl mb-4`}>📊</div>
            <p className={`${colors.textSecondary}`}>No results to display</p>
          </div>
        </div>
      );
    }

    // Handle successful results
    return (
      <div className="h-full flex flex-col">
        {/* Results Header - Hidden to save space */}
        {/* Commented out to maximize data display area
        <div className={`${colors.border} border-b p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-semibold ${colors.text} flex items-center gap-2`}>
                <span className="text-green-400">✅</span>
                Query Results
                {tab.sourceFile && (
                  <span className={`text-sm ${colors.textSecondary} font-normal`}>
                    from {tab.sourceFile}
                  </span>
                )}
              </h3>
              {tab.query && (
                <p className={`text-sm ${colors.textSecondary} mt-1 font-mono`}>
                  {tab.query.length > 100 ? `${tab.query.substring(0, 100)}...` : tab.query}
                </p>
              )}
              {tab.lastUpdated && (
                <p className={`text-xs ${colors.textMuted} mt-1`}>
                  Last updated: {tab.lastUpdated}
                </p>
              )}
            </div>
            <div className="text-green-400 text-sm font-semibold">
              {tab.results.results ? tab.results.results.length : 0} rows
            </div>
          </div>
        </div>
        */}

        {/* Results Table - Now takes full height */}
        <div className="flex-1 overflow-auto p-2">
          <ResultsTable results={tab.results.results} colors={colors} />
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`${colors.secondary} ${colors.border} border-t flex flex-col`}
      style={{ height }}
    >
      {/* Resize Handle */}
      <ResizeHandle 
        onMouseDown={handleResizeStart}
        orientation="horizontal"
        className="hover:bg-blue-500 transition-colors"
      />
      
      {/* Always show header, but minimal when collapsed */}
      <div className={`${colors.border} border-b flex items-center px-2 ${isCollapsed ? 'py-1' : ''}`}>
        <div className="flex items-center">
          {!isCollapsed ? (
            tabs.map((tab) => (
              <div key={tab.id} className="flex items-center">
                {tab.isAddButton ? (
                  <button
                    onClick={addNewDataTab}
                    className={`
                      flex items-center justify-center w-8 h-8 text-lg font-bold
                      ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600 rounded
                    `}
                    title="Add new data tab"
                  >
                    +
                  </button>
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wide font-medium
                        ${activeTab === tab.id 
                          ? `${colors.text} border-b-2 border-blue-500` 
                          : `${colors.textSecondary} hover:${colors.text}`
                        }
                      `}
                    >
                      <span className="text-sm">{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                    {tab.closable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDataTab(tab.id);
                        }}
                        className={`ml-1 p-1 rounded text-xs ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600`}
                        title="Close tab"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className={`flex items-center gap-2 px-2 text-xs ${colors.textSecondary}`}>
              <span className="text-sm">{dataTabs.find(t => t.id === activeTab)?.icon}</span>
              <span>{dataTabs.find(t => t.id === activeTab)?.label}</span>
            </div>
          )}
        </div>
        
        {/* Simple close button */}
        {!isCollapsed && (
          <button
            onClick={toggleTerminal}
            className={`ml-auto px-3 py-2 text-lg ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600 rounded`}
            title="Close panel"
          >
            ×
          </button>
        )}
      </div>

      {/* Terminal Content - only show if not collapsed */}
      {!isCollapsed && (
        <CustomScrollbar 
          className="flex-1"
          showHorizontal={false}
          showVertical={true}
        >
          <div className={`${colors.primary} h-full`}>
            {renderContent()}
          </div>
        </CustomScrollbar>
      )}
    </div>
  );
};

// Connection Card Component - Compact Version
const ConnectionCard = ({ connection, isActive, status, onActivate, onTest, onEdit, onDelete, colors }) => {
  const isConnected = status?.isConnected;
  const hasError = status?.error;
  const notTested = status?.isConnected === null;

  return (
    <div className={`
      ${colors.secondary} ${colors.border} border rounded-md p-2 transition-all text-xs
      ${isActive ? 'ring-1 ring-blue-500 bg-blue-900/20' : 'hover:border-gray-500'}
    `}>
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${
            notTested ? 'bg-gray-500' : isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <h4 className={`font-medium ${colors.text} truncate text-sm`}>{connection.name}</h4>
          {isActive && (
            <span className="px-1 py-0.5 bg-blue-500 text-white rounded text-xs">Active</span>
          )}
        </div>
        
        {/* Compact Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onTest}
            className={`p-0.5 rounded ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600`}
            title="Test connection"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </button>
          <button
            onClick={onEdit}
            className={`p-0.5 rounded ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600`}
            title="Edit connection"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L5.707 13H2v-3.707L11.146.146zM3 10.707V12h1.293L13.846 2.707 12.293 1.354 3 10.707z"/>
            </svg>
          </button>
          <button
            onClick={onDelete}
            className={`p-0.5 rounded text-red-400 hover:text-red-300 hover:bg-gray-600`}
            title="Delete connection"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5zM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Compact Connection Details */}
      <div className={`text-xs ${colors.textSecondary} space-y-0.5 mb-1`}>
        <div className="truncate">
          <span className="font-medium">Host:</span> {connection.serverHostname}
        </div>
        <div className="truncate">
          <span className="font-medium">Path:</span> {connection.httpPath}
        </div>
      </div>

      {/* Compact Status */}
      {hasError && (
        <div className="text-xs text-red-400 mb-1 p-1 bg-red-900/20 rounded">
          ❌ Error
        </div>
      )}
      
      {isConnected === true && (
        <div className="text-xs text-green-400 mb-1 p-1 bg-green-900/20 rounded">
          ✅ Connected
        </div>
      )}

      {notTested && (
        <div className="text-xs text-gray-400 mb-1 p-1 bg-gray-900/20 rounded">
          ⚠️ Not tested
        </div>
      )}

      {/* Compact Action Button */}
      {!isActive && (
        <button
          onClick={onActivate}
          className={`w-full px-2 py-1 text-xs rounded ${colors.accentBg} text-white hover:opacity-80 transition-opacity`}
        >
          Set as Active
        </button>
      )}
    </div>
  );
};

// Add Connection Modal
const AddConnectionModal = ({ onClose, onAdd, colors }) => {
  const [formData, setFormData] = useState({
    name: '',
    serverHostname: '',
    httpPath: '',
    accessToken: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const result = await onAdd(formData);
    if (result.success) {
      onClose();
    } else {
      setError(result.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${colors.secondary} ${colors.border} border rounded-lg p-6 w-full max-w-md mx-4`}>
        <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>Add Database Connection</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${colors.text} mb-1`}>
              Connection Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`
                w-full px-3 py-2 ${colors.primary} ${colors.border} border rounded-md
                ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
              placeholder="My Databricks DB"
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text} mb-1`}>
              Server Hostname
            </label>
            <input
              type="text"
              value={formData.serverHostname}
              onChange={(e) => setFormData({...formData, serverHostname: e.target.value})}
              className={`
                w-full px-3 py-2 ${colors.primary} ${colors.border} border rounded-md
                ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
              placeholder="dbc-12345678-abcd.cloud.databricks.com"
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text} mb-1`}>
              HTTP Path
            </label>
            <input
              type="text"
              value={formData.httpPath}
              onChange={(e) => setFormData({...formData, httpPath: e.target.value})}
              className={`
                w-full px-3 py-2 ${colors.primary} ${colors.border} border rounded-md
                ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
              placeholder="/sql/1.0/warehouses/abc123def456"
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text} mb-1`}>
              Access Token
            </label>
            <input
              type="password"
              value={formData.accessToken}
              onChange={(e) => setFormData({...formData, accessToken: e.target.value})}
              className={`
                w-full px-3 py-2 ${colors.primary} ${colors.border} border rounded-md
                ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
              placeholder="dapi1234567890abcdef..."
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm p-2 bg-red-900/20 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`
                flex-1 py-2 px-4 rounded-md ${colors.border} border
                ${colors.textSecondary} hover:${colors.text} transition-colors
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                flex-1 py-2 px-4 rounded-md ${colors.accentBg} text-white
                hover:opacity-80 transition-opacity disabled:opacity-50
              `}
            >
              {isSubmitting ? 'Adding...' : 'Add Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Connection Modal (simplified version)
const EditConnectionModal = ({ connection, onClose, onSave, colors }) => {
  const [name, setName] = useState(connection.name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await onSave(connection.id, { name });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${colors.secondary} ${colors.border} border rounded-lg p-6 w-full max-w-md mx-4`}>
        <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>Edit Connection</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${colors.text} mb-1`}>
              Connection Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`
                w-full px-3 py-2 ${colors.primary} ${colors.border} border rounded-md
                ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`
                flex-1 py-2 px-4 rounded-md ${colors.border} border
                ${colors.textSecondary} hover:${colors.text} transition-colors
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                flex-1 py-2 px-4 rounded-md ${colors.accentBg} text-white
                hover:opacity-80 transition-opacity disabled:opacity-50
              `}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reconnect Modal - for when connection persists after refresh but access token is lost
const ReconnectModal = ({ connection, onClose, onReconnect, colors }) => {
  const [accessToken, setAccessToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const result = await onReconnect(accessToken);
    if (result.success) {
      onClose();
    } else {
      setError(result.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${colors.secondary} ${colors.border} border rounded-lg p-6 w-full max-w-md mx-4`}>
        <h3 className={`text-lg font-semibold ${colors.text} mb-2`}>Reconnect Database</h3>
        <p className={`text-sm ${colors.textSecondary} mb-4`}>
          Your connection to <strong>{connection?.name}</strong> needs to be re-authenticated. 
          Please enter your access token to continue.
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-md">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${colors.text} mb-1`}>
              Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className={`
                w-full px-3 py-2 ${colors.primary} ${colors.border} border rounded-md
                ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
              placeholder="dapi_..."
              required
            />
            <p className={`text-xs ${colors.textMuted} mt-1`}>
              This token will be stored securely in memory only.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`
                flex-1 py-2 px-4 rounded-md ${colors.border} border
                ${colors.textSecondary} hover:${colors.text} transition-colors
              `}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                flex-1 py-2 px-4 rounded-md ${colors.accentBg} text-white
                hover:opacity-80 transition-opacity disabled:opacity-50
              `}
            >
              {isSubmitting ? 'Reconnecting...' : 'Reconnect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Results Table Component
const ResultsTable = ({ results, colors }) => {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return (
      <div className="text-center py-8">
        <div className={`text-4xl mb-4`}>📊</div>
        <p className={`${colors.textSecondary}`}>No data to display</p>
      </div>
    );
  }

  // Get column names from the first row
  const columns = Object.keys(results[0]);

  return (
    <div className="overflow-auto">
      <table className={`w-full border-collapse ${colors.border}`}>
        <thead>
          <tr className={`${colors.tertiary}`}>
            {columns.map((column, index) => (
              <th
                key={index}
                className={`
                  border ${colors.border} px-4 py-2 text-left font-medium ${colors.text}
                  sticky top-0 ${colors.tertiary}
                `}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`
                hover:${colors.secondary} transition-colors
                ${rowIndex % 2 === 0 ? colors.primary : colors.secondary}
              `}
            >
              {columns.map((column, colIndex) => (
                <td
                  key={colIndex}
                  className={`
                    border ${colors.border} px-4 py-2 ${colors.text} text-sm
                    max-w-xs truncate
                  `}
                  title={String(row[column])}
                >
                  {row[column] === null ? (
                    <span className="text-gray-500 italic">NULL</span>
                  ) : (
                    String(row[column])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TerminalPanel;
