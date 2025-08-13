/**
 * Database Connection Debug Utilities
 * 
 * Use these functions to debug connection issues
 */

import { databaseConnectionService } from './DatabaseConnectionService.js';

// Debug connection storage
export const debugConnectionStorage = () => {
  console.log('=== Database Connection Debug Info ===');
  
  // Check sessionStorage
  const connections = sessionStorage.getItem('databricks_connections');
  console.log('SessionStorage (databricks_connections):', connections);
  
  if (connections) {
    try {
      const parsed = JSON.parse(connections);
      console.log('Parsed connections:', parsed);
      console.log('Number of connections:', parsed.length);
    } catch (e) {
      console.error('Failed to parse connections:', e);
    }
  }
  
  // Check if service exists
  try {
    console.log('Service loaded:', !!databaseConnectionService);
    
    // Check access tokens (without exposing them)
    console.log('Access tokens stored:', databaseConnectionService.accessTokens.size);
    console.log('Token IDs:', Array.from(databaseConnectionService.accessTokens.keys()));
  } catch (e) {
    console.error('Service check failed:', e);
  }
  
  console.log('=====================================');
};

// Test connection data flow
export const testConnectionFlow = (connectionId) => {
  console.log(`=== Testing Connection Flow for ${connectionId} ===`);
  
  // 1. Check if connection exists in sessionStorage
  const connections = JSON.parse(sessionStorage.getItem('databricks_connections') || '[]');
  const connection = connections.find(conn => conn.id === connectionId);
  console.log('Connection metadata found:', !!connection);
  if (connection) {
    console.log('Connection details:', {
      id: connection.id,
      name: connection.name,
      hostname: connection.serverHostname,
      path: connection.httpPath
    });
  }
  
  // 2. Check if access token exists
  try {
    const hasToken = databaseConnectionService.hasValidToken(connectionId);
    console.log('Access token exists:', hasToken);
  } catch (e) {
    console.error('Token check failed:', e);
  }
  
  console.log('=====================================');
};

// Quick fix for common issues
export const quickFix = () => {
  console.log('=== Quick Fix Attempt ===');
  
  // Clear any corrupted data
  const connections = sessionStorage.getItem('databricks_connections');
  if (connections) {
    try {
      JSON.parse(connections);
      console.log('✅ SessionStorage data is valid JSON');
    } catch (e) {
      console.log('❌ Corrupted sessionStorage data, clearing...');
      sessionStorage.removeItem('databricks_connections');
    }
  }
  
  console.log('=========================');
};

// Add to window for easy access in browser console
if (typeof window !== 'undefined') {
  window.debugDB = {
    storage: debugConnectionStorage,
    flow: testConnectionFlow,
    fix: quickFix
  };
  console.log('🔧 Debug utilities available: window.debugDB');
}
