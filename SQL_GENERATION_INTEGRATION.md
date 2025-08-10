# SQL Generation Integration Documentation

## Overview

This document outlines the integration between ChatPanel progress tracking and MainEditor real-time SQL generation for the AI-DE (AI-powered Data Engineering) tool. The system enables progressive SQL building during semantic layer generation from Excel mapping documents.

## Architecture

### System Flow

```
Excel Upload → ChatPanel SSE Progress → Context State → MainEditor SQL Building
```

1. **User uploads Excel file** via ChatPanel
2. **SSE progress events** track generation stages
3. **Context state** manages SQL generation data
4. **MainEditor** displays real-time SQL building

## Components Integration

### 1. AppStateContext Enhancements

#### New State Properties

```javascript
sqlGeneration: {
  isActive: false,           // Whether SQL generation is in progress
  generationId: null,        // Unique ID for current generation
  currentStage: null,        // Current stage (parsing-file, analyzing, etc.)
  sqlContent: '',            // Current SQL content
  stageHistory: [],          // History of completed stages
  metadata: {
    sourceFile: null,        // Excel file being processed
    tableStructure: {},      // Discovered table structure
    columnMappings: [],      // Column mapping analysis
    joinDefinitions: [],     // Generated JOIN clauses
    selectFields: [],        // Generated SELECT fields
    whereConditions: []      // Generated WHERE conditions
  }
}
```

#### New Action Types

```javascript
// SQL Generation Actions
START_SQL_GENERATION: 'START_SQL_GENERATION',
UPDATE_SQL_STAGE: 'UPDATE_SQL_STAGE',
UPDATE_SQL_CONTENT: 'UPDATE_SQL_CONTENT',
COMPLETE_SQL_GENERATION: 'COMPLETE_SQL_GENERATION',
RESET_SQL_GENERATION: 'RESET_SQL_GENERATION'
```

#### New Action Creators

```javascript
startSqlGeneration(generationId, sourceFile);
updateSqlStage(stage, stageData, sqlContent);
updateSqlContent(sqlContent);
completeSqlGeneration(finalSql);
resetSqlGeneration();
```

### 2. ChatPanel Modifications

#### SSE Event Integration

- **Remove**: Static SQL code block generation
- **Add**: Context dispatch calls during progress stages
- **Maintain**: Progress visualization and description updates

#### Stage-to-SQL Mapping

```javascript
const stageToSqlMapping = {
  'parsing-file': generateTableStructureComments,
  analyzing: generateColumnMappingComments,
  'generating-joins': buildJoinClauses,
  'generating-select': buildSelectClause,
  'generating-filters': buildWhereClause,
  combining: assembleFinalSql,
  complete: finalizeSql,
};
```

#### Mock Progress Updates

Each stage will dispatch both progress updates and SQL content updates:

```javascript
// Progress update (for ChatPanel UI)
setChatMessages(prev => /* update progress */);

// SQL update (for MainEditor)
dispatch(updateSqlStage(stage, stageData, generatedSql));
```

### 3. MainEditor Enhancements

#### SQL Tab Management

- **Auto-create** "Generated SQL" tab when generation starts
- **Update tab title** with generation progress indicator
- **Real-time content** updates as SQL builds
- **Preserve tab** after generation completes

#### Tab Creation Logic

```javascript
// When SQL generation starts
if (!existingSqlTab) {
  const sqlTab = {
    id: `sql_${generationId}`,
    name: '🔄 Generating SQL...',
    type: 'sql',
    path: `generated-sql-${generationId}.sql`,
    isGenerated: true,
  };
  addTab(sqlTab);
  setActiveTab(sqlTab.id);
}
```

#### Content Updates

```javascript
// Subscribe to SQL generation updates
useEffect(() => {
  if (sqlGeneration.isActive && sqlGeneration.sqlContent) {
    updateFileContent(activeSqlTabId, sqlGeneration.sqlContent);
  }
}, [sqlGeneration.sqlContent]);
```

#### Tab Title Updates

```javascript
const getTabTitle = (stage) => {
  const stageEmojis = {
    'parsing-file': '📊 Parsing...',
    analyzing: '🔍 Analyzing...',
    'generating-joins': '🔗 Building Joins...',
    'generating-select': '📋 Building Select...',
    'generating-filters': '🔍 Adding Filters...',
    combining: '🔧 Combining...',
    complete: '✅ SQL Generated',
  };
  return stageEmojis[stage] || '🔄 Generating...';
};
```

## Progressive SQL Building Strategy

### Stage 1: Parsing File (12-25%)

```sql
-- ===================================================
-- AI-DE Generated Semantic Layer
-- Source: CustomerMapping.xlsx
-- Generated: [timestamp]
-- ===================================================

-- Table Structure Discovery
-- Found tables: customers, addresses, orders
-- Processing sheet: Customer_Data
```

### Stage 2: Analyzing (25-40%)

```sql
-- Column Mapping Analysis
-- customers table: customer_id, customer_name, email, address_id
-- addresses table: address_id, address_line1, city, state
-- orders table: order_id, customer_id, order_date, amount

-- Data type analysis in progress...
```

### Stage 3: Generating Joins (40-65%)

```sql
-- Building JOIN relationships

SELECT
  -- Fields will be added in next stage

FROM raw.customers c
LEFT JOIN raw.addresses a
  ON c.address_id = a.address_id
LEFT JOIN raw.orders o
  ON c.customer_id = o.customer_id
```

### Stage 4: Generating Select (65-85%)

```sql
SELECT
  -- Customer information
  c.customer_id,
  c.customer_name,
  c.email,

  -- Address information
  a.address_line1,
  a.city,
  a.state,

  -- Order aggregations
  COUNT(o.order_id) as total_orders,
  SUM(o.amount) as total_spent

FROM raw.customers c
LEFT JOIN raw.addresses a
  ON c.address_id = a.address_id
LEFT JOIN raw.orders o
  ON c.customer_id = o.customer_id
```

### Stage 5: Generating Filters (85-96%)

```sql
SELECT
  c.customer_id,
  c.customer_name,
  c.email,
  a.address_line1,
  a.city,
  a.state,
  COUNT(o.order_id) as total_orders,
  SUM(o.amount) as total_spent

FROM raw.customers c
LEFT JOIN raw.addresses a
  ON c.address_id = a.address_id
LEFT JOIN raw.orders o
  ON c.customer_id = o.customer_id

WHERE c.is_active = 1
  AND c.created_date >= '2023-01-01'
  AND a.country = 'US'
```

### Stage 6: Combining (96-100%)

```sql
-- Final assembly and optimization
SELECT
  c.customer_id,
  c.customer_name,
  c.email,
  a.address_line1,
  a.city,
  a.state,
  COUNT(o.order_id) as total_orders,
  SUM(o.amount) as total_spent

FROM raw.customers c
LEFT JOIN raw.addresses a
  ON c.address_id = a.address_id
LEFT JOIN raw.orders o
  ON c.customer_id = o.customer_id

WHERE c.is_active = 1
  AND c.created_date >= '2023-01-01'
  AND a.country = 'US'

GROUP BY
  c.customer_id,
  c.customer_name,
  c.email,
  a.address_line1,
  a.city,
  a.state

ORDER BY total_spent DESC;
```

### Stage 7: Complete (100%)

```sql
-- ===================================================
-- Customer Semantic Layer - FINAL
-- Generated by AI-DE from CustomerMapping.xlsx
-- Completion time: [timestamp]
-- ===================================================

SELECT
  c.customer_id,
  c.customer_name,
  c.email,
  a.address_line1,
  a.city,
  a.state,
  COUNT(o.order_id) as total_orders,
  SUM(o.amount) as total_spent

FROM raw.customers c
LEFT JOIN raw.addresses a
  ON c.address_id = a.address_id
LEFT JOIN raw.orders o
  ON c.customer_id = o.customer_id

WHERE c.is_active = 1
  AND c.created_date >= '2023-01-01'
  AND a.country = 'US'

GROUP BY
  c.customer_id,
  c.customer_name,
  c.email,
  a.address_line1,
  a.city,
  a.state

ORDER BY total_spent DESC;

-- Performance Notes:
-- - Consider indexing on customer_id, address_id
-- - Review date filter performance
-- - Monitor JOIN performance on large datasets
```

## Implementation Plan

### Phase 1: Context Setup

1. ✅ Add SQL generation state to AppStateContext
2. ✅ Create action types and reducers
3. ✅ Add action creators for SQL updates

### Phase 2: ChatPanel Integration

1. ✅ Remove static SQL code generation
2. ✅ Add context dispatch calls in generateMockProgress
3. ✅ Map each stage to SQL building functions
4. ✅ Test progress + SQL updates together

### Phase 3: MainEditor Integration

1. ✅ Add SQL tab creation logic
2. ✅ Implement real-time content updates
3. ✅ Add tab title progress indicators
4. ✅ Handle tab lifecycle (create/update/complete)

### Phase 4: SQL Building Logic

1. ✅ Implement stage-specific SQL builders
2. ✅ Add realistic table/column discovery
3. ✅ Create progressive JOIN building
4. ✅ Add comprehensive SELECT and WHERE generation

### Phase 5: Interactive AI Assistance

1. ✅ Implement AI question cards UI components
2. ✅ Add user response handling system
3. ✅ Create pause/resume generation logic
4. ✅ Add timeout and fallback mechanisms

### Phase 6: Testing & Polish

1. ✅ Test full workflow end-to-end
2. ✅ Test interactive scenarios and edge cases
3. ✅ Add error handling for generation failures
4. ✅ Optimize performance for real-time updates
5. ✅ Add user feedback mechanisms

## Interactive AI Assistance

### Stuck/Ambiguous Situations

When the AI backend encounters ambiguous data or gets stuck during generation, it can request user input through interactive prompts in the ChatPanel.

#### Common Scenarios Requiring User Input:

1. **Ambiguous Column Mappings**

   - Multiple possible interpretations of Excel column names
   - Unclear relationship between tables
   - Missing foreign key relationships

2. **Data Type Conflicts**

   - Inconsistent data types across sheets
   - Unknown data formats requiring user clarification
   - Business logic rules that need user definition

3. **Join Strategy Decisions**

   - Multiple possible JOIN types (INNER vs LEFT JOIN)
   - Complex many-to-many relationships
   - Performance vs completeness trade-offs

4. **Business Logic Clarification**
   - Filter conditions that need business context
   - Aggregation requirements
   - Data quality rules

#### Interactive UI Components

##### 1. AI Question Cards

```javascript
// New message type: 'ai-question'
const questionMessage = {
  id: `question_${generationId}`,
  type: 'ai-question',
  content:
    "I found multiple possible relationships for 'customer_id'. Which approach should I use?",
  timestamp: new Date().toISOString(),
  generationId,
  metadata: {
    questionType: 'relationship_mapping',
    stage: 'generating-joins',
    options: [
      {
        id: 'option_1',
        title: 'Inner Join (strict matching)',
        description: 'Only include customers with valid addresses',
        sqlPreview: 'INNER JOIN addresses a ON c.address_id = a.id',
      },
      {
        id: 'option_2',
        title: 'Left Join (include all customers)',
        description: 'Include customers even without addresses',
        sqlPreview: 'LEFT JOIN addresses a ON c.address_id = a.id',
      },
    ],
    pausedAt: Date.now(),
  },
};
```

##### 2. User Response Interface

```javascript
const renderAIQuestion = (message) => (
  <div className="ai-question-card border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-yellow-600 dark:text-yellow-400">🤖</span>
      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        AI Assistant needs your input
      </span>
    </div>

    <p className="text-gray-800 dark:text-gray-200 mb-4">{message.content}</p>

    <div className="space-y-3">
      {message.metadata.options.map((option) => (
        <button
          key={option.id}
          onClick={() => handleUserResponse(message.generationId, option)}
          className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <div className="font-medium">{option.title}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {option.description}
          </div>
          {option.sqlPreview && (
            <code className="text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded mt-1 block">
              {option.sqlPreview}
            </code>
          )}
        </button>
      ))}
    </div>

    <div className="mt-4 text-xs text-gray-500">
      Generation paused at {message.metadata.stage} • Waiting for your input
    </div>
  </div>
);
```

##### 3. Custom Input Forms

For more complex scenarios requiring free-form input:

```javascript
const renderCustomInputForm = (message) => (
  <div className="ai-input-form bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
    <h4 className="font-medium mb-3">Define Business Logic</h4>
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">
          Filter Condition
        </label>
        <input
          type="text"
          placeholder="e.g., status = 'active' AND created_date > '2023-01-01'"
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Apply & Continue
        </button>
        <button className="px-4 py-2 border rounded hover:bg-gray-50">
          Skip This Filter
        </button>
      </div>
    </div>
  </div>
);
```

#### Backend Integration

##### SSE Event Types for Interactive Mode

```javascript
// AI sends question to frontend
{
  type: 'ai_question',
  generationId: 'gen_123',
  stage: 'generating-joins',
  question: {
    type: 'relationship_mapping',
    content: 'Multiple join options found...',
    options: [...],
    context: {
      tables: ['customers', 'addresses'],
      columns: ['customer_id', 'address_id'],
      suggestedMappings: [...]
    }
  }
}

// Frontend sends user response
{
  type: 'user_response',
  generationId: 'gen_123',
  questionId: 'q_456',
  response: {
    selectedOption: 'option_2',
    customInput: null,
    timestamp: Date.now()
  }
}

// AI acknowledges and continues
{
  type: 'resume_generation',
  generationId: 'gen_123',
  stage: 'generating-joins',
  progress: 45,
  message: 'Thanks! Continuing with LEFT JOIN strategy...'
}
```

#### State Management for Interactive Mode

##### Context Updates

```javascript
// New state properties
sqlGeneration: {
  // ... existing properties
  isPaused: false,
  currentQuestion: null,
  questionHistory: [],
  userResponses: {},
  pausedAt: null,
  pauseDuration: 0
}

// New action types
PAUSE_SQL_GENERATION: 'PAUSE_SQL_GENERATION',
ASK_USER_QUESTION: 'ASK_USER_QUESTION',
SUBMIT_USER_RESPONSE: 'SUBMIT_USER_RESPONSE',
RESUME_SQL_GENERATION: 'RESUME_SQL_GENERATION'
```

##### Progress Indicator Updates

```javascript
// Show paused state in progress bar
const getStageStatus = (stageId) => {
  if (sqlGeneration.isPaused && currentStage === stageId) return 'paused';
  if (currentStage === stageId) return 'active';
  // ... existing logic
};

// Add paused styling
status === 'paused'
  ? 'bg-yellow-500 border-yellow-400' // Yellow for paused
  : status === 'active'
  ? 'bg-blue-500 border-blue-400'     // Blue for active
  : // ... other states
```

#### User Experience Flow

1. **Generation Starts**: Normal progress visualization
2. **AI Gets Stuck**: Progress pauses, question card appears
3. **User Responds**: Clicks option or fills form
4. **Generation Resumes**: Progress continues from where it left off
5. **Completion**: Final SQL includes user decisions

#### Benefits of Interactive Mode

- **Higher Success Rate**: Reduces generation failures
- **Better Quality**: SQL reflects actual business requirements
- **User Learning**: Users understand AI decision-making process
- **Flexibility**: Handles edge cases and complex scenarios
- **Transparency**: Clear audit trail of AI vs human decisions

## Error Handling

### Generation Failures

- Reset SQL generation state
- Show error message in ChatPanel
- Close/cleanup generated SQL tab
- Allow retry functionality

### Interactive Timeout

- Auto-resume with AI best guess after 5 minutes
- Save question for later review
- Continue generation with fallback options

### Network Issues

- Graceful degradation for SSE disconnections
- Resume generation from last known state
- Cache intermediate SQL states and user responses

## Future Enhancements

### Phase 2 Features

- **Multiple SQL dialects** (Snowflake, BigQuery, PostgreSQL)
- **dbt model generation** alongside raw SQL
- **SQL validation** and syntax checking
- **Performance optimization** suggestions
- **Data quality checks** integration

### Phase 3 Features

- **AI-powered SQL explanations**
- **Alternative query suggestions**
- **Semantic layer versioning**
- **Team collaboration** features

## Testing Strategy

### Unit Tests

- Context state management
- SQL building functions
- Progress tracking logic

### Integration Tests

- ChatPanel → Context → MainEditor flow
- Real-time updates and synchronization
- Tab lifecycle management

### End-to-End Tests

- Complete Excel upload to SQL generation
- Multiple concurrent generations
- Error scenarios and recovery

---

**Document Version**: 1.0  
**Last Updated**: August 10, 2025  
**Author**: AI-DE Development Team
