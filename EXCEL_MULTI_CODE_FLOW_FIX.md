# Excel Multi-Code Generation Flow Fix

## Problem Description

When a user attached the same Excel file in the same session wanting a different code type (like PySpark instead of SQL), the system was incorrectly:

1. **Sending two requests**: One to `upload-excel-json` (correct) and another to `single-pass` endpoint (incorrect)
2. **Updating existing SQL file**: Instead of creating a new PySpark file
3. **Showing confusing messages**: "Updated SQL in chat-generated-sql-xxx.sql" when user wanted PySpark

## Root Cause

The flow logic had a condition that triggered both flows simultaneously:

```javascript
// Excel upload logic (always executed if Excel attachments exist)
if (excelAttachments.length > 0) {
  // Sends to upload-excel-json endpoint ✅
}

// Single-pass logic (executed if SQL was generated before)
if (sqlGenerated && currentSessionId && chatInput.trim()) {
  // Sends to single-pass endpoint ❌ (should NOT happen with Excel attachments)
}
```

When a user attached Excel wanting PySpark after generating SQL:

- `excelAttachments.length > 0` → Excel upload executes
- `sqlGenerated = true` → Single-pass ALSO executes
- Result: Two requests, wrong behavior

## Solution Implemented

### 1. **Fixed Flow Logic**

Updated the single-pass condition to exclude cases with Excel attachments:

```javascript
// Single-pass logic (only if NO Excel attachments)
if (
  sqlGenerated &&
  currentSessionId &&
  chatInput.trim() &&
  excelAttachments.length === 0
) {
  // Send to single-pass endpoint for follow-up questions
}
```

### 2. **Added Explicit Flow Handling**

Added clear handling for Excel + existing session scenarios:

```javascript
} else if (sqlGenerated && currentSessionId && chatInput.trim() && excelAttachments.length > 0) {
  // Excel file attached with existing session - new upload will generate fresh code
  console.log('📁 Excel file attached in existing session - skipping single-pass, using upload flow');
  console.log('✅ Upload process will generate new code while preserving existing files');
}
```

### 3. **Enhanced Session Management**

Updated session tracking when new Excel uploads occur:

```javascript
// Update session tracking for new Excel upload
if (responseData.session_id) {
  setCurrentSessionId(responseData.session_id);

  // Reset SQL generated flag for new generation process
  if (responseData.session_id !== currentSessionId) {
    setSqlGenerated(false);
  }
}
```

### 4. **Improved Logging**

Added comprehensive logging to track the flow:

```javascript
console.log('🚀 Sending Excel data to backend for NEW code generation...');
if (sqlGenerated) {
  console.log(
    '📝 Note: Existing code files will be preserved, new code will be generated separately'
  );
}
console.log(
  '🎯 Target: upload-excel-json endpoint (fresh generation, not modification)'
);
```

## Expected Behavior After Fix

### Scenario 1: First Excel Upload

- **Flow**: Excel → `upload-excel-json` → Questions → Generate SQL
- **Result**: New SQL file created

### Scenario 2: Follow-up Question (No Excel)

- **Flow**: Text message → `single-pass` → Modified SQL
- **Result**: Existing SQL file updated

### Scenario 3: Same Excel, Different Code Type (FIXED)

- **Flow**: Excel + Message → `upload-excel-json` ONLY → Questions → Generate PySpark
- **Result**: New PySpark file created, existing SQL preserved

### Scenario 4: New Excel File

- **Flow**: Excel → `upload-excel-json` → Fresh session → New code
- **Result**: New code file, existing files preserved

## Testing

Created test script `test-excel-flow-fix.js` that verifies:

✅ **Test 1**: First time Excel upload → excel-upload  
✅ **Test 2**: Follow-up question → single-pass  
✅ **Test 3**: Same Excel, different code → excel-new-generation  
✅ **Test 4**: New Excel file → excel-new-generation

## Files Modified

- `src/components/ChatPanel.js`: Fixed flow logic and session management
- `test-excel-flow-fix.js`: Test script for verification

## Impact

- ✅ **Prevents dual requests** when Excel is attached
- ✅ **Creates separate files** for different code types
- ✅ **Preserves existing work** when generating new code
- ✅ **Clear user experience** with appropriate messaging
- ✅ **Proper session management** for multi-generation workflows

## User Experience

**Before Fix:**

```
User uploads Excel → Generates SQL
User uploads same Excel for PySpark → "Updated SQL in file.sql" + PySpark code
```

**After Fix:**

```
User uploads Excel → Generates SQL
User uploads same Excel for PySpark → Creates new PySpark file, keeps SQL
```
