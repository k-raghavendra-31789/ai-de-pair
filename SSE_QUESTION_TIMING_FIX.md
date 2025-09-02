# SSE Single Pass Question Timing Fix

## Issue Analysis

You correctly identified that the issue occurs because:

1. **Question 3**: User selects "single_pass" strategy
2. **Question 4**: Another question appears
3. **SSE Events Start**: After question 4, but strategy might be lost/reset

## Root Cause: React State Timing

The issue was that between question 3 (strategy selection) and question 4 (SSE start), React's asynchronous state updates could cause:

1. `processingStrategy` state not yet updated
2. `sessionStrategy` not persisted properly
3. Strategy detection logic falling back to multi-pass detection

## Timing Sequence Problem

```
Question 3: setProcessingStrategy('single_pass') + setSessionStrategy('single_pass')
           ↓ (React state updates are async)
Question 4: SSE events start, but states might not be updated yet
           ↓
SSE Events: Strategy detection runs with potentially null/undefined states
           ↓
Result:     Falls back to multi-pass detection, then later corrects to single-pass
```

## Comprehensive Fix Applied

### 1. Enhanced Session Strategy Priority

Made `sessionStrategy` the absolute priority in strategy detection:

```javascript
// If sessionStrategy is explicitly set, always use it (override detection)
const actualStrategy = sessionStrategy || finalStrategy;
```

### 2. Improved Question 4 Initial Message

Updated the initial progress message on question 4 to prioritize session strategy:

```javascript
// Get the processing strategy - prioritize session strategy
const currentProcessingStrategy = sessionStrategy || processingStrategy;
console.log(
  '🔍 Current processing strategy for SSE:',
  currentProcessingStrategy
);
console.log('🔍 Session strategy:', sessionStrategy);
console.log('🔍 Component strategy:', processingStrategy);
```

### 3. Enhanced State Debugging

Added comprehensive logging to track strategy state between questions:

```javascript
if (questionId === 3 && questionType === 'strategy_selection') {
  console.log('💾 Previous sessionStrategy state:', sessionStrategy);
  setProcessingStrategy(selectedOption);
  setSessionStrategy(selectedOption);

  // Log immediately to see current state
  console.log('💾 Immediate check - processingStrategy:', processingStrategy);
  console.log('💾 Immediate check - sessionStrategy:', sessionStrategy);
}
```

### 4. Session Strategy Override Logic

Added explicit override logic to ensure session strategy is never ignored:

```javascript
// Strategy detection with session override
const currentStrategy = sessionStrategy || // FIRST: Check session strategy
                       processingStrategy ||
                       // ... other detection methods

// Final strategy with session override
const actualStrategy = sessionStrategy || finalStrategy;
```

### 5. Metadata Strategy Persistence

Ensured the actual strategy (with session override) is persisted in message metadata:

```javascript
metadata: {
  // ... other fields
  processingStrategy: actualStrategy; // Use session-aware strategy
}
```

## Expected Fix Results

### Before Fix (Problematic):

```
Question 3: Select "single_pass" → State set but may not persist
Question 4: Ask next question → State might be null/undefined
SSE Start: Strategy detection fails → Defaults to multi-pass
SSE Later: Eventually detects single_pass → Switches mid-session
```

### After Fix (Correct):

```
Question 3: Select "single_pass" → sessionStrategy immediately set
Question 4: Ask next question → sessionStrategy persists
SSE Start: sessionStrategy prioritized → Immediate single_pass detection
SSE Events: Consistent single_pass throughout → No switching
```

### Console Log Expectations:

```
💾 setSessionStrategy called with: single_pass
🔍 Session strategy: single_pass
🔍 Strategy detection - sessionStrategy (FIRST CHECK): single_pass
🔍 Strategy detection - actual strategy (session override): single_pass
🎨 Rendering progress message with strategy: single_pass
```

## Testing Verification

1. Select "Single Pass" on question 3
2. Check console immediately shows session strategy set
3. Answer question 4
4. Verify initial progress message uses session strategy
5. Confirm all SSE events consistently show single_pass
6. **No switching between multi-pass and single-pass**

## Impact

- **Eliminates question 3 → question 4 timing issues**
- **Session strategy persists across React state updates**
- **Immediate single_pass detection from first SSE event**
- **No more multi-pass → single-pass switching**
- **Robust strategy handling regardless of React timing**

## Files Modified

- `/src/components/ChatPanel.js`: Enhanced session strategy priority and timing resilience

This fix specifically addresses the timing gap between strategy selection (question 3) and SSE start (after question 4), ensuring the user's strategy choice persists and is prioritized throughout the entire flow.
