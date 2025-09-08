/**
 * Database Connection Service
 * 
 * Handles database connection management including:
 * - Connection validation and testing
 * - Secure access token storage (with localStorage persistence)
 * - SQL execution via FastAPI backend
 * - Connection lifecycle management
 */

// Import storage key constant
const STORAGE_KEYS = {
  DB_CONNECTIONS: 'databricks_connections'
};

class DatabaseConnectionService {
  constructor() {
    // In-memory storage for access tokens (with localStorage persistence)
    this.accessTokens = new Map(); // connectionId -> access_token
    this.baseURL = 'http://127.0.0.1:8000'; // FastAPI backend
    
    // Load persisted access tokens from localStorage on initialization
    this.loadAccessTokensFromStorage();
  }

  /**
   * Load access tokens from localStorage
   */
  loadAccessTokensFromStorage() {
    try {
      const stored = localStorage.getItem('db_access_tokens');
      if (stored) {
        const tokens = JSON.parse(stored);
        // Convert plain object back to Map
        Object.entries(tokens).forEach(([connectionId, token]) => {
          this.accessTokens.set(connectionId, token);
        });
        console.log('🔑 Loaded', this.accessTokens.size, 'access tokens from localStorage');
      }
    } catch (error) {
      console.warn('🔑 Failed to load access tokens from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem('db_access_tokens');
    }
  }

  /**
   * Save access tokens to localStorage
   */
  saveAccessTokensToStorage() {
    try {
      // Convert Map to plain object for JSON storage
      const tokens = Object.fromEntries(this.accessTokens);
      localStorage.setItem('db_access_tokens', JSON.stringify(tokens));
      console.log('🔑 Saved', this.accessTokens.size, 'access tokens to localStorage');
    } catch (error) {
      console.warn('🔑 Failed to save access tokens to localStorage:', error);
    }
  }

  /**
   * Generate unique connection ID
   */
  generateConnectionId() {
    return `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate connection parameters
   */
  validateConnection(connectionData) {
    const required = ['name', 'serverHostname', 'httpPath', 'accessToken'];
    const missing = required.filter(field => !connectionData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Basic validation
    if (!connectionData.serverHostname.includes('.')) {
      throw new Error('Invalid server hostname format');
    }

    if (!connectionData.httpPath.startsWith('/')) {
      throw new Error('HTTP path must start with /');
    }

    return true;
  }

  /**
   * Test database connection
   */
  async testConnection(connectionData) {
    try {
      this.validateConnection(connectionData);

      // Test connection by running a simple SQL query
      const response = await fetch(`${this.baseURL}/api/v1/sql/execute-databricks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT 1 AS test_connection',
          server_hostname: connectionData.serverHostname,
          http_path: connectionData.httpPath,
          access_token: connectionData.accessToken
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Connection test failed');
      }

      return { success: true, message: 'Connection successful' };
    } catch (error) {
      console.error('Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add new database connection
   */
  async addConnection(connectionData) {
    try {
      console.log('🔧 Adding connection:', connectionData.name);
      
      // Validate connection first
      this.validateConnection(connectionData);

      // Generate unique ID
      const connectionId = this.generateConnectionId();
      console.log('🔧 Generated connection ID:', connectionId);
      
      // Store access token in memory and persist to localStorage
      this.updateAccessToken(connectionId, connectionData.accessToken);
      console.log('🔧 Access token stored for:', connectionId);
      console.log('🔧 Total tokens stored:', this.accessTokens.size);

      // Create connection metadata (without access token)
      const connectionMetadata = {
        id: connectionId,
        name: connectionData.name,
        serverHostname: connectionData.serverHostname,
        httpPath: connectionData.httpPath,
        type: connectionData.type || 'databricks',
        createdAt: new Date().toISOString(),
        lastUsed: null
      };

      console.log('🔧 Connection metadata created:', connectionMetadata);
      return connectionMetadata;
    } catch (error) {
      console.error('Failed to add connection:', error);
      throw error;
    }
  }

  /**
   * Execute SQL query using connection
   */
  async executeSQL(connectionId, sqlQuery, options = {}) {
    try {
      console.log('🚀 Executing SQL for connection:', connectionId);
      console.log('🚀 Query:', sqlQuery.substring(0, 100) + '...');
      console.log('🚀 Total tokens in memory:', this.accessTokens.size);
      console.log('🚀 Available connection IDs:', Array.from(this.accessTokens.keys()));
      
      const accessToken = this.accessTokens.get(connectionId);
      console.log('🚀 Access token found:', accessToken ? 'YES' : 'NO');
      
      if (!accessToken) {
        console.error('🚀 No access token found for connection:', connectionId);
        throw new Error('Connection not found or access token missing');
      }

      // Get connection metadata from localStorage to get server details
      // Check both the new key and legacy keys for backwards compatibility
      let connections = JSON.parse(localStorage.getItem(STORAGE_KEYS.DB_CONNECTIONS) || '[]');
      
      // If no connections found, try legacy locations
      if (connections.length === 0) {
        // Try legacy key
        const legacyConnections = JSON.parse(localStorage.getItem('databricks_connections') || '[]');
        if (legacyConnections.length > 0) {
          connections = legacyConnections;
          console.log('🚀 Using legacy connections from databricks_connections key');
        }
      }
      
      console.log('🚀 Connections in storage:', connections.length);
      console.log('🚀 Looking for connection ID:', connectionId);
      
      const connection = connections.find(conn => conn.id === connectionId);
      console.log('🚀 Connection metadata found:', connection ? 'YES' : 'NO');
      
      // If still not found, log all available connection IDs for debugging
      if (!connection) {
        console.log('🚀 Available connection IDs:', connections.map(c => c.id));
      }
      
      if (!connection) {
        console.error('🚀 Connection metadata not found for:', connectionId);
        throw new Error('Connection metadata not found');
      }

      const requestBody = {
        sql: sqlQuery,
        server_hostname: connection.serverHostname,
        http_path: connection.httpPath,
        access_token: accessToken
      };

      console.log('🚀 Request URL:', `${this.baseURL}/api/v1/sql/execute-databricks`);
      console.log('🚀 Request body (no token):', {
        sql: sqlQuery.substring(0, 100) + '...',
        server_hostname: connection.serverHostname,
        http_path: connection.httpPath,
        access_token: '[HIDDEN]'
      });
      
      const response = await fetch(`${this.baseURL}/api/v1/sql/execute-databricks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('🚀 Response status:', response.status);
      console.log('🚀 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🚀 Error response text:', errorText);
        
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          error = { detail: errorText };
        }
        
        console.error('🚀 Backend error:', error);
        throw new Error(error.detail || 'SQL execution failed');
      }

      const result = await response.json();
      console.log('🚀 SQL execution successful!');
      return result;
    } catch (error) {
      console.error('🚀 SQL execution failed:', error);
      throw error;
    }
  }

  /**
   * Get access token for connection (internal use)
   */
  getAccessToken(connectionId) {
    return this.accessTokens.get(connectionId);
  }

  /**
   * Update access token for connection
   */
  updateAccessToken(connectionId, accessToken) {
    this.accessTokens.set(connectionId, accessToken);
    // Persist to localStorage whenever tokens are updated
    this.saveAccessTokensToStorage();
  }

  /**
   * Remove connection (clear access token)
   */
  removeConnection(connectionId) {
    this.accessTokens.delete(connectionId);
    // Persist changes to localStorage
    this.saveAccessTokensToStorage();
  }

  /**
   * Check if connection has valid access token
   */
  hasValidToken(connectionId) {
    return this.accessTokens.has(connectionId);
  }

  /**
   * Get all connection IDs that have access tokens
   */
  getActiveConnections() {
    return Array.from(this.accessTokens.keys());
  }

  /**
   * Clear all access tokens (e.g., on logout/session end)
   */
  clearAllTokens() {
    this.accessTokens.clear();
    // Clear from localStorage as well
    localStorage.removeItem('db_access_tokens');
  }

  /**
   * Clear all connections and tokens
   */
  async clearAllConnections() {
    try {
      // Clear all access tokens
      this.clearAllTokens();
      
      // Clear local storage
      localStorage.removeItem('db_connections');
      
      return { success: true };
    } catch (error) {
      console.error('Failed to clear all connections:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const databaseConnectionService = new DatabaseConnectionService();
export default databaseConnectionService;
