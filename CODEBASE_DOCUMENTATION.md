# AI-DE Pair: Codebase Documentation

## 📋 Project Overview

**AI-DE Pair** is a modern React-based IDE-like application that provides a VS Code-inspired interface for file management, code editing, Excel viewing, and AI chat integration. The application features a sophisticated state management system, responsive UI components, and advanced file handling capabilities.

### 🎯 Key Features

- **Multi-panel Interface**: File explorer, main editor, chat panel, and terminal
- **Excel Integration**: Full Excel file viewing with filtering, sorting, and sheet management
- **AI Chat System**: Integrated chat with file attachment and mention system
- **File Management**: Local folder access, GitHub integration, and cloud storage support
- **Monaco Editor**: Full-featured code editor with syntax highlighting
- **Terminal Panel**: Integrated terminal for development tasks
- **Theme System**: Dark/light theme support with consistent styling

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  App.js                                                         │
│  ├── ThemeProvider (Theme Context)                              │
│  └── AppStateProvider (Global State Management)                 │
│      └── VSCodeInterface (Main Layout)                          │
│          ├── FileExplorer (Left Panel)                          │
│          ├── MainEditor (Center Panel)                          │
│          │   ├── MonacoEditor (Code Editing)                    │
│          │   └── ExcelViewer (Excel Files)                      │
│          ├── ChatPanel (Right Panel)                            │
│          └── TerminalPanel (Bottom Panel)                       │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Technology Stack

### Core Technologies

- **React 18.3.1**: Component-based UI framework
- **Vite 6.0.5**: Fast build tool and dev server
- **TailwindCSS 4.1.5**: Utility-first CSS framework
- **Monaco Editor 0.52.2**: VS Code editor component

### Key Dependencies

- **@xyflow/react**: Flow diagram components
- **xlsx**: Excel file processing
- **framer-motion**: Animation library
- **react-icons**: Icon library
- **axios**: HTTP client for API calls

### Development Tools

- **Vitest**: Modern testing framework
- **React Testing Library**: Component testing utilities
- **ESLint**: Code linting
- **@testing-library/jest-dom**: Jest DOM matchers

## 🗂️ Project Structure

```
ai-de-pair/
├── public/                     # Static assets
│   └── vite.svg
├── src/                        # Source code
│   ├── components/             # React components
│   │   ├── ChatPanel.js        # AI chat interface
│   │   ├── ExcelViewer.js      # Excel file viewer
│   │   ├── FileExplorer.js     # File management
│   │   ├── MainEditor.js       # Main editing interface
│   │   ├── MonacoEditor.js     # Code editor wrapper
│   │   ├── TerminalPanel.js    # Terminal interface
│   │   ├── ThemeContext.js     # Theme management
│   │   ├── CustomScrollbar.js  # Custom scrollbar component
│   │   ├── ResizeHandle.js     # Panel resizing
│   │   ├── Tooltip.js          # Tooltip component
│   │   └── useResizable.js     # Resize hook
│   ├── contexts/               # React contexts
│   │   └── AppStateContext.js  # Global state management
│   ├── store/                  # Redux store (alternative)
│   │   ├── store.js            # Store configuration
│   │   └── slices/             # Redux slices
│   │       ├── chatSlice.js
│   │       ├── fileSlice.js
│   │       └── tabSlice.js
│   ├── test/                   # Test files
│   │   ├── setup.js            # Test setup
│   │   ├── *.test.js           # Unit tests
│   │   └── integration.test.js # Integration tests
│   ├── App.js                  # Main app component
│   ├── index.js                # React entry point
│   └── index.css               # Global styles
├── *.md                        # Documentation files
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
└── eslint.config.js            # ESLint configuration
```

## 🔧 State Management

The application uses a **React Context + useReducer** pattern for centralized state management, providing predictable state updates while maintaining performance.

### AppStateContext Structure

```javascript
{
  // File Management
  selectedFile: null,
  availableFiles: [],

  // Folder Management
  openFolders: [],              // Persisted to localStorage
  expandedFolders: Set(),       // Persisted to localStorage

  // Tab Management
  openTabs: [],
  activeTabId: null,

  // Excel Management
  excelFiles: {},               // { tabId: { content, activeSheet, sheetNames } }
  excelCache: Map(),

  // Chat Management
  chatInput: '',
  chatMessages: [],
  selectedLLM: 'claude-sonnet-3.5',
  attachedDocuments: [],

  // UI Layout
  panelSizes: {
    leftPanelWidth: 250,
    rightPanelWidth: 450,
    bottomPanelHeight: 0
  },
  isTerminalVisible: false,
  isResizing: false
}
```

### Action Types

The state is managed through a comprehensive set of action types:

- **File Management**: `SET_SELECTED_FILE`, `SET_AVAILABLE_FILES`
- **Folder Management**: `SET_OPEN_FOLDERS`, `ADD_FOLDER`, `REMOVE_FOLDER`, `RECONNECT_FOLDER`, `SET_EXPANDED_FOLDERS`
- **Tab Management**: `ADD_TAB`, `CLOSE_TAB`, `SET_ACTIVE_TAB`, `UPDATE_TABS`
- **Excel Management**: `SET_EXCEL_DATA`, `UPDATE_EXCEL_FILE`, `SET_EXCEL_ACTIVE_SHEET`, `CLEAR_EXCEL_DATA`
- **Chat Management**: `SET_CHAT_INPUT`, `ADD_CHAT_MESSAGE`, `SET_SELECTED_LLM`, `ADD_ATTACHMENT`, `REMOVE_ATTACHMENT`
- **UI State**: `SET_PANEL_SIZES`, `TOGGLE_TERMINAL`, `SET_RESIZING`

## 🧩 Core Components

### 1. App.js

**Purpose**: Main application shell and layout orchestration
**Key Features**:

- Theme and state provider wrapper
- Main layout with resizable panels
- Keyboard shortcuts (Ctrl+` for terminal)
- Panel resize handlers
- File operation coordination

### 2. FileExplorer.js (2,428 lines)

**Purpose**: File and folder management interface
**Key Features**:

- Local folder access using File System Access API
- GitHub repository integration
- Cloud storage connections (OneDrive, SharePoint, Google Drive)
- File operations (create, rename, delete)
- Context menu support
- Drag and drop functionality
- File type icons and categorization

**State Management**:

- Uses local state for UI interactions
- Communicates with parent via props/callbacks
- Persists folder structure to localStorage
- Maintains file handle registry for browser compatibility

### 3. MainEditor.js (879 lines)

**Purpose**: Central editing interface and tab management
**Key Features**:

- Tab-based file editing interface
- Monaco Editor integration for code files
- Excel file handling with ExcelViewer
- File content persistence
- Drag and drop file opening
- Word wrap toggle
- File rename/delete handling

**State Management**:

- Uses context for tab and Excel data
- Maintains local state for file contents
- Memoized content for performance optimization

### 4. ChatPanel.js (453 lines)

**Purpose**: AI chat interface with file context integration
**Key Features**:

- Chat input with @mention system
- File attachment functionality
- LLM model selection
- Message history management
- Auto-complete for file mentions
- Duplicate attachment prevention

**State Management**:

- Fully context-driven for chat state
- Local state for mention dropdowns and UI

### 5. ExcelViewer.js (776 lines)

**Purpose**: Advanced Excel file viewing and interaction
**Key Features**:

- Multi-sheet support with tab navigation
- Advanced filtering (text, number, date, multi-select)
- Column sorting (ascending/descending)
- Data export functionality
- Session-based filter persistence
- Large dataset optimization
- Responsive table design

**State Management**:

- Local state for workbook and UI
- SessionStorage for filter persistence
- Context integration via props/callbacks

### 6. TerminalPanel.js (169 lines)

**Purpose**: Terminal interface and data panel
**Key Features**:

- Collapsible terminal interface
- Tab-based data organization
- Dynamic tab creation/removal
- Height-based content adaptation

### 7. ThemeContext.js (51 lines)

**Purpose**: Theme management and styling
**Key Features**:

- Dark/light theme switching
- Comprehensive color scheme definitions
- Theme-aware component styling
- Consistent visual hierarchy

## 🎨 Styling System

The application uses TailwindCSS with a custom theme system:

### Theme Colors

**Dark Theme**:

- Primary: `bg-gray-900`
- Secondary: `bg-gray-800`
- Text: `text-white`, `text-gray-300`
- Borders: `border-gray-700`
- Accents: `text-blue-400`

**Light Theme**:

- Primary: `bg-white`
- Secondary: `bg-gray-100`
- Text: `text-gray-900`, `text-gray-700`
- Borders: `border-gray-300`
- Accents: `text-blue-600`

### Responsive Design

- Flexible panel system with drag-to-resize
- Minimum and maximum panel constraints
- Mobile-responsive layout considerations
- Custom scrollbar implementation

## 🔌 File System Integration

### File System Access API

- Modern browser file system access
- Persistent file handles
- Directory traversal and file operations
- Handle registry for drag-and-drop support

### GitHub Integration

- Repository browsing and file access
- Token-based authentication
- Branch selection support
- Single file and full repository modes

### Cloud Storage

- OneDrive integration
- SharePoint support
- Google Drive connectivity
- OAuth-based authentication flows

## 📊 Excel Processing

### XLSX Library Integration

- Full Excel file format support (.xlsx, .xls, .xlsm, .xlsb)
- Workbook and worksheet parsing
- Cell data type handling
- Formula preservation

### Advanced Features

- Multi-sheet navigation
- Column-based filtering
- Sorting capabilities
- Data export functionality
- Session-based preference storage

## 🧪 Testing Infrastructure

### Test Setup

- **Vitest**: Modern testing framework
- **React Testing Library**: Component testing
- **jsdom**: DOM environment simulation
- **@testing-library/user-event**: User interaction testing

### Test Coverage

- **Unit Tests**: Individual component functionality
- **Integration Tests**: Cross-component workflows
- **Utility Tests**: Helper function validation
- **State Management Tests**: Context and reducer logic

### Mock Configuration

- File System Access API mocking
- XLSX library mocking
- LocalStorage simulation
- DOM API polyfills

## 🚀 Performance Optimizations

### Component Level

- **Memoization**: React.memo for expensive components
- **useMemo**: Computed values and object references
- **useCallback**: Stable function references
- **useRef**: Direct DOM access and state persistence

### State Management

- **Minimal Re-renders**: Targeted state updates
- **Stable Keys**: Consistent component keys
- **Ref-based Optimizations**: Event handler optimization
- **Context Splitting**: Separate concerns to reduce re-renders

### Data Handling

- **Excel Caching**: In-memory workbook caching
- **Session Persistence**: Filter and preference storage
- **Lazy Loading**: Component and data lazy loading
- **Debounced Operations**: Input and resize debouncing

## 🔒 Security Considerations

### File Access

- Secure file handle management
- User permission-based file access
- CORS-compliant API requests

### Data Privacy

- Local data processing
- Session-based storage only
- No persistent sensitive data storage

## 🛠️ Development Workflow

### Scripts

```bash
npm start          # Development server
npm run build      # Production build
npm test           # Run tests
npm run test:ui    # Interactive test UI
npm run test:coverage  # Coverage report
npm run lint       # Code linting
```

### Code Quality

- ESLint configuration with React rules
- Consistent code formatting
- Comprehensive error handling
- TypeScript-ready architecture

## 📈 Scalability Features

### Modular Architecture

- Component-based design
- Context-driven state management
- Plugin-ready architecture
- Extensible file type support

### Future Enhancements

- **Redux Migration**: Alternative state management ready
- **Microservice Integration**: API-ready architecture
- **Plugin System**: Component extension framework
- **Advanced AI Features**: Enhanced chat capabilities

## 🐛 Known Issues and Limitations

### Browser Compatibility

- File System Access API requires modern browsers
- Fallback mechanisms for older browsers needed

### Performance

- Large Excel files may impact performance
- Memory usage optimization needed for massive datasets

### Features

- Terminal functionality is placeholder
- Real-time collaboration not implemented
- Advanced Git integration pending

## 📚 Additional Documentation

- **ARCHITECTURE.md**: Detailed system architecture
- **STATE_MANAGEMENT_DOCUMENTATION.md**: Complete state management guide
- **STATE_MANAGEMENT_COMPARISON.md**: Context vs Redux comparison
- **TESTING.md**: Comprehensive testing guide
- **INTEGRATION_PLAN.md**: Feature integration roadmap
- **MENTION_SYSTEM_GUIDE.md**: Chat mention system details

## 🔄 Recent Updates

### State Management Evolution

- Migrated from prop drilling to centralized context
- Implemented Redux Toolkit as alternative option
- Added comprehensive action system
- Enhanced performance optimizations

### Component Enhancements

- Advanced Excel filtering and sorting
- Improved file explorer with cloud integration
- Enhanced chat system with file mentions
- Better error handling and user feedback

### Developer Experience

- Comprehensive testing suite
- Improved documentation
- Better code organization
- Enhanced debugging capabilities

---

_This documentation reflects the current state of the AI-DE Pair codebase and will be updated as the project evolves._
