/**
 * Database Connection Manager
 * 
 * High-level utilities for managing database connections
 * Integrates with AppStateContext and DatabaseConnectionService
 */

import { databaseConnectionService } from './DatabaseConnectionService.js';

export class ConnectionManager {
  /**
   * Add a new database connection
   */
  async addConnection(connectionData, appStateContext = null) {
    try {
      console.log('📋 ConnectionManager: Adding connection:', connectionData.name);
      
      // Add connection to service
      const connectionMetadata = await databaseConnectionService.addConnection(connectionData);
      console.log('📋 ConnectionManager: Service returned metadata:', connectionMetadata);

      // Add to app state if context provided
      if (appStateContext) {
        // Pass the original connection data so the action can create its own metadata
        appStateContext.actions.addDbConnection(connectionMetadata.id, {
          name: connectionData.name,
          serverHostname: connectionData.serverHostname,
          httpPath: connectionData.httpPath,
          type: 'databricks'
        });
        console.log('📋 ConnectionManager: Added to app state');
        
        // Set as active connection by default
        appStateContext.actions.setActiveConnection(connectionMetadata.id);
        console.log('📋 ConnectionManager: Set as active connection:', connectionMetadata.id);
      }

      // Store token in service
      databaseConnectionService.updateAccessToken(connectionMetadata.id, connectionData.accessToken);
      console.log('📋 ConnectionManager: Token stored for:', connectionMetadata.id);

      // Store metadata in localStorage
      const existingConnections = JSON.parse(localStorage.getItem('databricks_connections') || '[]');
      const updatedConnections = [...existingConnections, connectionMetadata];
      localStorage.setItem('databricks_connections', JSON.stringify(updatedConnections));
      console.log('📋 ConnectionManager: Metadata stored in localStorage');

      return connectionMetadata;
    } catch (error) {
      console.error('📋 ConnectionManager: Failed to add connection:', error);
      throw error;
    }
  }  /**
   * Test an existing connection
   */
  static async testConnection(connectionId, state, actions) {
    try {
      const connection = state.dbConnections.find(conn => conn.id === connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const accessToken = databaseConnectionService.getAccessToken(connectionId);
      if (!accessToken) {
        throw new Error('Access token not found - please reconnect');
      }

      const testResult = await databaseConnectionService.testConnection({
        name: connection.name,
        serverHostname: connection.serverHostname,
        httpPath: connection.httpPath,
        accessToken: accessToken
      });

      // Update connection status
      actions.setConnectionStatus(connectionId, {
        isConnected: testResult.success,
        error: testResult.success ? null : testResult.error
      });

      return testResult;
    } catch (error) {
      console.error('Connection test failed:', error);
      
      // Update connection status
      actions.setConnectionStatus(connectionId, {
        isConnected: false,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

    /**
   * Execute SQL query on a connection
   */
  async executeSQL(connectionId, query, appStateContext = null) {
    try {
      console.log('📋 ConnectionManager: Executing SQL for:', connectionId);
      console.log('📋 ConnectionManager: Query:', query.substring(0, 50) + '...');
      
      const result = await databaseConnectionService.executeSQL(connectionId, query);
      console.log('📋 ConnectionManager: Raw result from service:', result);
      console.log('📋 ConnectionManager: Result type:', typeof result);
      console.log('📋 ConnectionManager: Result keys:', result ? Object.keys(result) : 'null');
      console.log('📋 ConnectionManager: SQL execution completed');
      
      return result;
    } catch (error) {
      console.error('📋 ConnectionManager: SQL execution failed:', error);
      
      // If authentication failed, update connection status
      if (error.message.includes('not authenticated') || error.message.includes('access token')) {
        if (appStateContext) {
          appStateContext.actions.setConnectionStatus(connectionId, 'error');
        }
      }
      
      throw error;
    }
  }

  /**
   * Remove a database connection
   */
  static removeConnection(connectionId, actions) {
    try {
      // Remove from service (clears access token)
      databaseConnectionService.removeConnection(connectionId);
      
      // Remove from app state
      actions.deleteDbConnection(connectionId);

      return { success: true };
    } catch (error) {
      console.error('Failed to remove connection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reconnect with new access token
   */
  static reconnectWithToken(connectionId, accessToken, actions) {
    try {
      // Update access token in service
      databaseConnectionService.updateAccessToken(connectionId, accessToken);
      
      // Clear previous error status
      actions.setConnectionStatus(connectionId, {
        isConnected: true,
        error: null
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to reconnect:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get connection status
   */
  static getConnectionStatus(connectionId, state) {
    const connection = state.dbConnections.find(conn => conn.id === connectionId);
    if (!connection) {
      return { exists: false };
    }

    const status = state.connectionStatus[connectionId] || {};
    const hasToken = databaseConnectionService.hasValidToken(connectionId);

    return {
      exists: true,
      connection: connection,
      isConnected: status.isConnected && hasToken,
      error: status.error,
      lastChecked: status.lastChecked,
      hasToken: hasToken
    };
  }

  /**
   * Get all connections with their status
   */
  static getAllConnectionsStatus(state) {
    return state.dbConnections.map(connection => ({
      ...connection,
      status: ConnectionManager.getConnectionStatus(connection.id, state)
    }));
  }

  /**
   * Clear all connections (e.g., on logout)
   */
  static clearAllConnections(actions) {
    try {
      // Clear all access tokens
      databaseConnectionService.clearAllTokens();
      
      // Clear local storage
      localStorage.removeItem('db_connections');
      
      // Reset state (this will be handled by the individual delete actions)
      // For now, we don't have a bulk clear action, so we'd need to add one
      // or clear them individually
      
      return { success: true };
    } catch (error) {
      console.error('Failed to clear connections:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const connectionManager = new ConnectionManager();
export default connectionManager;
export { connectionManager };
