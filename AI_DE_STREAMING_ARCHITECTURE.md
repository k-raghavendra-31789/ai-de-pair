# AI-DE Streaming Architecture Documentation

## Application Overview

**AI-DE: AI-powered Data Engineering** - A specialized tool for data engineers to build semantic layers (SQL/PySpark) using Excel mapping documents with real-time AI assistance.

## Core Workflow

```
Excel Mappings → AI Backend → SSE Streaming → Frontend Display → User Refinement → Enhanced SQL/PySpark
```

### Key Process Steps:

1. **Upload** Excel mapping document
2. **AI generates** semantic layer code with real-time progress streaming
3. **User reviews** generated SQL/PySpark in the editor
4. **Iterative improvement** via targeted prompts for specific code blocks
5. **Final persistence** of refined semantic layer

---

## Frontend Streaming Architecture

### 1. SSE (Server-Sent Events) Integration

- **Purpose**: Real-time communication from backend AI to frontend
- **Technology**: Browser-native SSE, no WebSocket complexity
- **User Experience**: Continuous progress visibility during SQL generation
- **Benefits**: Progress transparency, debugging capability, user reassurance

### 2. Dual-Stream UI Architecture

#### ChatPanel Integration

- **Real-time Progress**: Stream updates as conversational messages
- **Message Types**: User messages + AI responses + Progress messages + Code blocks
- **Visual Hierarchy**: Clear distinction between conversation and generation status
- **Persistent History**: Progress logs become part of chat history

#### MainEditor Real-time Code Building

- **Incremental Construction**: SQL builds block by block in real-time
- **Live Formatting**: Monaco Editor formats SQL as it arrives
- **Progressive Display**: Each completed block appears immediately
- **Final Assembly**: Complete semantic layer displayed and auto-saved

### 3. Frontend-Backend Hashmap Synchronization

#### Agreed Structure:

```javascript
{
  generation_id: "gen_12345", // Frontend generated
  semantic_layer_name: "customer_semantic_layer",
  status: "pending|in_progress|completed|error",

  blocks: {
    "select_clause": {
      status: "pending|in_progress|completed|error",
      sql: "SELECT c.customer_id, c.customer_name, c.email",
      order: 1,
      timestamp: "2025-08-10T10:30:00Z"
    },

    "joins": {
      status: "completed",
      sql: "FROM customers c LEFT JOIN addresses a ON c.address_id = a.address_id",
      order: 2,
      timestamp: "2025-08-10T10:30:15Z"
    },

    "where_clause": {
      status: "pending",
      sql: "",
      order: 3,
      timestamp: null
    }
  },

  metadata: {
    mapping_file: "CustomerMapping.xlsx",
    total_blocks: 3,
    completed_blocks: 1,
    progress_percentage: 33,
    estimated_completion: "2025-08-10T10:32:00Z"
  }
}
```

---

## Architecture Decisions

### 1. Generation ID Strategy: Frontend-Generated ✅

**Decision**: Frontend generates UUIDs for generation tracking
**Benefits**:

- Immediate tracking before backend responds
- Collision prevention with frontend-controlled uniqueness
- Easy request-response mapping for SSE events
- Offline preparation capability

### 2. Block Granularity: 3 Main Blocks ✅

**Blocks**:

1. **select_clause**: SELECT statements and column definitions
2. **joins**: FROM and JOIN logic
3. **where_clause**: WHERE conditions and filters

**Benefits**:

- Logical separation matching SQL structure
- User-friendly progress understanding
- Manageable complexity
- Future extensibility

### 3. Dependency Validation: Trust Backend ✅

**Decision**: Frontend displays backend state without validation
**Benefits**:

- Clean separation of concerns
- Backend controls generation logic
- Simplified frontend logic
- Flexible backend rule changes

### 4. Persistence Strategy: localStorage ✅

**Decision**: Store hashmap in localStorage for recovery
**Benefits**:

- Connection recovery resilience
- Progress preservation across sessions
- Multi-session support
- Graceful browser restart handling

### 5. Performance: Simple Implementation ✅

**Decision**: Start with straightforward hashmap, optimize later
**Rationale**:

- Focus on core functionality first
- Monitor real usage performance
- Add pagination/chunking only if needed

---

## SSE Event Types

### Block Update Events

```javascript
{
  type: "block_update",
  generation_id: "gen_12345",
  block_name: "select_clause",
  block_data: {
    status: "completed",
    sql: "SELECT c.customer_id, c.customer_name",
    order: 1,
    timestamp: "2025-08-10T10:30:00Z"
  }
}
```

### Progress Events

```javascript
{
  type: "progress",
  generation_id: "gen_12345",
  message: "Generating SELECT clause...",
  stage: "select_generation",
  progress_percentage: 25
}
```

### Synchronization Events

```javascript
{
  type: "hashmap_sync",
  generation_id: "gen_12345",
  complete_hashmap: { /* full structure */ },
  reason: "initial_load|recovery|checkpoint"
}
```

### Completion Events

```javascript
{
  type: "generation_complete",
  generation_id: "gen_12345",
  final_sql: "-- Complete semantic layer SQL --",
  filename: "customer_semantic_layer.sql"
}
```

---

## Implementation Flow

### User Initiation

1. User uploads mapping document or sends prompt
2. Frontend generates UUID: `gen_${timestamp}_${random}`
3. Frontend creates initial hashmap entry in localStorage
4. Frontend sends request to backend with generation_id
5. Frontend starts listening for SSE events with that ID

### Backend Processing

1. Backend receives mapping document + generation_id
2. Backend processes mapping and begins SQL generation
3. Backend sends SSE events:
   - `block_update` for each block as it completes
   - `progress` messages for ChatPanel updates
   - `generation_complete` when all blocks finished

### Frontend Updates

1. Receive SSE event → Update localStorage hashmap
2. Assemble SQL from completed blocks → Update MainEditor
3. Show progress message → Update ChatPanel
4. Handle errors or interruptions gracefully

---

## Enhanced @Context System

### Context Types for Semantic Layers:

#### `@mapping[sheet:row]`

- Reference specific Excel mapping rows
- Example: "@mapping[Customer:A15] needs varchar(100) not varchar(50)"
- Visual: Highlights referenced row in Excel viewer

#### `@code[block:function]`

- Reference specific code sections
- Example: "@code[joins] optimize this for performance"
- Visual: Highlights code block in MainEditor

#### `@schema[table.column]`

- Reference data warehouse schema elements
- Example: "@schema[dim_customer.customer_key] should be surrogate key"
- Integration: Could connect to data catalog APIs

#### `@generation[step]`

- Reference specific generation steps
- Example: "@generation[select_clause] redo this step with different columns"
- Visual: References specific hashmap blocks

---

## User Experience Flow

### During Generation:

```
ChatPanel:
[User] Generate semantic layer for customer data using CustomerMapping.xlsx

[AI - Progress] 🔄 Starting generation process...
[AI - Progress] 📊 Parsing Excel mapping document...
[AI - Progress] 🔍 Found 47 column mappings in Sheet: Customer_Data
[AI - Progress] 🏗️ Generating SELECT clause...
[AI - Progress] ✅ SELECT clause complete
[AI - Progress] 🔄 Building JOIN logic...
[AI - Progress] ✅ JOIN logic complete
[AI - Progress] 🔄 Adding WHERE conditions...
[AI - Progress] ✅ WHERE clause complete

[AI - Final] ✅ Generation complete! Here's your semantic layer:
[Code Block with complete SQL]

MainEditor:
-- Shows SQL building in real-time as each block completes
-- Auto-formatted and saved as customer_semantic_layer.sql
```

---

## Technical Implementation Priority

### Phase 1: Core Infrastructure

1. **AppStateContext Enhancement**: Add SQL generation state management
2. **SSE Client Integration**: EventSource setup with reconnection logic
3. **localStorage Persistence**: Hashmap storage and recovery
4. **Basic Block Assembly**: SQL reconstruction from completed blocks

### Phase 2: UI Integration

1. **MainEditor Integration**: Real-time SQL assembly and display
2. **ChatPanel Enhancement**: Progress message styling and display
3. **File Management**: Auto-save and naming for generated files
4. **Error Handling**: Graceful degradation and user feedback

### Phase 3: Advanced Features

1. **Enhanced @Context System**: Block-level code references
2. **Generation History**: Version tracking and comparison
3. **Template Integration**: SQL pattern libraries
4. **Performance Optimization**: Large file handling and caching

---

## Error Handling & Recovery

### Connection Issues

- **Reconnection Logic**: Automatic SSE reconnection with exponential backoff
- **State Recovery**: Request hashmap sync after reconnection
- **Progress Preservation**: Maintain partial results during outages
- **User Feedback**: Clear status indicators for connection state

### Generation Failures

- **Partial Results**: Save completed blocks even if generation fails
- **Resume Capability**: Continue from last successful block
- **Manual Intervention**: Allow user editing of partial results
- **Error Context**: Detailed error messages with suggested fixes

### State Consistency

- **Validation**: Verify frontend hashmap matches backend state
- **Conflict Resolution**: Handle discrepancies gracefully
- **Cleanup**: Remove stale localStorage entries
- **Memory Management**: Efficient handling of large generation sessions

---

## Future Considerations

### Scalability

- **Multiple Concurrent Generations**: Support parallel SQL generation
- **Large Mapping Documents**: Handle Excel files with thousands of rows
- **Complex SQL**: Support generation of multi-thousand line semantic layers
- **Performance Monitoring**: Track generation times and optimize bottlenecks

### Advanced Features

- **PySpark Support**: Extend beyond SQL to Spark transformations
- **Testing Integration**: Validate generated SQL against sample data
- **Documentation Generation**: Auto-create docs from mapping documents
- **Collaboration**: Multi-user semantic layer development

### Integration Possibilities

- **Data Catalog Integration**: Connect to enterprise data catalogs
- **Version Control**: Git integration for semantic layer versioning
- **CI/CD Pipeline**: Automated testing and deployment of generated SQL
- **Monitoring**: Runtime performance tracking of deployed semantic layers

---

_Document Version: 1.0_  
_Date: August 10, 2025_  
_Status: Architecture Planning Complete_
