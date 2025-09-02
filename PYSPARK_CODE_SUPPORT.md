# PySpark Code Support Implementation

## Overview

The frontend now supports displaying Python/PySpark code when users select PySpark strategy. This document outlines the implementation and expected backend integration.

## Frontend Changes Made

### 1. Enhanced Code Message Rendering

- Updated `renderCodeMessage()` function to detect and properly display Python/PySpark code
- Language detection based on `blockType`, `language`, or `processingStrategy` metadata
- Dynamic labels and icons based on code language
- Language-specific copy button text

### 2. Strategy Detection Updates

- Added `pyspark` as a recognized strategy option alongside `single_pass` and `multi_pass`
- Updated strategy detection logic to recognize PySpark selection
- Enhanced SSE event detection for PySpark-specific events

### 3. Progress Stage Mapping

- Added PySpark-specific progress stages:
  1. **Analyzing** - Data analysis phase
  2. **Generating PySpark Code** - Code generation phase
  3. **Complete** - Process completion

### 4. SSE Event Mapping

Added support for PySpark-specific backend events:

- `pyspark_analysis_starting` → `analyzing`
- `pyspark_analysis_complete` → `analyzing`
- `pyspark_processing_start` → `generating_code`
- `generating_pyspark` → `generating_code`
- `generating_python` → `generating_code`
- `pyspark_processing_complete` → `complete`
- `python_processing_complete` → `complete`

## Backend Integration

### Strategy Selection

When user selects PySpark strategy, the frontend will send:

```javascript
{
  "question_id": 4,
  "answer": "pyspark",
  "question_type": "strategy_selection" // optional
}
```

### Expected Code Message Format

The backend should send Python/PySpark code with this structure:

```javascript
{
  "id": "code_12345",
  "type": "code",
  "content": "# PySpark code here\nfrom pyspark.sql import SparkSession\nspark = SparkSession.builder.appName('DataAnalysis').getOrCreate()\ndf = spark.read.csv('data.csv', header=True)\ndf.show()",
  "timestamp": "2025-09-01T...",
  "generationId": "gen_xyz",
  "metadata": {
    "blockType": "pyspark",           // or "python", "python_script"
    "language": "python",             // programming language
    "modelUsed": "GPT-4",
    "processingStrategy": "pyspark",  // helps detect PySpark context
    "completionMessage": "PySpark code generated successfully"
  }
}
```

### SSE Progress Events

For PySpark processing, send these SSE events:

1. **Analysis Phase**:

```javascript
{
  "event_type": "pyspark_analysis_starting",
  "message": "Starting PySpark analysis...",
  "data": {},
  "processing_status": "in_progress"
}
```

2. **Code Generation Phase**:

```javascript
{
  "event_type": "pyspark_processing_start",
  "message": "Generating PySpark code...",
  "data": {},
  "processing_status": "in_progress"
}
```

3. **Completion**:

```javascript
{
  "event_type": "pyspark_processing_complete",
  "message": "PySpark code generation completed",
  "data": {},
  "processing_status": "completed"
}
```

## Frontend Display Features

### Language Detection

The frontend automatically detects the language based on:

1. `metadata.language` field
2. `metadata.blockType` field
3. `metadata.processingStrategy` field

### Display Elements

- **Icon**: 🐍 for Python/PySpark, 🗃️ for SQL
- **Header**: Shows "PYSPARK" or "PYTHON" based on detected language
- **Copy Button**: "Copy PySpark Code" or "Copy Python Code"
- **Language Badge**: Shows language in completion header
- **Syntax Class**: Applies `language-python` CSS class for potential syntax highlighting

### Progress Stages

For PySpark strategy, users will see:

1. **Analyzing** (Step 1/3)
2. **Generating PySpark Code** (Step 2/3)
3. **Complete** (Step 3/3)

## Testing

To test PySpark code display:

1. Select "pyspark" strategy in the question flow
2. Backend should send code message with `blockType: "pyspark"`
3. Frontend will display with PySpark-specific styling and labels
4. Copy button will show "Copy PySpark Code"
5. Progress will show "Generating PySpark Code" in step 2

## Migration Notes

- Existing SQL code display is unchanged and fully backward compatible
- New language detection is additive and doesn't affect existing functionality
- SSE event mapping includes both old and new event types
- Strategy detection supports all three options: `single_pass`, `multi_pass`, `pyspark`

## File Changes

- `src/components/ChatPanel.js`: Enhanced code rendering and strategy detection
