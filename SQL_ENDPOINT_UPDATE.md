# SQL Execution Endpoint Update

## Change Summary
Updated the SQL execution endpoint to use the correct path structure.

### Before
```
http://127.0.0.1:8000/api/v1/data/execute-sql-databricks
```

### After 
```
http://127.0.0.1:8000/api/v1/sql/execute-databricks
```

## Changes Made

### Files Modified
- `src/services/DatabaseConnectionService.js`
  - Line 61: Updated `testConnection()` method endpoint
  - Line 161: Updated logging statement  
  - Line 165: Updated `executeSQL()` method endpoint

### Path Structure Changes
1. **Base path**: `/api/v1/data/` → `/api/v1/sql/`
2. **Endpoint name**: `execute-sql-databricks` → `execute-databricks`

## Impact
- All SQL execution requests (connection testing and query execution) now use the corrected endpoint
- Maintains backward compatibility for request payload structure
- No changes needed in request/response data formats

## Testing
After this change, verify that:
1. Database connection testing works correctly
2. SQL query execution functions properly
3. Backend server responds to the new endpoint path

## Files Using This Endpoint
- `DatabaseConnectionService.js` - Direct HTTP calls
- `ConnectionManager.js` - Uses DatabaseConnectionService
- `AppStateContext.js` - Uses ConnectionManager for SQL execution
- `MainEditor.js` - Triggers SQL execution via AppStateContext
- `TerminalPanel.js` - Triggers SQL execution via ConnectionManager
