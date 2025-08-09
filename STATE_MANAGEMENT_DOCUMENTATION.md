# State Management Documentation

## Overview
This application uses a **centralized state management pattern** with React Context + useReducer, providing predictable state updates and component isolation while maintaining performance optimization.

## Architecture Pattern
```
AppStateProvider (Context)
├── Global State (useReducer)
├── Action Dispatchers
└── Component Consumers (useAppState hook)
```

---

## Global State Structure (AppStateContext)

### File Management State
```javascript
selectedFile: null,           // Currently selected file in FileExplorer
availableFiles: [],          // All files available in workspace
```

### Tab Management State  
```javascript
openTabs: [],               // Array of open editor tabs
activeTabId: null,          // ID of currently active tab
```

### Excel State
```javascript
excelFiles: {              // Excel file data by tabId
  "tab-123": {
    content: ArrayBuffer,    // Raw Excel file binary data
    activeSheet: "Sheet1",   // Currently active worksheet name
    sheetNames: ["Sheet1", "Sheet2"]  // All available worksheet names
  }
},
excelCache: new Map(),     // Performance cache for Excel operations
```

### Chat/AI State
```javascript
chatInput: '',             // Current chat input text
chatMessages: [],          // Chat conversation history
selectedLLM: 'claude-sonnet-3.5',  // Selected AI model
attachedDocuments: [],     // Files attached to chat context
```

### UI Layout State
```javascript
panelSizes: {
  leftPanelWidth: 250,     // FileExplorer panel width (px)
  rightPanelWidth: 450,    // ChatPanel width (px)  
  bottomPanelHeight: 0,    // Terminal panel height (px)
},
isTerminalVisible: false,  // Terminal panel visibility toggle
isResizing: false,         // UI resize operation in progress
```

---

## Component State Tracking

### Components Using ONLY Context State

#### App.js
**Context Dependencies:**
- `panelSizes` - For layout dimensions
- `isTerminalVisible` - Terminal visibility
- `isResizing` - Resize operation state

**Actions Used:**
- `setPanelSizes()` - Update panel dimensions
- `toggleTerminal()` - Show/hide terminal
- `setResizing()` - Set resize state

**Local State:** None (fully Context-driven)

#### ChatPanel.js  
**Context Dependencies:**
- `chatInput` - Current input text
- `chatMessages` - Message history
- `selectedLLM` - AI model selection
- `attachedDocuments` - File attachments

**Actions Used:**
- `setChatInput()` - Update input text
- `addChatMessage()` - Add new message
- `setSelectedLLM()` - Change AI model
- `addAttachment()` - Attach document
- `removeAttachment()` - Remove attachment

**Local State:** None (fully Context-driven)

---

### Components Using Context + Local State

#### MainEditor.js
**Context Dependencies:**
- `openTabs` - All open editor tabs
- `excelFiles` - Excel file data
- `activeTabId` - Currently active tab

**Actions Used:**
- `updateTabs()` - Add/remove/update tabs
- `setActiveTab()` - Switch active tab
- `updateExcelFile()` - Store Excel content
- `setExcelActiveSheet()` - Update active worksheet

**Local State:**
```javascript
fileContents: {},          // Non-Excel file contents by tabId
dragOver: false,           // Drag and drop state
```

**Memoized Data:**
```javascript
memoizedExcelContent,      // Stable Excel content reference
memoizedExcelMeta,         // Active sheet & sheet names
memoizedFileProps,         // File handle references
```

#### ExcelViewer.js
**Context Dependencies (via props):**
- `fileContent` - Raw Excel binary data
- `initialActiveSheet` - Active sheet from Context
- `sheetNames` - Available worksheets
- `onSheetChange` - Callback to update Context

**Local State:**
```javascript
workbook: null,            // XLSX workbook object
activeSheet: '',           // Current worksheet (synced with Context)
sheetData: [],            // Parsed worksheet data
originalSheetData: [],    // Unfiltered data backup
sheetNames: [],           // Available worksheets (synced with Context)
loading: true,            // Loading state
error: null,              // Error state
columnFilters: {},        // Column filter values
multiSelectFilters: {},   // Multi-select filter state
showFilterDropdown: null, // Filter dropdown visibility
sortConfig: null,         // Column sorting configuration
```

**SessionStorage:**
```javascript
`excelFilters_${storageKey}` - Column filters per worksheet
`excelMultiSelectFilters_${storageKey}` - Multi-select filters per worksheet
```

#### FileExplorer.js
**Context Dependencies:** None (communicates via props/callbacks)

**Local State:**
```javascript
openFolders: [],          // Opened directory structures
isLoadingFiles: false,    // File loading state
expandedFolders: Set,     // Expanded folder state
selectedFile: null,       // Currently selected file
contextMenu: {},          // Right-click context menu
// Dialog states
showCreateFileDialog: false,
showRenameDialog: false,
showDeleteDialog: false,
showGitHubDialog: false,
showCloudDialog: false,
// GitHub integration
gitHubRepos: [],
gitHubToken: '',
gitHubRepoUrl: '',
// Cloud storage
cloudConnections: [],
cloudFiles: [],
// UI state
activeTab: 'local',       // 'local', 'github', 'cloud'
```

**State Refs (for event handlers):**
```javascript
stateRefs.current = {     // Prevents useEffect dependency loops
  showCreateFileDialog,
  showRenameDialog,
  showDeleteDialog,
  showGitHubDialog,
  showCloudDialog,
  showCloudConnectDialog,
  openFolders,
  isLoadingFiles
}
```

#### TerminalPanel.js
**Context Dependencies:**
- `isTerminalVisible` - Visibility state

**Local State:**
```javascript
terminalContent: '',      // Terminal output content
isTerminalReady: false,   // Terminal initialization state
```

---

## Data Flow Patterns

### Excel File Workflow
```
1. File Selection (FileExplorer)
   ↓
2. Tab Creation (MainEditor → Context)
   ├── ADD_TAB action
   └── UPDATE_EXCEL_FILE action
   ↓
3. Content Loading (ExcelViewer)
   ├── Parse XLSX workbook
   ├── Extract sheet names
   └── Callback → SET_EXCEL_ACTIVE_SHEET
   ↓
4. Sheet Navigation (ExcelViewer → Context)
   ├── User clicks worksheet tab
   ├── handleSheetChange()
   └── onSheetChange callback → Context
   ↓
5. State Persistence (Context)
   ├── Stores activeSheet per tabId
   └── Maintains across tab switches
```

### Tab Switching Workflow
```
1. Tab Click (MainEditor)
   ├── SET_ACTIVE_TAB action
   └── Context updates activeTabId
   ↓
2. Component Re-render
   ├── MainEditor gets new activeTab
   ├── Memoized props recalculate
   └── ExcelViewer receives updated props
   ↓
3. State Restoration
   ├── ExcelViewer gets initialActiveSheet
   ├── Restores previous worksheet
   └── Loads saved filters from sessionStorage
```

### Chat Integration Workflow
```
1. User Input (ChatPanel)
   ├── setChatInput() action
   └── Context updates chatInput
   ↓
2. Message Send
   ├── addChatMessage() action
   ├── Context updates chatMessages[]
   └── Includes attached documents
   ↓
3. File Attachment
   ├── addAttachment() action
   ├── References to open tabs/files
   └── Context updates attachedDocuments[]
```

---

## Storage Locations

### In-Memory (React Context)
| Data Type | Storage Location | Persistence |
|-----------|-----------------|-------------|
| Tab metadata | `openTabs[]` | Session |
| Excel content | `excelFiles{}` | Session |
| Chat history | `chatMessages[]` | Session |
| UI layout | `panelSizes{}` | Session |
| File selection | `selectedFile` | Session |

### Browser Storage
| Data Type | Storage Method | Key Pattern | Persistence |
|-----------|---------------|-------------|-------------|
| Excel filters | sessionStorage | `excelFilters_${tabId}_${sheetName}` | Session |
| Multi-select filters | sessionStorage | `excelMultiSelectFilters_${tabId}_${sheetName}` | Session |

### Global Registry
| Data Type | Storage Location | Purpose |
|-----------|-----------------|---------|
| File handles | `window.fileHandleRegistry` | File system access |

---

## Performance Optimizations

### Memoization Strategy
```javascript
// MainEditor.js
const memoizedExcelContent = useMemo(() => {
  return excelFiles[activeTab?.id]?.content;
}, [activeTab?.id, excelFiles[activeTab?.id]?.content]);

const memoizedExcelMeta = useMemo(() => {
  return {
    activeSheet: excelFiles[activeTab?.id]?.activeSheet,
    sheetNames: excelFiles[activeTab?.id]?.sheetNames
  };
}, [activeTab?.id, excelFiles[activeTab?.id]?.activeSheet, excelFiles[activeTab?.id]?.sheetNames]);
```

### Component Key Strategy
```javascript
// Force separate instances per Excel file
<ExcelViewer key={`excel-${activeTab.id}`} />
```

### Ref-Based Optimizations
```javascript
// FileExplorer.js - Prevent useEffect dependency loops
const stateRefs = useRef({});
useEffect(() => {
  stateRefs.current = { /* current state values */ };
});
```

---

## Action Types Reference

### File Management
- `SET_SELECTED_FILE` - Update selected file in explorer
- `SET_AVAILABLE_FILES` - Update available files list

### Tab Management  
- `ADD_TAB` - Create new editor tab
- `CLOSE_TAB` - Remove editor tab
- `SET_ACTIVE_TAB` - Switch active tab
- `UPDATE_TABS` - Bulk tab updates

### Excel Management
- `SET_EXCEL_DATA` - Bulk Excel data update
- `UPDATE_EXCEL_FILE` - Update single Excel file
- `SET_EXCEL_ACTIVE_SHEET` - Update active worksheet
- `CLEAR_EXCEL_DATA` - Clear all Excel data

### Chat Management
- `SET_CHAT_INPUT` - Update chat input text
- `ADD_CHAT_MESSAGE` - Add message to history
- `SET_SELECTED_LLM` - Change AI model
- `ADD_ATTACHMENT` - Attach document
- `REMOVE_ATTACHMENT` - Remove attachment

### UI State
- `SET_PANEL_SIZES` - Update panel dimensions
- `TOGGLE_TERMINAL` - Show/hide terminal
- `SET_RESIZING` - Set resize state

---

## Component Dependencies Matrix

| Component | Context Read | Context Write | Local State | External Storage |
|-----------|--------------|---------------|-------------|------------------|
| App.js | ✅ panelSizes, isTerminalVisible | ✅ setPanelSizes, toggleTerminal | ❌ | ❌ |
| ChatPanel.js | ✅ chat state, attachments | ✅ chat actions | ❌ | ❌ |
| MainEditor.js | ✅ tabs, excel files | ✅ tab actions, excel actions | ✅ fileContents, dragOver | ❌ |
| ExcelViewer.js | ✅ (via props) | ✅ (via callbacks) | ✅ workbook, filters, UI | ✅ sessionStorage |
| FileExplorer.js | ❌ | ❌ | ✅ files, dialogs, UI | ✅ fileHandleRegistry |
| TerminalPanel.js | ✅ isTerminalVisible | ❌ | ✅ terminalContent | ❌ |

---

## Best Practices Implemented

### State Management
- ✅ Single source of truth (Context)
- ✅ Predictable updates (useReducer)
- ✅ Immutable state updates
- ✅ Action-based state changes

### Performance  
- ✅ Memoized expensive computations
- ✅ Stable component keys
- ✅ Ref-based optimizations
- ✅ Minimal re-renders

### Data Persistence
- ✅ Session-level state persistence
- ✅ Component-level preferences
- ✅ Graceful state restoration

### Component Architecture
- ✅ Clear separation of concerns
- ✅ Unidirectional data flow
- ✅ Component isolation
- ✅ Reusable state logic

This architecture provides robust state management while maintaining performance and scalability for complex file editing workflows.
