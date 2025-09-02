# SSE Single Pass Event Fix - Updated

## Issue Description

The SSE (Server-Sent Events) handling for `single_pass` processing strategy was showing incorrect progress stages. Instead of displaying a simplified "Generating SQL query using AI" progress flow, it was showing all the intermediate multi-stage steps like "Parsing file", "Generating joins", "Generating filters", etc.

## Root Cause Analysis

1. **Timing Issue**: The `processingStrategy` state was being set on question 3 but SSE events started on question 4, causing a timing mismatch.
2. **Strategy Detection Failure**: The SSE event handler wasn't properly detecting the processing strategy from multiple sources.
3. **State Synchronization**: React state updates are asynchronous, so the strategy might not be available when first SSE events arrive.
4. **Missing Backend Strategy**: The backend might not be sending the processing strategy in SSE events.

## Solution Implemented

### 1. Enhanced Strategy Detection

Added comprehensive strategy detection from multiple sources:

```javascript
// Get processing strategy from multiple sources
const currentStrategy =
  processingStrategy ||
  data.data?.processing_strategy ||
  data.processing_strategy ||
  (existingIndex >= 0
    ? prev[existingIndex].metadata?.processingStrategy
    : null);
```

### 2. Improved Single Pass Stage Mapping

```javascript
// For single_pass strategy, map multi-stage events to simplified stages
if (currentStrategy === 'single_pass') {
  console.log(
    '🚀 SINGLE_PASS strategy detected - simplifying all stages to generating_sql'
  );
  console.log(
    '🚀 Strategy source:',
    currentStrategy,
    'Original stage:',
    currentStage
  );
  // For single_pass, ALL intermediate stages should show as 'generating_sql'
  if (
    currentStage !== 'complete' &&
    stageStatus !== 'completed' &&
    currentStage !== 'analyzing'
  ) {
    mappedStage = 'generating_sql';
    console.log(
      '🎯 Single-pass stage mapping:',
      currentStage,
      '→ generating_sql'
    );
  } else if (currentStage === 'analyzing') {
    mappedStage = 'analyzing';
    console.log(
      '🎯 Single-pass keeping analyzing stage:',
      currentStage,
      '→',
      mappedStage
    );
  } else {
    mappedStage = 'complete';
    console.log('🎯 Single-pass completion stage:', currentStage, '→ complete');
  }
} else {
  console.log(
    '🔄 Multi-stage strategy detected:',
    currentStrategy,
    'keeping original stage mapping'
  );
}
```

### 3. Enhanced Completion Detection

Added more single_pass specific completion event types:

```javascript
const isCompleted =
  extractedSQL ||
  data.message?.status === 'success' ||
  data.message?.event_type === 'completion' ||
  data.message?.processing_status === 'completed' ||
  data.data?.status === 'completed' ||
  data.status === 'completed' ||
  data.event_type === 'completion' ||
  data.event_type === 'single_pass_processing_complete' ||
  data.event_type === 'single_pass_complete' ||
  (data.event_type === 'progress' && data.data?.stage === 'complete') ||
  (typeof data.message === 'string' &&
    data.message?.includes('completed successfully')) ||
  (typeof data.message?.message === 'string' &&
    data.message?.message?.includes('completed successfully'));
```

### 4. Strategy State Management Fix

Fixed the strategy setting and detection timing:

```javascript
// Store processing strategy for SSE stage customization
if (questionId === 3 && questionType === 'strategy_selection') {
  console.log('💾 Storing processing strategy:', selectedOption);
  console.log('💾 Previous processingStrategy state:', processingStrategy);
  setProcessingStrategy(selectedOption);
  console.log('💾 setProcessingStrategy called with:', selectedOption);

  // Also log after a small delay to see if state updated
  setTimeout(() => {
    console.log('💾 Strategy state after 100ms:', processingStrategy);
  }, 100);
}
```

### 5. Enhanced Debugging

Added comprehensive logging to track:

- Strategy detection from multiple sources
- Stage mapping transformations
- Event type validation
- Completion detection logic
- Render function strategy handling

### 6. Progress Message Metadata Fix

Updated metadata creation to use the detected strategy:

```javascript
metadata: {
  eventType: data.event_type,
  currentStage: mappedStage,
  stageStatus: stageStatus,
  processingStatus: data.data?.processing_status,
  totalFields: data.data?.total_fields,
  processedFields: data.data?.processed_fields,
  columnTracking: data.data?.column_tracking,
  fieldTracking: data.data?.field_tracking,
  sessionId: sessionId,
  processingStrategy: currentStrategy  // Use detected strategy instead of state
}
```

## Expected Behavior After Fix

### For Single Pass Strategy:

1. **Analyzing** → Shows "Analyzing" stage
2. **All Processing Stages** → Shows unified "Generating SQL query using AI"
3. **Complete** → Shows "Complete" with generated SQL

### Progress Flow:

```
Analyzing ✓
Generating SQL query using AI ✓
Complete ✓
```

Instead of the previous multi-stage flow:

```
Analyzing ✓
Parsing file ✓
Generating joins ✓
Generating filters ✓
Generating select ✓
Combining ✓
Complete ✓
```

## Debugging Steps Added

### Console Logging:

1. **Strategy Detection**: Logs all sources checked for processing strategy
2. **Stage Mapping**: Shows original stage → mapped stage transformations
3. **Render Function**: Logs strategy and stages used in UI rendering
4. **State Updates**: Tracks when strategy state is set and updated

### Testing Checklist:

1. Select "Single Pass" on question 3
2. Check console for "💾 Storing processing strategy: single_pass"
3. Answer question 4 to start SSE
4. Check console for "🚀 SINGLE_PASS strategy detected"
5. Verify stage mappings show "→ generating_sql"
6. Check render function logs show correct strategy
7. Verify UI shows simplified 3-stage progress

## Files Modified

- `/src/components/ChatPanel.js`: Enhanced SSE event handling for single_pass strategy

## Testing

To verify the fix:

1. Open browser console to see debug logs
2. Select "Single Pass" processing strategy
3. Submit a SQL generation request
4. Observe the progress indicators - should show simplified flow
5. Check console logs for strategy detection and stage mappings
6. Verify completion detection works correctly for single_pass events

## Next Steps if Issue Persists

1. Check if backend is sending `processing_strategy` in SSE events
2. Verify backend is sending correct `stage` names for single_pass
3. Add backend logging to confirm SSE event payload
4. Test with network tab to see raw SSE event data
5. Consider adding processing strategy to every SSE event from backend
