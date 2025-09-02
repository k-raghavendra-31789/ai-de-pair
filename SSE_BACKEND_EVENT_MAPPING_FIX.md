# SSE Single Pass Backend Event Mapping Fix

## Issue Root Cause

The backend is sending specific single_pass event names, but our frontend was mapping them incorrectly, causing multi-stage progress to display instead of the simplified single_pass flow.

## Backend Single Pass Event Sequence

```
questions_complete → Analysis starts
analysis_starting → Building data structures
analysis_complete → Ready for format-specific processing
single_pass_processing_start → AI processing begins
analyzing → Data analysis phase
analyzing_complete → Analysis done
generating_sql → Code generation phase
generating_sql_complete → Code generated
complete → All stages done
single_pass_processing_complete → Final response
```

## Frontend Stage Mapping Fix

### Before (Incorrect):

The frontend was using generic stage mapping that didn't account for backend's specific single_pass event names, causing it to fall back to multi-stage display.

### After (Correct):

Updated stage mapping to handle backend's actual single_pass events:

```javascript
const stageMapping = {
  // Multi-pass events
  parsing: 'parsing_file',
  generating_joins: 'generating_joins',
  generating_filters: 'generating_filters',
  generating_select: 'generating_select',
  combining: 'combining',
  complete: 'complete',

  // Single-pass backend events → frontend stages
  questions_complete: 'analyzing',
  analysis_starting: 'analyzing',
  analysis_complete: 'analyzing',
  single_pass_processing_start: 'generating_sql',
  analyzing: 'analyzing',
  analyzing_complete: 'analyzing',
  generating_sql: 'generating_sql',
  generating_sql_complete: 'generating_sql',
  single_pass_processing_complete: 'complete',
};
```

## Expected Frontend Display

### For Single Pass Strategy:

- **questions_complete, analysis_starting, analysis_complete** → Display: "Analyzing" ✓
- **single_pass_processing_start, analyzing, analyzing_complete** → Display: "Analyzing" ✓
- **generating_sql, generating_sql_complete** → Display: "Generating SQL" ✓
- **complete, single_pass_processing_complete** → Display: "Complete" ✓

### Simplified Progress Flow:

```
Analyzing ✓
Generating SQL ✓
Complete ✓
```

## Code Changes Made

### 1. Updated Stage Mapping (ChatPanel.js)

```javascript
// Map backend stage names to frontend stage names
const stageMapping = {
  // Multi-pass events
  parsing: 'parsing_file',
  generating_joins: 'generating_joins',
  generating_filters: 'generating_filters',
  generating_select: 'generating_select',
  combining: 'combining',
  complete: 'complete',

  // Single-pass backend events → frontend stages
  questions_complete: 'analyzing',
  analysis_starting: 'analyzing',
  analysis_complete: 'analyzing',
  single_pass_processing_start: 'generating_sql',
  analyzing: 'analyzing',
  analyzing_complete: 'analyzing',
  generating_sql: 'generating_sql',
  generating_sql_complete: 'generating_sql',
  single_pass_processing_complete: 'complete',
};

let mappedStage = stageMapping[currentStage] || currentStage;
```

### 2. Removed Redundant Single Pass Logic

Removed the additional single_pass mapping logic that was overriding the correct stage mapping, since the main mapping now handles backend events correctly.

### 3. Enhanced Debugging

Added logging to track:

- Raw backend events received
- Stage mapping transformations
- Final mapped stages

## Testing

1. Select "Single Pass" processing strategy
2. Open browser console to see debug logs
3. Submit SQL generation request
4. Verify console shows correct stage mappings:
   - Backend events like `analysis_starting` → `analyzing`
   - Backend events like `generating_sql` → `generating_sql`
   - Backend events like `single_pass_processing_complete` → `complete`
5. Verify UI shows only 3 stages instead of 7

## Files Modified

- `/src/components/ChatPanel.js`: Updated stage mapping for backend single_pass events

## Impact

- Single pass strategy now correctly displays simplified 3-stage progress
- Backend events are properly mapped to frontend stages
- No more showing multi-stage progress for single_pass strategy
- Better alignment between backend processing and frontend display
