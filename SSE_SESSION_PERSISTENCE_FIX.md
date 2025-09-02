# SSE Single Pass Session Persistence Fix

## Issue Description

The application was generating **multi-pass SSE events first, then switching to single-pass** during the same session. This caused the progress indicator to show:

1. First: 7-stage multi-pass flow (Analyzing → Parsing file → Generating joins → etc.)
2. Then: 3-stage single-pass flow (Analyzing → Generating SQL → Complete)

## Root Cause Analysis

### Event-by-Event Strategy Detection Problem

The strategy detection was happening **per-event** rather than **per-session**, causing:

1. Early events (like `questions_complete`, `analysis_starting`) might not be immediately recognized as single_pass
2. Strategy detection was reactive rather than proactive
3. No session-level persistence of detected strategy
4. React state timing issues causing strategy to be null on first events

### Backend Event Sequence Issue

```
Event 1: questions_complete → May not be detected as single_pass immediately
Event 2: analysis_starting → May not be detected as single_pass immediately
Event 3: single_pass_processing_start → Finally detected as single_pass
```

This caused the first 1-2 events to render as multi-pass before switching to single-pass.

## Comprehensive Fix Applied

### 1. Session-Level Strategy Persistence

Added a separate `sessionStrategy` state that persists the strategy for the entire session:

```javascript
const [sessionStrategy, setSessionStrategy] = useState(null); // Persist strategy for entire session

// Strategy detection now checks session strategy first
const currentStrategy = sessionStrategy || // First check session-level strategy
                       processingStrategy ||
                       data.data?.processing_strategy ||
                       // ... other sources
```

### 2. Enhanced Event Pattern Detection

Improved the pattern detection to catch single_pass events more reliably:

```javascript
// Detect strategy from both currentStage and event_type
currentStage?.includes('single_pass') ||
currentStage === 'analysis_starting' ||
currentStage === 'analysis_complete' ||
currentStage === 'questions_complete' ||
data.event_type?.includes('single_pass') ||
data.event_type === 'analysis_starting' ||
data.event_type === 'analysis_complete' ||
data.event_type === 'questions_complete'
  ? 'single_pass'
  : null;
```

### 3. Proactive Strategy Persistence

Once single_pass is detected, it's immediately persisted for the entire session:

```javascript
// Persist strategy at session level once detected as single_pass
if (finalStrategy === 'single_pass' && !sessionStrategy) {
  console.log('💾 Persisting single_pass strategy for entire session');
  setSessionStrategy('single_pass');
}
```

### 4. Question 3 Strategy Setting Enhancement

When strategy is selected on question 3, it's immediately persisted at session level:

```javascript
if (questionId === 3 && questionType === 'strategy_selection') {
  setProcessingStrategy(selectedOption);
  setSessionStrategy(selectedOption); // Also persist at session level
  console.log('💾 setSessionStrategy called with:', selectedOption);
}
```

### 5. Session Reset Logic

New sessions automatically reset the session strategy:

```javascript
// Reset session strategy if new session
if (currentSessionId !== sessionId) {
  console.log('🔄 New session detected, resetting session strategy');
  setSessionStrategy(null);
}
```

## Expected Behavior After Fix

### Scenario 1: Strategy Selected on Question 3

1. User selects "Single Pass" on question 3
2. `sessionStrategy` immediately set to 'single_pass'
3. All subsequent SSE events use single_pass (3-stage) display from the start
4. **No switching between multi-pass and single-pass**

### Scenario 2: Strategy Not Set, Auto-Detection

1. First single_pass event detected (e.g., `questions_complete`)
2. `sessionStrategy` immediately set to 'single_pass'
3. All subsequent events in the session use single_pass display
4. **Minimal or no multi-pass events shown**

### Consistent Display:

```
✅ CORRECT: Single Pass Strategy
Analyzing ✓
Generating SQL ✓
Complete ✓
```

Instead of the problematic switching:

```
❌ PROBLEMATIC: Multi → Single Switching
Analyzing ✓ Parsing file ✓ Generating joins ✓ [multi-pass events]
↓ (then switches to)
Analyzing ✓ Generating SQL ✓ Complete ✓ [single-pass events]
```

## Enhanced Debugging

Added comprehensive logging to track:

- Session strategy persistence
- Strategy detection sources and timing
- Session reset events
- Strategy state after delays

### Console Log Expectations:

```
💾 setSessionStrategy called with: single_pass
💾 Persisting single_pass strategy for entire session
🔍 Strategy detection - sessionStrategy: single_pass
🎨 Rendering progress message with strategy: single_pass
```

## Files Modified

- `/src/components/ChatPanel.js`: Added session-level strategy persistence and enhanced detection

## Testing Verification

1. Select "Single Pass" on question 3
2. Check console for immediate session strategy setting
3. Verify all progress events show single_pass strategy
4. Confirm no switching between multi-pass and single-pass displays
5. Test multiple sessions to verify strategy reset

## Impact

- **Eliminates strategy switching** during a single session
- **Proactive strategy detection** instead of reactive
- **Session-level persistence** ensures consistency
- **Enhanced reliability** for single_pass SSE event handling
- **Better user experience** with consistent progress displays
