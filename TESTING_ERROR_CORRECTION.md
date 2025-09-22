# Testing the AI Error Correction Feature

## Testing Instructions

### Prerequisites

1. Start the development server: `npm start`
2. Open the application in a browser
3. Make sure terminal panel is visible

### Test Case 1: SQL Error Correction

1. **Create SQL file with error**:
   - Create a new `.sql` file in the editor
   - Add SQL code with intentional errors:
   ```sql
   select name, email from users where id = 1
   ```
2. **Trigger SQL execution error**:

   - Configure a database connection (any connection is fine for testing)
   - Click "Run SQL" button
   - Wait for error to appear in terminal panel

3. **Activate AI error correction**:

   - Verify you see "🤖 AI Fix" button and "💡 Ctrl+Shift+K" hint in the terminal error display
   - **Option 1**: Click the "🤖 AI Fix" button
   - **Option 2**: Press `Ctrl+Shift+K` while terminal is focused
   - Verify correction toolbar appears in Monaco Editor
   - Verify error message is pre-filled in instructions area

4. **Test AI correction**:
   - Modify or add to the pre-filled instructions if desired
   - Click the correction button in the toolbar
   - Wait for mock AI processing (1 second delay)
   - Verify inline diff appears showing corrected SQL
   - Verify you can accept or reject the changes

### Test Case 2: PySpark Error Correction

1. **Create Python file with error**:

   - Create a new `.py` file in the editor
   - Add Python/PySpark code with intentional errors:

   ```python
   from pyspark.sql import SparkSession
   spark = SparkSession.builder.appName("test").getOrCreate()
   df = spark.read.csv("data.csv")
   df.show()
   ```

2. **Trigger PySpark execution error**:

   - Configure a PySpark connection
   - Click "Run PySpark" button
   - Wait for error to appear in terminal panel

3. **Test error correction flow** (same as SQL):
   - Look for "🤖 AI Fix" button and "💡 Ctrl+Shift+K" hint
   - Click the AI Fix button OR press `Ctrl+Shift+K`
   - Verify correction interface activates
   - Test AI correction with mock Python fixes

### Expected Results

✅ **Error Detection**: Errors from SQL/PySpark execution are automatically detected
✅ **Visual Controls**: AI Fix button and keyboard hint appear in terminal when errors are detected  
✅ **Button Activation**: Clicking "🤖 AI Fix" button successfully activates correction mode
✅ **Keyboard Activation**: Ctrl+Shift+K successfully activates correction mode when error present
✅ **Context Pre-filling**: Error message automatically appears in correction instructions
✅ **Mock AI Processing**: 1-second delay followed by corrected code suggestions
✅ **Inline Diff**: Changes are displayed as inline diffs in Monaco Editor
✅ **Accept/Reject**: Existing Monaco diff controls work for accepting/rejecting changes
✅ **UI Preservation**: All existing UI elements remain unchanged and functional

### Troubleshooting

**If AI Fix button doesn't appear**:

- Ensure error is detected and context is set (check console logs)
- Verify terminal panel is showing an error (not just empty/loading state)

**If button click doesn't work**:

- Check browser console for "AI Fix button clicked" log message
- Verify error context is available when button is clicked

**If Ctrl+Shift+K doesn't work**:

- Ensure terminal panel is visible and focused
- Check browser console for error detection logs
- Verify error context is set (look for "🎯 Error detected and context set" log)

**If correction toolbar doesn't appear**:

- Check for "activateErrorCorrection" event dispatch in console
- Verify MonacoEditor event listener is working

**If mock AI doesn't respond**:

- Check console for AIErrorCorrectionService logs
- Verify mock correction methods are being called

### Console Logs to Monitor

Look for these log messages to verify correct operation:

- `🎯 TerminalPanel: Error detected and context set`
- `🎯 TerminalPanel: Ctrl+Shift+K pressed, activating error correction mode`
- `🎯 MonacoEditor: Error correction activated from terminal`
- `🤖 AIErrorCorrectionService: Creating correction callback`
- `🧪 Mock AI correction processing`

### Next Steps for Real AI Integration

Once testing is complete, replace the mock AI service by:

1. Setting up a real AI backend (OpenAI, Claude, etc.)
2. Updating `requestCorrection()` method in AIErrorCorrectionService
3. Replacing the mock endpoints with real API calls
4. Adding proper API key management and error handling
