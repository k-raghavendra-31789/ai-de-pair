// Test script to verify the Excel attachment flow fix
// This simulates the condition logic to ensure proper flow routing

function testFlowLogic(sqlGenerated, currentSessionId, chatInput, excelAttachments) {
  console.log('\n=== Testing Flow Logic ===');
  console.log('sqlGenerated:', sqlGenerated);
  console.log('currentSessionId:', currentSessionId);
  console.log('chatInput:', chatInput);
  console.log('excelAttachments.length:', excelAttachments.length);
  
  // Excel upload logic (always runs if Excel attachments exist)
  if (excelAttachments.length > 0) {
    console.log('✅ Excel upload logic will execute → upload-excel-json endpoint');
  }
  
  // Single-pass logic (runs only if no Excel attachments)
  if (sqlGenerated && currentSessionId && chatInput.trim() && excelAttachments.length === 0) {
    console.log('✅ Single-pass logic will execute → single-pass endpoint (follow-up)');
    return 'single-pass';
  } else if (sqlGenerated && currentSessionId && chatInput.trim() && excelAttachments.length > 0) {
    console.log('✅ Excel with existing session → upload-excel-json only (NEW generation)');
    return 'excel-new-generation';
  } else if (excelAttachments.length > 0) {
    console.log('✅ Excel upload only → upload-excel-json endpoint');
    return 'excel-upload';
  } else {
    console.log('❌ No valid flow matched');
    return 'no-action';
  }
}

// Test scenarios
console.log('\n🧪 Test 1: First time Excel upload (no previous SQL)');
testFlowLogic(false, null, 'Generate SQL for this data', [{ name: 'data.xlsx' }]);

console.log('\n🧪 Test 2: Follow-up question after SQL generated (no Excel)');
testFlowLogic(true, 'session123', 'Can you add a WHERE clause?', []);

console.log('\n🧪 Test 3: FIXED - Same Excel file, different code type (PySpark)');
testFlowLogic(true, 'session123', 'Generate PySpark code for this', [{ name: 'data.xlsx' }]);

console.log('\n🧪 Test 4: New Excel file after previous session');
testFlowLogic(true, 'session123', 'Analyze this new data', [{ name: 'newdata.xlsx' }]);

console.log('\n🎯 Expected Results:');
console.log('Test 1: excel-upload (fresh start)');
console.log('Test 2: single-pass (follow-up modification)');
console.log('Test 3: excel-new-generation (NEW PySpark code, keep existing SQL)');
console.log('Test 4: excel-new-generation (NEW analysis, keep existing files)');
