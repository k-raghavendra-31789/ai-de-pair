// Debug PySpark Connection Detection
// This script helps debug the connection detection issue

console.log('=== Debugging PySpark Connection Detection ===\n');

// Simulate the getActiveConnection function with fallback logic
const testGetActiveConnection = (activeConnectionId, dbConnections) => {
  console.log('Testing getActiveConnection with:', {
    activeConnectionId,
    dbConnectionsLength: dbConnections.length
  });

  if (!activeConnectionId || !dbConnections.length) {
    console.log('🔍 No connections in dbConnections, checking sessionStorage fallback...');
    
    // Fallback: Check PySpark connections directly from sessionStorage
    try {
      const pysparkConnections = JSON.parse(mockSessionStorage.getItem('pyspark_connections') || '[]');
      console.log('📦 PySpark connections from sessionStorage:', pysparkConnections);
      
      const pysparkConnection = pysparkConnections.find(conn => conn.id === activeConnectionId);
      if (pysparkConnection) {
        console.log('🐍 Found PySpark connection in sessionStorage:', pysparkConnection);
        return pysparkConnection;
      }
    } catch (error) {
      console.warn('Failed to load PySpark connections from sessionStorage:', error);
    }
    return null;
  }
  
  const found = dbConnections.find(conn => conn.id === activeConnectionId);
  console.log('🔍 Found in dbConnections:', found);
  return found;
};

// Test scenarios
const testScenarios = [
  {
    name: "Empty dbConnections with PySpark in sessionStorage",
    activeConnectionId: 'pyspark_123',
    dbConnections: [],
    mockSessionStorage: [
      { id: 'pyspark_123', name: 'Local PySpark', type: 'pyspark', serverUrl: 'http://localhost:8000' }
    ]
  },
  {
    name: "PySpark in dbConnections",
    activeConnectionId: 'pyspark_123', 
    dbConnections: [
      { id: 'pyspark_123', name: 'Local PySpark', type: 'pyspark', serverUrl: 'http://localhost:8000' }
    ],
    mockSessionStorage: []
  },
  {
    name: "Databricks in dbConnections",
    activeConnectionId: 'databricks_456',
    dbConnections: [
      { id: 'databricks_456', name: 'My Databricks', type: 'databricks' }
    ],
    mockSessionStorage: []
  }
];

// Mock sessionStorage for testing (Node.js environment)
const mockSessionStorage = {
  store: {},
  getItem: function(key) {
    return this.store[key] || null;
  },
  setItem: function(key, value) {
    this.store[key] = value;
  }
};

console.log('Test 1: Connection Detection Logic');
testScenarios.forEach((scenario, index) => {
  console.log(`\n--- Scenario ${index + 1}: ${scenario.name} ---`);
  
  // Mock sessionStorage for this scenario
  mockSessionStorage.setItem('pyspark_connections', JSON.stringify(scenario.mockSessionStorage));
  
  const result = testGetActiveConnection(scenario.activeConnectionId, scenario.dbConnections);
  console.log('Result:', result);
  console.log('Is PySpark:', result?.type === 'pyspark');
});

// Test button logic
console.log('\n\nTest 2: Button Logic Validation');
const buttonLogicTests = [
  { fileName: 'script.py', connectionType: 'pyspark', expected: 'PySpark execution' },
  { fileName: 'query.sql', connectionType: 'pyspark', expected: 'PySpark execution' },
  { fileName: 'query.sql', connectionType: 'databricks', expected: 'SQL execution' },
  { fileName: 'script.py', connectionType: 'databricks', expected: 'Invalid combination' },
  { fileName: 'script.py', connectionType: null, expected: 'Invalid combination' }
];

buttonLogicTests.forEach((test, index) => {
  console.log(`\n--- Button Test ${index + 1}: ${test.fileName} + ${test.connectionType || 'null'} ---`);
  
  const isPySparkFile = test.fileName.toLowerCase().endsWith('.py');
  const isPySparkConnection = test.connectionType === 'pyspark';
  const isSQLFile = test.fileName.toLowerCase().endsWith('.sql');
  
  let action;
  if (isPySparkConnection && (isPySparkFile || isSQLFile)) {
    action = 'PySpark execution';
  } else if (!isPySparkConnection && isSQLFile) {
    action = 'SQL execution';
  } else {
    action = 'Invalid combination';
  }
  
  console.log(`Expected: ${test.expected}, Got: ${action}`);
  console.log(action === test.expected ? '✅ PASS' : '❌ FAIL');
});

console.log('\n=== Debug Complete ===');
console.log('💡 If the issue persists, check:');
console.log('1. Browser console for connection detection logs');
console.log('2. TerminalPanel PySpark connection setup');
console.log('3. SessionStorage content for pyspark_connections');
console.log('4. ActiveConnectionId value in AppState');
