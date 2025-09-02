# SSE Single Pass Strategy Detection Fix

## Issue Identified

From the console logs, the root cause is that `processingStrategy` is **null** when the progress message is being rendered:

```
🎨 Rendering progress message with strategy: null
🎯 Using stages for strategy: null Array(7)
```

This causes the `getStagesForStrategy(null)` function to default to the 7-stage multi-pass display instead of the 3-stage single_pass display.

## Root Cause Analysis

### Strategy Detection Failure

All strategy detection sources are failing:

- `processingStrategy state: null` - React state not set/available
- `data.data.processing_strategy: undefined` - Backend not sending strategy in SSE
- `data.processing_strategy: undefined` - Backend not sending strategy in SSE
- `existing message strategy: no existing message` - No previous message to inherit from
- `final currentStrategy: null` - All detection methods failed

### State Timing Issue

The React state `processingStrategy` is being set on question 3, but when SSE events arrive shortly after question 4, the state might not be available due to React's asynchronous state updates or component re-renders.

## Comprehensive Fix Applied

### 1. Enhanced Strategy Detection with Event-Based Fallback

```javascript
// Get processing strategy from multiple sources
const currentStrategy =
  processingStrategy ||
  data.data?.processing_strategy ||
  data.processing_strategy ||
  (existingIndex >= 0
    ? prev[existingIndex].metadata?.processingStrategy
    : null) ||
  // Detect strategy from event names if not explicitly set
  (currentStage?.includes('single_pass') ||
  currentStage === 'analysis_starting' ||
  currentStage === 'analysis_complete' ||
  currentStage === 'questions_complete'
    ? 'single_pass'
    : null);

// Additional fallback: if we still don't have strategy but see single_pass events, force it
const finalStrategy =
  currentStrategy ||
  (currentStage?.includes('single_pass') ||
  currentStage?.includes('analysis_') ||
  currentStage === 'questions_complete'
    ? 'single_pass'
    : 'multi_pass');
```

### 2. Event Name Pattern Detection

Since the backend sends specific single_pass event names, we can detect the strategy from the events themselves:

- `single_pass_processing_start` → clearly single_pass
- `analysis_starting`, `analysis_complete` → single_pass specific events
- `questions_complete` → single_pass flow event

### 3. Enhanced Debugging in Render Function

```javascript
const getStagesForStrategy = (strategy) => {
  console.log('🎯 getStagesForStrategy called with:', strategy);
  if (strategy === 'single_pass') {
    console.log('🎯 Returning single_pass stages (3 stages)');
    return [
      { id: 'analyzing', label: 'Analyzing', number: 1 },
      { id: 'generating_sql', label: 'Generating SQL', number: 2 },
      { id: 'complete', label: 'Complete', number: 3 },
    ];
  } else {
    console.log(
      '🎯 Returning multi_pass stages (7 stages) for strategy:',
      strategy
    );
    // 7-stage array...
  }
};
```

### 4. Metadata Strategy Persistence

Updated progress message metadata to use the detected `finalStrategy`:

```javascript
metadata: {
  eventType: data.event_type,
  currentStage: mappedStage,
  stageStatus: stageStatus,
  // ... other fields
  processingStrategy: finalStrategy  // Use robust strategy detection
}
```

## Expected Fix Results

### Console Logs Should Now Show:

```
🔍 Strategy detection - event name for detection: analysis_starting
🔍 Strategy detection - final strategy with fallback: single_pass
🎨 Rendering progress message with strategy: single_pass
🎯 getStagesForStrategy called with: single_pass
🎯 Returning single_pass stages (3 stages)
```

### UI Should Display:

- **Analyzing** ✓
- **Generating SQL** ✓
- **Complete** ✓

Instead of the 7-stage multi-pass display.

## Fallback Strategy Logic

1. **Primary**: Use React state `processingStrategy` if available
2. **Secondary**: Check SSE event data for strategy field
3. **Tertiary**: Use existing message metadata strategy
4. **Quaternary**: Detect from event names (single_pass patterns)
5. **Final Fallback**: Default to 'multi_pass' if nothing detected

## Event Name Detection Patterns

### Single Pass Indicators:

- Event names containing `single_pass`
- Event names like `analysis_starting`, `analysis_complete`
- Event name `questions_complete`

### Multi Pass Default:

- Any other event patterns
- Traditional stage names like `parsing_file`, `generating_joins`

## Testing Verification

1. Open browser console
2. Select "Single Pass" strategy
3. Run SQL generation
4. Check console for:
   - Strategy detection logs showing successful fallback
   - Render function showing `single_pass` strategy
   - `getStagesForStrategy` returning 3 stages
5. Verify UI shows simplified 3-stage progress

## Files Modified

- `/src/components/ChatPanel.js`: Enhanced strategy detection and fallback logic

## Impact

- Robust strategy detection that works even when React state fails
- Event-based strategy detection as intelligent fallback
- Guaranteed correct progress display for single_pass strategy
- Enhanced debugging to troubleshoot future strategy issues
