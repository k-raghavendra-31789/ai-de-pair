// Test React object rendering fixes

const testReactObjectRendering = () => {
  console.log('🧪 Testing React object rendering safety...');
  
  // Test case 1: Object in table cell
  const mockCellData = [
    ['string_value', 42, null],
    ['another_string', { type: 'error', message: 'test error', traceback: ['line1'] }, true],
    [undefined, { complex: { nested: 'object' } }, 'normal']
  ];
  
  const safeRenderCell = (cell) => {
    return typeof cell === 'object' && cell !== null 
      ? JSON.stringify(cell) 
      : String(cell ?? '');
  };
  
  console.log('Cell rendering tests:');
  mockCellData.forEach((row, rowIndex) => {
    console.log(`Row ${rowIndex}:`);
    row.forEach((cell, cellIndex) => {
      const rendered = safeRenderCell(cell);
      console.log(`  Cell ${cellIndex}: ${typeof cell} -> "${rendered}"`);
    });
  });
  
  // Test case 2: Tab ID safety
  const mockTabIds = [
    'normal-string',
    123,
    { complex: 'object' },
    null,
    undefined
  ];
  
  const safeRenderTabId = (id) => String(id || '');
  
  console.log('\nTab ID rendering tests:');
  mockTabIds.forEach((id, index) => {
    const rendered = safeRenderTabId(id);
    console.log(`Tab ${index}: ${typeof id} -> "${rendered}"`);
  });
  
  // Test case 3: Error object rendering
  const mockErrors = [
    'simple string error',
    { detail: 'error with detail' },
    { type: 'ERROR_TYPE', message: 'error message', traceback: ['trace1'] },
    { message: 'just message' },
    null
  ];
  
  const safeRenderError = (errorObj) => {
    if (!errorObj) return 'Unknown error occurred';
    if (typeof errorObj === 'string') return errorObj;
    if (errorObj.detail) return errorObj.detail;
    if (errorObj.message) return errorObj.message;
    if (errorObj.type && errorObj.message) return `${errorObj.type}: ${errorObj.message}`;
    return JSON.stringify(errorObj);
  };
  
  console.log('\nError rendering tests:');
  mockErrors.forEach((error, index) => {
    const rendered = safeRenderError(error);
    console.log(`Error ${index}: ${typeof error} -> "${rendered}"`);
  });
};

testReactObjectRendering();
