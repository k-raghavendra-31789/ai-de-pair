// Test for SQL error display fix
// This simulates the backend response structure you showed

const testErrorDisplay = () => {
  // Test case 1: Error with detail property
  const mockDisplayData1 = {
    id: 'dbk-example',
    results: {
      status: 'error',
      error: {
        detail: "[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `orderkey` cannot be resolved. Did you mean one of the following? [`order_key`, `o_orderkey`]"
      }
    },
    error: null
  };

  // Test case 2: Error with type, message, traceback structure
  const mockDisplayData2 = {
    id: 'dbk-example-2',
    results: {
      status: 'error',
      error: {
        type: 'UNRESOLVED_COLUMN',
        message: "A column, variable, or function parameter with name `orderkey` cannot be resolved",
        traceback: ["line 1", "line 2"]
      }
    },
    error: null
  };

  // Test case 3: Simple string error
  const mockDisplayData3 = {
    id: 'dbk-example-3',
    results: {
      status: 'error',
      error: "Simple error message"
    },
    error: null
  };

  // Test the error extraction logic for each case
  const extractError = (displayData) => {
    if (displayData.error) {
      return typeof displayData.error === 'string' ? displayData.error : JSON.stringify(displayData.error);
    }
    
    const resultError = displayData.results?.error;
    if (resultError) {
      if (resultError.detail) return resultError.detail;
      if (resultError.message) return resultError.message;
      if (resultError.type && resultError.message) return `${resultError.type}: ${resultError.message}`;
      if (typeof resultError === 'string') return resultError;
      return JSON.stringify(resultError);
    }
    
    return 'Unknown error occurred';
  };

  console.log('🧪 Testing different error structures:');
  console.log('Case 1 (detail):', extractError(mockDisplayData1));
  console.log('Case 2 (type/message):', extractError(mockDisplayData2));
  console.log('Case 3 (string):', extractError(mockDisplayData3));
};

// Run the test
console.log('🧪 Running comprehensive error display test...');
testErrorDisplay();
