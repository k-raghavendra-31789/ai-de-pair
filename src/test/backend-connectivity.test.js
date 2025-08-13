/**
 * Quick test to check if FastAPI backend is running
 */

const testBackendAvailability = async () => {
  console.log('Testing FastAPI backend availability...');
  
  try {
    // Test 1: Basic connectivity
    const response = await fetch('http://127.0.0.1:8000/', {
      method: 'GET',
    });
    
    console.log('✅ Backend is reachable');
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.text();
      console.log('Response:', data);
    }
    
    // Test 2: Check /run-sql endpoint
    console.log('\nTesting /run-sql endpoint...');
    const sqlResponse = await fetch('http://127.0.0.1:8000/run-sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT 1 AS test',
        server_hostname: 'test',
        http_path: 'test', 
        access_token: 'test'
      })
    });
    
    console.log('SQL endpoint status:', sqlResponse.status);
    
    if (sqlResponse.ok) {
      console.log('✅ /run-sql endpoint exists and responds');
    } else {
      const errorText = await sqlResponse.text();
      console.log('❌ /run-sql endpoint error:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Backend not reachable:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Is your FastAPI backend running on http://127.0.0.1:8000?');
    console.log('2. Start it with: python -m uvicorn main:app --host 127.0.0.1 --port 8000');
    console.log('3. Make sure CORS is configured to allow localhost:3000');
  }
};

// Run the test
testBackendAvailability();
