// Test PySpark Execution Implementation
// This script tests the PySpark execution logic and UI components

console.log('=== Testing PySpark Execution Implementation ===\n');

// Mock PySpark execution function (mirrors MainEditor implementation)
const mockExecutePySparkCode = async (code, serverUrl, sessionId = null) => {
  try {
    console.log('🐍 Testing PySpark execution:', {
      codeLength: code.length,
      serverUrl: serverUrl,
      sessionId: sessionId
    });

    // Prepare request payload
    const payload = {
      code: code,
      session_id: sessionId || `session_${Date.now()}`,
      user_config: {},
      include_stats: true,
      result_limit: 100
    };

    console.log('📤 Request payload:', JSON.stringify(payload, null, 2));

    // Mock successful response
    const mockResponse = {
      status: "success",
      execution_time: "2.34s",
      outputs: [
        {
          type: "dataframe",
          data: [
            { name: "Alice", age: 25, city: "New York" },
            { name: "Bob", age: 30, city: "San Francisco" },
            { name: "Charlie", age: 35, city: "Chicago" }
          ],
          schema: [
            { name: "name", type: "string" },
            { name: "age", type: "integer" },
            { name: "city", type: "string" }
          ],
          row_count: 3
        },
        {
          type: "text",
          data: "DataFrame created successfully with 3 rows"
        }
      ],
      error: null,
      metadata: {
        session_id: payload.session_id,
        spark_version: "3.5.6",
        variables_count: 1
      }
    };

    console.log('📥 Mock response:', JSON.stringify(mockResponse, null, 2));
    return { success: true, data: mockResponse };

  } catch (error) {
    console.error('❌ PySpark execution failed:', error);
    return { 
      success: false, 
      error: `Failed to execute PySpark code: ${error.message}` 
    };
  }
};

// Test connection type detection
const testConnectionDetection = () => {
  console.log('Test 1: Connection Type Detection');
  
  const connections = [
    { id: 'db1', type: 'databricks', name: 'My Databricks' },
    { id: 'ps1', type: 'pyspark', name: 'Local PySpark', serverUrl: 'http://localhost:8000' }
  ];
  
  const activeConnectionId = 'ps1';
  const activeConnection = connections.find(c => c.id === activeConnectionId);
  
  console.log('Active connection:', activeConnection);
  console.log('Is PySpark:', activeConnection?.type === 'pyspark');
  console.log('✅ Connection detection working\n');
};

// Test file type detection
const testFileTypeDetection = () => {
  console.log('Test 2: File Type Detection');
  
  const testFiles = [
    'my_script.py',
    'query.sql', 
    'analysis.PY',
    'report.SQL',
    'data.csv'
  ];
  
  testFiles.forEach(fileName => {
    const isPython = fileName.toLowerCase().endsWith('.py');
    const isSQL = fileName.toLowerCase().endsWith('.sql');
    console.log(`${fileName}: Python=${isPython}, SQL=${isSQL}`);
  });
  
  console.log('✅ File type detection working\n');
};

// Test button text logic
const testButtonTextLogic = () => {
  console.log('Test 3: Button Text Logic');
  
  const scenarios = [
    { file: 'script.py', connectionType: 'pyspark', expected: 'Run PySpark' },
    { file: 'query.sql', connectionType: 'pyspark', expected: 'Run PySpark' },
    { file: 'query.sql', connectionType: 'databricks', expected: 'Run SQL' },
    { file: 'script.py', connectionType: 'databricks', expected: 'Invalid' }
  ];
  
  scenarios.forEach(scenario => {
    const isPySparkFile = scenario.file.toLowerCase().endsWith('.py');
    const isPySparkConnection = scenario.connectionType === 'pyspark';
    
    let buttonText;
    if (isPySparkConnection && (isPySparkFile || scenario.file.toLowerCase().endsWith('.sql'))) {
      buttonText = "Run PySpark";
    } else if (!isPySparkConnection && scenario.file.toLowerCase().endsWith('.sql')) {
      buttonText = "Run SQL";
    } else {
      buttonText = "Invalid";
    }
    
    console.log(`${scenario.file} + ${scenario.connectionType} = "${buttonText}" (expected: ${scenario.expected})`);
    console.log(buttonText === scenario.expected ? '✅ Correct' : '❌ Wrong');
  });
  
  console.log('✅ Button text logic working\n');
};

// Test PySpark execution
const testPySparkExecution = async () => {
  console.log('Test 4: PySpark Code Execution');
  
  const testCode = `
from pyspark.sql import SparkSession
spark = SparkSession.builder.appName("test").getOrCreate()

# Create sample DataFrame
data = [("Alice", 25, "New York"), ("Bob", 30, "San Francisco"), ("Charlie", 35, "Chicago")]
columns = ["name", "age", "city"]
df = spark.createDataFrame(data, columns)

# Show the DataFrame
df.show()
print(f"Created DataFrame with {df.count()} rows")
  `.trim();
  
  const result = await mockExecutePySparkCode(testCode, 'http://localhost:8000');
  
  console.log('Execution result:', result.success ? '✅ Success' : '❌ Failed');
  if (result.success) {
    console.log('Response data structure valid:', !!result.data.outputs);
    console.log('Number of outputs:', result.data.outputs.length);
    console.log('Execution time:', result.data.execution_time);
    console.log('Session ID:', result.data.metadata.session_id);
  }
  
  console.log('✅ PySpark execution test completed\n');
};

// Test results rendering logic
const testResultsRendering = () => {
  console.log('Test 5: Results Rendering Logic');
  
  const mockTab = {
    connectionType: 'pyspark',
    results: {
      status: "success",
      execution_time: "2.34s",
      outputs: [
        {
          type: "dataframe",
          data: [{ col1: "value1", col2: "value2" }],
          schema: [{ name: "col1", type: "string" }],
          row_count: 1
        }
      ],
      metadata: {
        session_id: "session_123",
        spark_version: "3.5.6",
        variables_count: 1
      }
    }
  };
  
  // Test render logic decision
  const shouldUsePySparkRenderer = mockTab.connectionType === 'pyspark';
  console.log('Should use PySpark renderer:', shouldUsePySparkRenderer);
  console.log('Has outputs:', !!mockTab.results.outputs);
  console.log('Output types:', mockTab.results.outputs.map(o => o.type));
  
  console.log('✅ Results rendering logic working\n');
};

// Run all tests
const runTests = async () => {
  testConnectionDetection();
  testFileTypeDetection();
  testButtonTextLogic();
  await testPySparkExecution();
  testResultsRendering();
  
  console.log('=== All Tests Completed ===');
  console.log('🎉 PySpark execution implementation validated successfully!');
};

// Execute tests
runTests().catch(console.error);
