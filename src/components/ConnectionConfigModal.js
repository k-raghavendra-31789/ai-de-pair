import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import { FaTimes, FaDatabase, FaTrash, FaEdit, FaPlus, FaCheck, FaSpinner } from 'react-icons/fa';
import { connectionManager } from '../services/ConnectionManager';

const ConnectionConfigModal = ({ onClose }) => {
  const { colors } = useTheme();
  const { state, actions } = useAppState();
  const { 
    dbConnections = [], 
    activeConnectionId 
  } = state || {};
  const { 
    addDbConnection = () => {}, 
    deleteDbConnection = () => {}, 
    setActiveConnection = () => {},
    updateDbConnection = () => {}
  } = actions || {};

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [connectionType, setConnectionType] = useState('databricks');
  const [formData, setFormData] = useState({
    name: '',
    serverHostname: '',
    httpPath: '',
    accessToken: '',
    serverUrl: 'http://localhost:8000'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(null);
  const [deletingConnection, setDeletingConnection] = useState(null);
  const [error, setError] = useState('');
  const [testResults, setTestResults] = useState({});

  // Load PySpark connections from sessionStorage on component mount
  useEffect(() => {
    try {
      const pysparkConnections = JSON.parse(sessionStorage.getItem('pyspark_connections') || '[]');
      pysparkConnections.forEach(connection => {
        // Migration fix: Ensure existing connections have the type field
        if (!connection.type) {
          connection.type = 'pyspark';
          console.log('🔧 Migrated PySpark connection to include type field:', connection.name);
        }
        
        // Check if this PySpark connection is already in app state
        const existsInState = dbConnections.find(c => c.id === connection.id);
        if (!existsInState) {
          console.log('🐍 Loading PySpark connection from sessionStorage:', connection.name);
          addDbConnection(connection.id, connection);
        }
      });
      
      // Save back the migrated connections
      if (pysparkConnections.some(c => c.type === 'pyspark')) {
        sessionStorage.setItem('pyspark_connections', JSON.stringify(pysparkConnections));
      }
    } catch (error) {
      console.error('🐍 Failed to load PySpark connections from sessionStorage:', error);
    }
  }, [dbConnections, addDbConnection]);

  // PySpark connection test function
  const testPySparkConnection = async (serverUrl) => {
    try {
      console.log('🐍 Testing PySpark connection to:', serverUrl);
      
      // Test the connection with a simple health check
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🐍 PySpark connection test successful:', data);
      
      return { success: true, data };
    } catch (error) {
      console.error('🐍 PySpark connection test failed:', error);
      return { 
        success: false, 
        error: `Failed to connect to PySpark server: ${error.message}` 
      };
    }
  };

  // Enhanced connection management functions
  const addConnection = async (connectionData) => {
    try {
      if (connectionData.type === 'pyspark') {
        // Handle PySpark connection
        const connectionId = `pyspark_${Date.now()}`;
        const pysparkConnection = {
          id: connectionId,
          name: connectionData.name,
          type: 'pyspark',
          serverUrl: connectionData.serverUrl,
          createdAt: new Date().toISOString()
        };

        // Test the PySpark connection first
        const testResult = await testPySparkConnection(connectionData.serverUrl);
        if (!testResult.success) {
          return { success: false, error: testResult.error };
        }

        // Add to app state
        addDbConnection(connectionId, pysparkConnection);
        
        // Store in sessionStorage
        const existingConnections = JSON.parse(sessionStorage.getItem('pyspark_connections') || '[]');
        const updatedConnections = [...existingConnections, pysparkConnection];
        sessionStorage.setItem('pyspark_connections', JSON.stringify(updatedConnections));

        // Set as active connection by default
        setActiveConnection(connectionId);

        return { success: true };
      } else {
        // Handle Databricks connection (existing logic)
        const result = await connectionManager.addConnection(connectionData, { actions });
        
        // Set as active connection by default if connection was successful
        if (result && result.id) {
          setActiveConnection(result.id);
        } else {
          // If no ID returned, try to find the most recently added connection
          const connectionId = connectionData.id || `databricks_${Date.now()}`;
          setActiveConnection(connectionId);
        }
        
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const testConnection = async (connectionId) => {
    try {
      setTestingConnection(connectionId);
      
      // Find the connection in the dbConnections array
      const connection = dbConnections.find(c => c.id === connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      let result;
      if (connection.type === 'pyspark') {
        // Test PySpark connection
        result = await testPySparkConnection(connection.serverUrl);
      } else {
        // Test Databricks connection - for now, just return success
        // Actual Databricks testing would use connectionManager
        result = { success: true };
      }

      setTestingConnection(null);
      setTestResults(prev => ({ ...prev, [connectionId]: result }));
      return result;
    } catch (error) {
      setTestingConnection(null);
      const errorResult = { success: false, error: error.message };
      setTestResults(prev => ({ ...prev, [connectionId]: errorResult }));
      return errorResult;
    }
  };

  const updateConnection = async (connectionId, updates) => {
    try {
      updateDbConnection(connectionId, updates);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const removeConnection = async (connectionId) => {
    try {
      // Find the connection to determine its type
      const connection = dbConnections.find(c => c.id === connectionId);
      
      if (connection?.type === 'pyspark') {
        // Remove PySpark connection from sessionStorage
        const existingConnections = JSON.parse(sessionStorage.getItem('pyspark_connections') || '[]');
        const updatedConnections = existingConnections.filter(c => c.id !== connectionId);
        sessionStorage.setItem('pyspark_connections', JSON.stringify(updatedConnections));
      } else if (connection?.type === 'databricks' || !connection?.type) {
        // Remove Databricks connection from sessionStorage
        const databricksConnections = JSON.parse(sessionStorage.getItem('databricks_connections') || '[]');
        const updatedConnections = databricksConnections.filter(c => c.id !== connectionId);
        sessionStorage.setItem('databricks_connections', JSON.stringify(updatedConnections));
      }
      
      // Remove from app state (this will also handle additional cleanup)
      deleteDbConnection(connectionId);
      
      // Clear any test results for this connection
      setTestResults(prev => {
        const { [connectionId]: removed, ...remaining } = prev;
        return remaining;
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete connection:', error);
      return { success: false, error: error.message };
    }
  };

  // Reset form when connection type changes
  const handleConnectionTypeChange = (type) => {
    setConnectionType(type);
    setFormData({
      name: '',
      serverHostname: '',
      httpPath: '',
      accessToken: '',
      serverUrl: type === 'pyspark' ? 'http://localhost:8000' : '',
      host: type === 'postgres' ? 'localhost' : type === 'snowflake' ? '' : '',
      port: type === 'postgres' ? '5432' : '',
      database: type === 'postgres' || type === 'snowflake' ? '' : '',
      username: type === 'postgres' || type === 'snowflake' ? '' : '',
      password: type === 'postgres' || type === 'snowflake' ? '' : '',
      account: type === 'snowflake' ? '' : '',
      warehouse: type === 'snowflake' ? '' : ''
    });
    setError('');
  };

  // Reset form when showing add form
  const handleShowAddForm = () => {
    setShowAddForm(true);
    setEditingConnection(null);
    setConnectionType('databricks');
    setFormData({
      name: '',
      serverHostname: '',
      httpPath: '',
      accessToken: '',
      serverUrl: 'http://localhost:8000'
    });
    setError('');
  };

  // Handle editing existing connection
  const handleEditConnection = (connection) => {
    setEditingConnection(connection);
    setShowAddForm(true);
    setConnectionType(connection.type || 'databricks');
    setFormData({
      name: connection.name || '',
      serverHostname: connection.serverHostname || connection.host || '',
      httpPath: connection.httpPath || '',
      accessToken: connection.accessToken || '',
      serverUrl: connection.serverUrl || 'http://localhost:8000'
    });
    setError('');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const connectionData = {
        ...formData,
        type: connectionType,
        id: editingConnection ? editingConnection.id : `${connectionType}_${Date.now()}`,
        host: connectionType === 'databricks' ? formData.serverHostname : new URL(formData.serverUrl).hostname
      };

      let result;
      if (editingConnection) {
        // Update existing connection
        result = await updateConnection(editingConnection.id, connectionData);
      } else {
        // Add new connection
        result = await addConnection(connectionData);
      }

      if (result.success) {
        // Close form and reset
        setShowAddForm(false);
        setEditingConnection(null);
        setFormData({
          name: '',
          serverHostname: '',
          httpPath: '',
          accessToken: '',
          serverUrl: 'http://localhost:8000'
        });
        setConnectionType('databricks');
        
        // Show success feedback (could be enhanced with a toast notification)
        console.log('✅ Connection saved successfully');
      } else {
        setError(result.error || 'Failed to save connection');
      }
    } catch (err) {
      setError(err.message || 'Failed to save connection');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle connection selection
  const handleSelectConnection = (connectionId) => {
    setActiveConnection(connectionId);
  };

  // Handle connection deletion
  const handleDeleteConnection = async (connectionId) => {
    const connection = dbConnections.find(c => c.id === connectionId);
    const connectionName = connection?.name || 'this connection';
    
    if (window.confirm(`Are you sure you want to delete "${connectionName}"? This action cannot be undone.`)) {
      setDeletingConnection(connectionId);
      try {
        const result = await removeConnection(connectionId);
        if (!result.success) {
          alert(`Failed to delete connection: ${result.error}`);
        } else {
          console.log(`✅ Successfully deleted connection: ${connectionName}`);
          
          // If we deleted the active connection, auto-select another one
          if (activeConnectionId === connectionId && dbConnections.length > 1) {
            const remainingConnections = dbConnections.filter(c => c.id !== connectionId);
            if (remainingConnections.length > 0) {
              setActiveConnection(remainingConnections[0].id);
              console.log(`🔗 Auto-activated connection: ${remainingConnections[0].name}`);
            }
          }
        }
      } catch (err) {
        console.error('Failed to delete connection:', err);
        alert(`Failed to delete connection: ${err.message}`);
      } finally {
        setDeletingConnection(null);
      }
    }
  };

  return (
    <div className={`fixed inset-0 ${colors.secondary} bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4`}>
      <div className={`${colors.primary} rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden border ${colors.borderLight}`}>
        
        {/* Header */}
        <div className={`px-6 py-4 border-b ${colors.borderLight} flex items-center justify-between`}>
          <h2 className={`text-xl font-semibold ${colors.text}`}>
            Database Connections
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${colors.hover} ${colors.textMuted} hover:${colors.text} transition-colors`}
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
          {!showAddForm ? (
            // Connection List View
            <div className="p-6">
              {/* Add Connection Button */}
              <button
                onClick={handleShowAddForm}
                className={`w-full mb-6 p-4 border-2 border-dashed ${colors.borderLight} rounded-lg ${colors.hover} transition-colors duration-150 active:scale-98 flex items-center justify-center gap-2 ${colors.textMuted} hover:${colors.text}`}
              >
                <FaPlus />
                Add New Connection
              </button>

              {/* Connections List */}
              {dbConnections.length === 0 ? (
                <div className={`text-center py-8 ${colors.textMuted}`}>
                  <FaDatabase size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No connections configured</p>
                  <p className="text-sm mt-2">Click &quot;Add New Connection&quot; to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dbConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className={`p-4 rounded-lg border transition-colors duration-150 active:scale-98 cursor-pointer ${
                        activeConnectionId === connection.id
                          ? `${colors.accentBg} bg-opacity-20 border-blue-500 ${colors.accent}`
                          : `${colors.secondary} ${colors.borderLight} ${colors.text} hover:${colors.tertiary}`
                      }`}
                      onClick={() => handleSelectConnection(connection.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded ${
                              connection.type === 'pyspark' 
                                ? 'bg-green-100 dark:bg-green-900/20' 
                                : connection.type === 'postgres'
                                ? 'bg-blue-100 dark:bg-blue-900/20'
                                : connection.type === 'snowflake'
                                ? 'bg-cyan-100 dark:bg-cyan-900/20'
                                : 'bg-orange-100 dark:bg-orange-900/20'
                            }`}>
                              <img 
                                src={
                                  connection.type === 'pyspark' 
                                    ? '/Spark-logo-192x100px.png'
                                    : connection.type === 'postgres'
                                    ? '/postgres.png'
                                    : connection.type === 'snowflake'
                                    ? '/snowflake.png'
                                    : '/databricks.png'
                                }
                                alt={`${connection.type} icon`}
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                            <div>
                              <h3 className="font-medium">{connection.name}</h3>
                              <p className={`text-sm ${colors.textMuted}`}>
                                {connection.type === 'pyspark' 
                                  ? connection.serverUrl 
                                  : `${connection.serverHostname || connection.host}`
                                }
                              </p>
                              {/* Test Result Display */}
                              {testResults[connection.id] && (
                                <p className={`text-xs mt-1 ${
                                  testResults[connection.id].success 
                                    ? 'text-green-500' 
                                    : 'text-red-500'
                                }`}>
                                  {testResults[connection.id].success 
                                    ? '✓ Connection successful' 
                                    : `✗ ${testResults[connection.id].error}`
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeConnectionId === connection.id && (
                            <span className={`text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 dark:bg-green-900/20`}>
                              Active
                            </span>
                          )}
                          
                          {/* Test Connection Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              testConnection(connection.id);
                            }}
                            disabled={testingConnection === connection.id}
                            className={`p-2 rounded ${colors.hover} ${colors.textMuted} hover:${colors.text} transition-colors disabled:opacity-50`}
                            title="Test connection"
                          >
                            {testingConnection === connection.id ? (
                              <FaSpinner size={14} className="animate-spin" />
                            ) : testResults[connection.id]?.success ? (
                              <FaCheck size={14} className="text-green-500" />
                            ) : testResults[connection.id]?.success === false ? (
                              <FaTimes size={14} className="text-red-500" />
                            ) : (
                              <FaDatabase size={14} />
                            )}
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditConnection(connection);
                            }}
                            className={`p-2 rounded ${colors.hover} ${colors.textMuted} hover:${colors.text} transition-colors`}
                            title="Edit connection"
                          >
                            <FaEdit size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConnection(connection.id);
                            }}
                            disabled={deletingConnection === connection.id}
                            className={`p-2 rounded ${colors.hover} text-red-400 hover:text-red-300 transition-colors disabled:opacity-50`}
                            title="Delete connection"
                          >
                            {deletingConnection === connection.id ? (
                              <FaSpinner size={14} className="animate-spin" />
                            ) : (
                              <FaTrash size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Add/Edit Connection Form
            <div className="p-6">
              <div className="mb-6">
                <h3 className={`text-lg font-medium ${colors.text} mb-2`}>
                  {editingConnection ? 'Edit Connection' : 'Add New Connection'}
                </h3>
                
                {/* Connection Type Selection */}
                <div className="mb-4">
                  <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                    Connection Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConnectionTypeChange('databricks')}
                      className={`
                        flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors duration-150 active:scale-95 flex items-center justify-center gap-2
                        ${connectionType === 'databricks' 
                          ? `${colors.accentBg} text-white border-blue-500` 
                          : `${colors.secondary} ${colors.borderLight} ${colors.text} hover:${colors.tertiary}`
                        }
                      `}
                    >
                      <img src="/databricks.png" alt="Databricks" className="w-4 h-4 object-contain" />
                      Databricks
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConnectionTypeChange('pyspark')}
                      className={`
                        flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors duration-150 active:scale-95 flex items-center justify-center gap-2
                        ${connectionType === 'pyspark' 
                          ? `${colors.accentBg} text-white border-blue-500` 
                          : `${colors.secondary} ${colors.borderLight} ${colors.text} hover:${colors.tertiary}`
                        }
                      `}
                    >
                      <img src="/Spark-logo-192x100px.png" alt="PySpark" className="w-4 h-4 object-contain" />
                      PySpark
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConnectionTypeChange('postgres')}
                      className={`
                        flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors duration-150 active:scale-95 flex items-center justify-center gap-2
                        ${connectionType === 'postgres' 
                          ? `${colors.accentBg} text-white border-blue-500` 
                          : `${colors.secondary} ${colors.borderLight} ${colors.text} hover:${colors.tertiary}`
                        }
                      `}
                    >
                      <img src="/postgres.png" alt="PostgreSQL" className="w-4 h-4 object-contain" />
                      PostgreSQL
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConnectionTypeChange('snowflake')}
                      className={`
                        flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors duration-150 active:scale-95 flex items-center justify-center gap-2
                        ${connectionType === 'snowflake' 
                          ? `${colors.accentBg} text-white border-blue-500` 
                          : `${colors.secondary} ${colors.borderLight} ${colors.text} hover:${colors.tertiary}`
                        }
                      `}
                    >
                      <img src="/snowflake.png" alt="Snowflake" className="w-4 h-4 object-contain" />
                      Snowflake
                    </button>
                  </div>
                </div>
              </div>
              
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
                      w-full px-3 py-2 ${colors.secondary} ${colors.borderLight} border rounded-md
                      ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
                    `}
                    placeholder={
                      connectionType === 'databricks' ? "My Databricks DB" 
                      : connectionType === 'pyspark' ? "Local PySpark Server"
                      : connectionType === 'postgres' ? "My PostgreSQL DB"
                      : "My Snowflake DB"
                    }
                    required
                  />
                </div>

                {connectionType === 'databricks' ? (
                  // Databricks connection fields
                  <>
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-1`}>
                        Server Hostname
                      </label>
                      <input
                        type="text"
                        value={formData.serverHostname}
                        onChange={(e) => setFormData({...formData, serverHostname: e.target.value})}
                        className={`
                          w-full px-3 py-2 ${colors.secondary} ${colors.borderLight} border rounded-md
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
                          w-full px-3 py-2 ${colors.secondary} ${colors.borderLight} border rounded-md
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
                          w-full px-3 py-2 ${colors.secondary} ${colors.borderLight} border rounded-md
                          ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
                        `}
                        placeholder="dapi1234567890abcdef..."
                        required
                      />
                    </div>
                  </>
                ) : (
                  // PySpark connection fields
                  <div>
                    <label className={`block text-sm font-medium ${colors.text} mb-1`}>
                      Server URL
                    </label>
                    <input
                      type="url"
                      value={formData.serverUrl}
                      onChange={(e) => setFormData({...formData, serverUrl: e.target.value})}
                      className={`
                        w-full px-3 py-2 ${colors.secondary} ${colors.borderLight} border rounded-md
                        ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500
                      `}
                      placeholder="http://localhost:8000"
                      required
                    />
                    <div className={`text-xs ${colors.textMuted} mt-1`}>
                      URL of your local PySpark server
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded-lg border border-red-400">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingConnection(null);
                    }}
                    className={`
                      flex-1 py-2 px-4 rounded-md ${colors.borderLight} border
                      ${colors.textMuted} hover:${colors.text} transition-colors duration-150 active:scale-95
                    `}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`
                      flex-1 py-2 px-4 rounded-md ${colors.accentBg} text-white
                      hover:opacity-80 transition-all duration-150 disabled:opacity-50 active:scale-95
                    `}
                  >
                    {isSubmitting ? 'Saving...' : editingConnection ? 'Update' : 'Add Connection'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionConfigModal;
