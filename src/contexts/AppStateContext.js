import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Action Types
const ACTION_TYPES = {
  // File Management
  SET_SELECTED_FILE: 'SET_SELECTED_FILE',
  SET_AVAILABLE_FILES: 'SET_AVAILABLE_FILES',
  ADD_MEMORY_FILE: 'ADD_MEMORY_FILE',
  ADD_MEMORY_FILE_PLACEHOLDER: 'ADD_MEMORY_FILE_PLACEHOLDER', // Create memory file structure without versions
  START_MEMORY_FILE_STREAMING: 'START_MEMORY_FILE_STREAMING',
  END_MEMORY_FILE_STREAMING: 'END_MEMORY_FILE_STREAMING',
  UPDATE_MEMORY_FILE: 'UPDATE_MEMORY_FILE',
  RENAME_MEMORY_FILE: 'RENAME_MEMORY_FILE',
  REMOVE_MEMORY_FILE: 'REMOVE_MEMORY_FILE',
  SAVE_MEMORY_FILE_TO_DISK: 'SAVE_MEMORY_FILE_TO_DISK',
  
  // Version management
  RESTORE_FILE_VERSION: 'RESTORE_FILE_VERSION',
  CLEAR_FILE_HISTORY: 'CLEAR_FILE_HISTORY',
  
  // Folder Management
  SET_OPEN_FOLDERS: 'SET_OPEN_FOLDERS',
  ADD_FOLDER: 'ADD_FOLDER',
  REMOVE_FOLDER: 'REMOVE_FOLDER',
  RECONNECT_FOLDER: 'RECONNECT_FOLDER',
  SET_EXPANDED_FOLDERS: 'SET_EXPANDED_FOLDERS',
  
  // Tab Management
  ADD_TAB: 'ADD_TAB',
  CLOSE_TAB: 'CLOSE_TAB',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  UPDATE_TABS: 'UPDATE_TABS',
  
  // Excel Management
  SET_EXCEL_DATA: 'SET_EXCEL_DATA',
  UPDATE_EXCEL_FILE: 'UPDATE_EXCEL_FILE',
  SET_EXCEL_ACTIVE_SHEET: 'SET_EXCEL_ACTIVE_SHEET',
  CLEAR_EXCEL_DATA: 'CLEAR_EXCEL_DATA',
  
  // Chat Management
  SET_CHAT_INPUT: 'SET_CHAT_INPUT',
  ADD_CHAT_MESSAGE: 'ADD_CHAT_MESSAGE',
  SET_SELECTED_LLM: 'SET_SELECTED_LLM',
  ADD_ATTACHMENT: 'ADD_ATTACHMENT',
  REMOVE_ATTACHMENT: 'REMOVE_ATTACHMENT',
  
  // SQL Generation
  START_SQL_GENERATION: 'START_SQL_GENERATION',
  UPDATE_SQL_STAGE: 'UPDATE_SQL_STAGE',
  UPDATE_SQL_CONTENT: 'UPDATE_SQL_CONTENT',
  COMPLETE_SQL_GENERATION: 'COMPLETE_SQL_GENERATION',
  RESET_SQL_GENERATION: 'RESET_SQL_GENERATION',
  PAUSE_SQL_GENERATION: 'PAUSE_SQL_GENERATION',
  ASK_USER_QUESTION: 'ASK_USER_QUESTION',
  SUBMIT_USER_RESPONSE: 'SUBMIT_USER_RESPONSE',
  RESUME_SQL_GENERATION: 'RESUME_SQL_GENERATION',
  
  // Database Connection Management
  ADD_DB_CONNECTION: 'ADD_DB_CONNECTION',
  UPDATE_DB_CONNECTION: 'UPDATE_DB_CONNECTION',
  DELETE_DB_CONNECTION: 'DELETE_DB_CONNECTION',
  SET_ACTIVE_CONNECTION: 'SET_ACTIVE_CONNECTION',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  SET_FILE_CONNECTION: 'SET_FILE_CONNECTION', // New: Set connection for specific file
  
  // SQL Execution
  EXECUTE_SQL_QUERY: 'EXECUTE_SQL_QUERY',
  SET_SQL_RESULTS: 'SET_SQL_RESULTS',
  SET_SQL_EXECUTING: 'SET_SQL_EXECUTING',
  SET_ACTIVE_SQL_TAB: 'SET_ACTIVE_SQL_TAB',
  SET_SQL_TAB_EXECUTING: 'SET_SQL_TAB_EXECUTING',
  REMOVE_SQL_TAB: 'REMOVE_SQL_TAB',
  
  // UI State
  SET_PANEL_SIZES: 'SET_PANEL_SIZES',
  TOGGLE_TERMINAL: 'TOGGLE_TERMINAL',
  SET_RESIZING: 'SET_RESIZING',
};

// Helper functions for persistence
const STORAGE_KEYS = {
  FOLDERS: 'fileExplorer_openFolders',
  EXPANDED_FOLDERS: 'fileExplorer_expandedFolders',
  FILE_HANDLES: 'fileExplorer_fileHandles',
  DB_CONNECTIONS: 'databricks_connections', // localStorage key for connection metadata
  ACTIVE_CONNECTION: 'databricks_active_connection', // localStorage key for active connection ID
  FILE_CONNECTIONS: 'file_connections' // localStorage key for file-specific connections
};

// Migration function to move connections from sessionStorage to localStorage
const migrateConnectionsToLocalStorage = () => {
  try {
    console.log('🔄 Starting connection migration from sessionStorage to localStorage...');
    
    // Migrate DB_CONNECTIONS
    const sessionConnections = sessionStorage.getItem(STORAGE_KEYS.DB_CONNECTIONS);
    const localConnections = localStorage.getItem(STORAGE_KEYS.DB_CONNECTIONS);
    
    if (sessionConnections && !localConnections) {
      localStorage.setItem(STORAGE_KEYS.DB_CONNECTIONS, sessionConnections);
      console.log('🔄 Migrated DB connections from sessionStorage to localStorage');
    }

    // Migrate ACTIVE_CONNECTION
    const sessionActiveConnection = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_CONNECTION);
    const localActiveConnection = localStorage.getItem(STORAGE_KEYS.ACTIVE_CONNECTION);
    
    if (sessionActiveConnection && !localActiveConnection) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CONNECTION, sessionActiveConnection);
      console.log('🔄 Migrated active connection from sessionStorage to localStorage');
    }

    // Migrate FILE_CONNECTIONS
    const sessionFileConnections = sessionStorage.getItem(STORAGE_KEYS.FILE_CONNECTIONS);
    const localFileConnections = localStorage.getItem(STORAGE_KEYS.FILE_CONNECTIONS);
    
    if (sessionFileConnections && !localFileConnections) {
      localStorage.setItem(STORAGE_KEYS.FILE_CONNECTIONS, sessionFileConnections);
      console.log('🔄 Migrated file connections from sessionStorage to localStorage');
    }

    // Migrate legacy databricks_connections key
    const legacyDatabricksConnections = sessionStorage.getItem('databricks_connections');
    const localLegacyConnections = localStorage.getItem('databricks_connections');
    
    if (legacyDatabricksConnections && !localLegacyConnections) {
      localStorage.setItem('databricks_connections', legacyDatabricksConnections);
      console.log('🔄 Migrated legacy databricks connections from sessionStorage to localStorage');
    }

    // Log final state for debugging
    console.log('🔄 Migration complete. Current localStorage state:');
    console.log('  - databricks_connections:', localStorage.getItem(STORAGE_KEYS.DB_CONNECTIONS) ? 'EXISTS' : 'EMPTY');
    console.log('  - active_connection:', localStorage.getItem(STORAGE_KEYS.ACTIVE_CONNECTION) ? 'EXISTS' : 'EMPTY');
    console.log('  - file_connections:', localStorage.getItem(STORAGE_KEYS.FILE_CONNECTIONS) ? 'EXISTS' : 'EMPTY');
    console.log('  - legacy databricks_connections:', localStorage.getItem('databricks_connections') ? 'EXISTS' : 'EMPTY');

    // Clean up sessionStorage after migration (optional - comment out if you want to keep them)
    // sessionStorage.removeItem(STORAGE_KEYS.DB_CONNECTIONS);
    // sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_CONNECTION);
    // sessionStorage.removeItem(STORAGE_KEYS.FILE_CONNECTIONS);
    // sessionStorage.removeItem('databricks_connections');
    
  } catch (error) {
    console.warn('🔄 Failed to migrate connections to localStorage:', error);
  }
};

// Run migration on module load
migrateConnectionsToLocalStorage();

// Helper function to get current content from version history
const getCurrentContent = (memoryFile) => {
  if (!memoryFile || !memoryFile.versions || memoryFile.versions.length === 0) {
    return '';
  }
  const currentIndex = memoryFile.currentVersionIndex || 0;
  return memoryFile.versions[currentIndex]?.content || '';
};

// Helper function to add a new version (always becomes current)
const addVersion = (memoryFile, content, description = 'Manual edit') => {
  const newVersion = {
    content,
    timestamp: new Date(),
    description,
    generationId: Date.now().toString()
  };
  
  const existingVersions = memoryFile.versions || [];
  
  // If there's a streaming version (temporary), replace it instead of adding new
  if (existingVersions.length === 1 && existingVersions[0].generationId === 'streaming') {
    return {
      ...memoryFile,
      versions: [newVersion],
      currentVersionIndex: 0,
      lastModified: new Date()
    };
  }
  
  // Normal case: add new version
  const versions = [newVersion, ...existingVersions].slice(0, 10);
  
  return {
    ...memoryFile,
    versions,
    currentVersionIndex: 0,
    lastModified: new Date()
  };
};

const saveFoldersToStorage = (folders) => {
  try {
    // Save folder structure (without file handles)
    const foldersToSave = folders.map(folder => ({
      ...folder,
      // Remove handle references for storage
      handle: null,
      children: folder.children ? folder.children.map(child => ({
        ...child,
        handle: null
      })) : undefined
    }));
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(foldersToSave));
  } catch (error) {
    console.warn('Failed to save folders to localStorage:', error);
  }
};

const loadFoldersFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FOLDERS);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    // Ensure we always return an array
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to load folders from localStorage:', error);
    // Clear corrupted data
    localStorage.removeItem(STORAGE_KEYS.FOLDERS);
    return [];
  }
};

const saveExpandedFoldersToStorage = (expandedSet) => {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPANDED_FOLDERS, JSON.stringify(Array.from(expandedSet)));
  } catch (error) {
    console.warn('Failed to save expanded folders to localStorage:', error);
  }
};

const loadExpandedFoldersFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.EXPANDED_FOLDERS);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch (error) {
    console.warn('Failed to load expanded folders from localStorage:', error);
    return new Set();
  }
};

const loadDatabaseConnectionsFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DB_CONNECTIONS);
    console.log('🔍 Loading DB connections from localStorage:', stored ? 'FOUND' : 'NOT FOUND');
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    console.log('🔍 Parsed DB connections:', parsed.length, 'connections found');
    // Ensure we always return an array
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to load database connections from localStorage:', error);
    // Clear corrupted data
    localStorage.removeItem(STORAGE_KEYS.DB_CONNECTIONS);
    return [];
  }
};

const loadActiveConnectionFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_CONNECTION);
    console.log('🔍 Loading active connection from localStorage:', stored || 'NOT FOUND');
    return stored || null;
  } catch (error) {
    console.warn('Failed to load active connection from localStorage:', error);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONNECTION);
    return null;
  }
};

const loadFileConnectionsFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FILE_CONNECTIONS);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load file connections from localStorage:', error);
    localStorage.removeItem(STORAGE_KEYS.FILE_CONNECTIONS);
    return {};
  }
};

const saveActiveConnectionToStorage = (connectionId) => {
  try {
    if (connectionId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CONNECTION, connectionId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONNECTION);
    }
  } catch (error) {
    console.warn('Failed to save active connection to localStorage:', error);
  }
};

// Initial State with persistence
const createInitialState = () => ({
  // File State
  selectedFile: null,
  availableFiles: [],
  memoryFiles: {},
  streamingMemoryFiles: {}, // Track which memory files are currently streaming // { fileId: { name: string, type: string, isGenerated: boolean, lastModified: Date, versions: Array, currentVersionIndex: number } }
  
  // Folder State
  openFolders: loadFoldersFromStorage(),              // Load from localStorage
  expandedFolders: loadExpandedFoldersFromStorage(),  // Load from localStorage
  
  // Tab State
  openTabs: [],
  activeTabId: null,
  
  // Excel State
  excelFiles: {}, // { tabId: { content: arrayBuffer, activeSheet: string, sheetNames: string[] } }
  excelCache: new Map(),
  
  // Chat State
  chatInput: '',
  chatMessages: [],
  selectedLLM: 'claude-sonnet-3.5',
  attachedDocuments: [],
  
  // SQL Generation State
  sqlGeneration: {
    isActive: false,
    generationId: null,
    currentStage: null,
    sqlContent: '',
    stageHistory: [],
    isPaused: false,
    currentQuestion: null,
    questionHistory: [],
    userResponses: {},
    pausedAt: null,
    pauseDuration: 0,
    metadata: {
      sourceFile: null,
      tableStructure: {},
      columnMappings: [],
      joinDefinitions: [],
      selectFields: [],
      whereConditions: []
    }
  },
  
  // Database Connection State
  dbConnections: loadDatabaseConnectionsFromStorage(), // Load from localStorage
  activeConnectionId: loadActiveConnectionFromStorage(), // Load active connection from localStorage
  fileConnections: loadFileConnectionsFromStorage(), // Load file-specific connections from localStorage
  connectionStatus: {}, // { connectionId: { isConnected: boolean, lastChecked: Date, error: string } }
  
  // SQL Execution State
  sqlExecution: {
    isExecuting: false,
    lastQuery: '',
    lastResults: null,
    lastError: null,
    resultTabs: [], // Track result tabs created from MainEditor
  },
  
  // UI State
  panelSizes: {
    leftPanelWidth: 250,
    rightPanelWidth: 550, // Increased from 450 to 550 for even wider ChatPanel
    bottomPanelHeight: 0,
  },
  isTerminalVisible: false,
  isResizing: false,
});

// Initial State
const initialState = createInitialState();

// Reducer
const appStateReducer = (state, action) => {
  switch (action.type) {
    // File Management
    case ACTION_TYPES.SET_SELECTED_FILE:
      return {
        ...state,
        selectedFile: action.payload,
      };
      
    case ACTION_TYPES.SET_AVAILABLE_FILES:
      return {
        ...state,
        availableFiles: action.payload,
      };
    
    case ACTION_TYPES.START_MEMORY_FILE_STREAMING: {
      const { fileId } = action.payload;
      return {
        ...state,
        streamingMemoryFiles: {
          ...state.streamingMemoryFiles,
          [fileId]: {
            isStreaming: true,
            startTime: new Date(),
            currentContent: ''
          }
        }
      };
    }
    
    case ACTION_TYPES.END_MEMORY_FILE_STREAMING: {
      const { fileId } = action.payload;
      const { [fileId]: removed, ...remainingStreaming } = state.streamingMemoryFiles;
      return {
        ...state,
        streamingMemoryFiles: remainingStreaming
      };
    }
    
    case ACTION_TYPES.ADD_MEMORY_FILE_PLACEHOLDER: {
      const { fileId, name, type = 'text', isGenerated = false } = action.payload;
      
      return {
        ...state,
        memoryFiles: {
          ...state.memoryFiles,
          [fileId]: {
            name,
            type,
            isGenerated,
            lastModified: new Date(),
            versions: [], // No initial version - will be added when streaming completes
            currentVersionIndex: -1 // No current version yet
          }
        }
      };
    }
    
    case ACTION_TYPES.ADD_MEMORY_FILE: {
      const { fileId, name, content, type = 'text', isGenerated = false } = action.payload;
      const initialVersion = {
        content,
        timestamp: new Date(),
        description: '🚀 Initial file generation',
        generationId: 'initial'
      };
      
      return {
        ...state,
        memoryFiles: {
          ...state.memoryFiles,
          [fileId]: {
            name,
            type,
            isGenerated,
            lastModified: new Date(),
            versions: [initialVersion],
            currentVersionIndex: 0
          }
        }
      };
    }
    
    case ACTION_TYPES.UPDATE_MEMORY_FILE: {
      const { fileId, content, createVersion = true, description = 'Manual edit' } = action.payload;
      const existingFile = state.memoryFiles[fileId];
      if (!existingFile) return state;
      
      const isStreaming = state.streamingMemoryFiles[fileId]?.isStreaming;
      
      // Debug logging to track version creation
      console.log('🔍 UPDATE_MEMORY_FILE:', {
        fileId,
        createVersion,
        isStreaming,
        description,
        currentVersionCount: existingFile.versions?.length || 0
      });
      
      if (createVersion && !isStreaming) {
        // Create a new version (normal case - not during streaming)
        console.log('📝 Creating new version for:', fileId, 'Description:', description);
        const updatedFile = addVersion(existingFile, content, description);
        
        return {
          ...state,
          memoryFiles: {
            ...state.memoryFiles,
            [fileId]: updatedFile
          }
        };
      } else {
        // Update streaming content or current version without creating new version
        console.log('🔄 Updating without version creation:', fileId, 'Streaming:', isStreaming);
        let updatedFile = { ...existingFile };
        
        if (isStreaming) {
          // During streaming: update streaming state and current content
          const updatedStreamingState = {
            ...state.streamingMemoryFiles,
            [fileId]: {
              ...state.streamingMemoryFiles[fileId],
              currentContent: content
            }
          };
          
          // If no versions exist yet, create initial streaming version
          if (!existingFile.versions || existingFile.versions.length === 0) {
            updatedFile = {
              ...existingFile,
              versions: [{
                content,
                timestamp: new Date(),
                description: '🔄 Streaming...',
                generationId: 'streaming'
              }],
              currentVersionIndex: 0,
              lastModified: new Date()
            };
          } else {
            // Update existing version during streaming
            const updatedVersions = [...existingFile.versions];
            updatedVersions[0] = {
              ...updatedVersions[0],
              content,
              timestamp: new Date()
            };
            updatedFile = {
              ...existingFile,
              versions: updatedVersions,
              lastModified: new Date()
            };
          }
          
          return {
            ...state,
            memoryFiles: {
              ...state.memoryFiles,
              [fileId]: updatedFile
            },
            streamingMemoryFiles: updatedStreamingState
          };
        } else {
          // Normal content update without version creation
          const updatedVersions = [...existingFile.versions];
          if (updatedVersions.length > 0) {
            updatedVersions[existingFile.currentVersionIndex || 0] = {
              ...updatedVersions[existingFile.currentVersionIndex || 0],
              content: content
            };
          }
          
          return {
            ...state,
            memoryFiles: {
              ...state.memoryFiles,
              [fileId]: {
                ...existingFile,
                versions: updatedVersions,
                lastModified: new Date()
              }
            }
          };
        }
      }
    }
    
    case ACTION_TYPES.RENAME_MEMORY_FILE: {
      const { fileId, newName } = action.payload;
      const file = state.memoryFiles[fileId];
      if (!file) return state;
      
      return {
        ...state,
        memoryFiles: {
          ...state.memoryFiles,
          [fileId]: {
            ...file,
            name: newName,
            lastModified: new Date()
          }
        }
      };
    }
    
    case ACTION_TYPES.REMOVE_MEMORY_FILE: {
      const fileId = action.payload;
      const { [fileId]: removed, ...remainingFiles } = state.memoryFiles;
      return {
        ...state,
        memoryFiles: remainingFiles,
      };
    }
    
    case ACTION_TYPES.SAVE_MEMORY_FILE_TO_DISK: {
      const { fileId } = action.payload;
      const file = state.memoryFiles[fileId];
      if (!file) return state;
      
      // Mark as no longer generated since it's been saved to disk
      return {
        ...state,
        memoryFiles: {
          ...state.memoryFiles,
          [fileId]: {
            ...file,
            isGenerated: false,
            lastModified: new Date(),
          }
        }
      };
    }
    
    // Folder Management
    case ACTION_TYPES.SET_OPEN_FOLDERS:
      return {
        ...state,
        openFolders: Array.isArray(action.payload) ? action.payload : [],
      };
      
    case ACTION_TYPES.ADD_FOLDER: {
      // Ensure openFolders is an array
      const currentFolders = Array.isArray(state.openFolders) ? state.openFolders : [];
      const folderExists = currentFolders.some(folder => folder.id === action.payload.id);
      if (folderExists) {
        return state; // Don't add if already exists
      }
      return {
        ...state,
        openFolders: [...currentFolders, action.payload],
      };
    }
      
    case ACTION_TYPES.REMOVE_FOLDER: {
      // Ensure openFolders is an array
      const foldersToFilter = Array.isArray(state.openFolders) ? state.openFolders : [];
      return {
        ...state,
        openFolders: foldersToFilter.filter(folder => folder.id !== action.payload),
      };
    }
      
    case ACTION_TYPES.RECONNECT_FOLDER: {
      // Ensure openFolders is an array
      const foldersToReconnect = Array.isArray(state.openFolders) ? state.openFolders : [];
      return {
        ...state,
        openFolders: foldersToReconnect.map(folder => 
          folder.id === action.payload.folderId ? action.payload.folder : folder
        ),
      };
    }
      
    case ACTION_TYPES.SET_EXPANDED_FOLDERS:
      return {
        ...state,
        expandedFolders: new Set(action.payload),
      };
    
    // Tab Management
    case ACTION_TYPES.ADD_TAB: {
      const newTab = action.payload;
      const existingTabIndex = state.openTabs.findIndex(tab => tab.id === newTab.id);
      
      if (existingTabIndex >= 0) {
        // Update existing tab
        const updatedTabs = [...state.openTabs];
        updatedTabs[existingTabIndex] = newTab;
        return {
          ...state,
          openTabs: updatedTabs,
          activeTabId: newTab.id,
        };
      } else {
        // Add new tab
        return {
          ...state,
          openTabs: [...state.openTabs, newTab],
          activeTabId: newTab.id,
        };
      }
    }
      
    case ACTION_TYPES.CLOSE_TAB: {
      const tabIdToClose = action.payload;
      const remainingTabs = state.openTabs.filter(tab => tab.id !== tabIdToClose);
      
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === tabIdToClose && remainingTabs.length > 0) {
        // If closing active tab, switch to the last remaining tab
        newActiveTabId = remainingTabs[remainingTabs.length - 1].id;
      } else if (remainingTabs.length === 0) {
        newActiveTabId = null;
      }
      
      return {
        ...state,
        openTabs: remainingTabs,
        activeTabId: newActiveTabId,
      };
    }
      
    case ACTION_TYPES.SET_ACTIVE_TAB:
      return {
        ...state,
        activeTabId: action.payload,
        openTabs: state.openTabs.map(tab => ({
          ...tab,
          isActive: tab.id === action.payload,
        })),
      };
      
    case ACTION_TYPES.UPDATE_TABS:
      return {
        ...state,
        openTabs: action.payload,
      };
    
    // Excel Management
    case ACTION_TYPES.SET_EXCEL_DATA:
      return {
        ...state,
        excelFiles: action.payload,
      };
      
    case ACTION_TYPES.UPDATE_EXCEL_FILE: {
      const { fileId, data } = action.payload;
      return {
        ...state,
        excelFiles: {
          ...state.excelFiles,
          [fileId]: data,
        },
      };
    }
      
    case ACTION_TYPES.SET_EXCEL_ACTIVE_SHEET: {
      const { tabId, activeSheet, sheetNames } = action.payload;
      const existingFile = state.excelFiles[tabId] || {};
      return {
        ...state,
        excelFiles: {
          ...state.excelFiles,
          [tabId]: {
            ...existingFile,
            activeSheet,
            sheetNames: sheetNames || existingFile.sheetNames,
          },
        },
      };
    }
      
    case ACTION_TYPES.CLEAR_EXCEL_DATA:
      return {
        ...state,
        excelFiles: {},
        excelCache: new Map(),
      };
    
    // Chat Management
    case ACTION_TYPES.SET_CHAT_INPUT:
      return {
        ...state,
        chatInput: action.payload,
      };
      
    case ACTION_TYPES.ADD_CHAT_MESSAGE:
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload],
      };
      
    case ACTION_TYPES.SET_SELECTED_LLM:
      return {
        ...state,
        selectedLLM: action.payload,
      };
      
    case ACTION_TYPES.ADD_ATTACHMENT:
      return {
        ...state,
        attachedDocuments: [...state.attachedDocuments, action.payload],
      };
      
    case ACTION_TYPES.REMOVE_ATTACHMENT:
      return {
        ...state,
        attachedDocuments: state.attachedDocuments.filter(
          doc => doc.id !== action.payload
        ),
      };
    
    // UI State
    case ACTION_TYPES.SET_PANEL_SIZES:
      return {
        ...state,
        panelSizes: {
          ...state.panelSizes,
          ...action.payload,
        },
      };
      
    case ACTION_TYPES.TOGGLE_TERMINAL: {
      const newTerminalVisible = !state.isTerminalVisible;
      return {
        ...state,
        isTerminalVisible: newTerminalVisible,
        panelSizes: {
          ...state.panelSizes,
          // Set a reasonable height when opening terminal, keep current height when closing
          bottomPanelHeight: newTerminalVisible 
            ? (state.panelSizes.bottomPanelHeight === 0 ? 200 : state.panelSizes.bottomPanelHeight)
            : state.panelSizes.bottomPanelHeight
        },
      };
    }
      
    case ACTION_TYPES.SET_RESIZING:
      return {
        ...state,
        isResizing: action.payload,
      };

    // SQL Generation Cases
    case ACTION_TYPES.START_SQL_GENERATION: {
      const { generationId, sourceFile, options = {} } = action.payload;
      
      // If we're working with an existing SQL file, prepare the context
      let initialSqlContent = '';
      let targetFileName = sourceFile;
      
      if (options.useExisting && options.fileData) {
        // Use the existing file's content as starting point
        initialSqlContent = options.fileData.codeData?.content || '';
        targetFileName = options.fileData.name;
      }
      
      return {
        ...state,
        sqlGeneration: {
          ...state.sqlGeneration,
          isActive: true,
          generationId,
          currentStage: 'parsing-file',
          sqlContent: initialSqlContent,
          stageHistory: [],
          isPaused: false,
          currentQuestion: null,
          pausedAt: null,
          metadata: {
            ...state.sqlGeneration.metadata,
            sourceFile,
            targetFileName,
            useExisting: options.useExisting || false,
            existingFileData: options.fileData || null,
            codeMentions: options.mentions || []
          }
        }
      };
    }

    case ACTION_TYPES.UPDATE_SQL_STAGE: {
      const { stage, stageData, sqlContent } = action.payload;
      return {
        ...state,
        sqlGeneration: {
          ...state.sqlGeneration,
          currentStage: stage,
          sqlContent: sqlContent || state.sqlGeneration.sqlContent,
          stageHistory: [...state.sqlGeneration.stageHistory, {
            stage,
            completedAt: Date.now(),
            data: stageData
          }],
          metadata: {
            ...state.sqlGeneration.metadata,
            ...stageData
          }
        }
      };
    }

    case ACTION_TYPES.UPDATE_SQL_CONTENT: {
      return {
        ...state,
        sqlGeneration: {
          ...state.sqlGeneration,
          sqlContent: action.payload
        }
      };
    }

    case ACTION_TYPES.COMPLETE_SQL_GENERATION: {
      const { finalSql } = action.payload;
      const newState = {
        ...state,
        sqlGeneration: {
          ...state.sqlGeneration,
          isActive: false,
          currentStage: 'complete',
          sqlContent: finalSql || state.sqlGeneration.sqlContent,
          isPaused: false,
          currentQuestion: null
        }
      };
      
      // ALWAYS close existing generated SQL files when completing SQL generation
      const filteredTabs = state.openTabs.filter(tab => {
        // Keep non-SQL tabs
        const isLikelySQLTab = tab.name && tab.name.endsWith('.sql');
        if (!isLikelySQLTab) return true;
        
        // For SQL tabs, be more aggressive about closing generated ones
        const memoryFile = state.memoryFiles[tab.id];
        if (memoryFile) {
          // If it's a memory file, keep only user-modified ones
          const shouldKeep = !memoryFile.isGenerated;
          return shouldKeep;
        } else {
          // If no memory file, check if tab name suggests it's generated
          const isGeneratedSQLTab = tab.name.startsWith('sql_') || 
                                   tab.name.startsWith('generated-sql') ||
                                   tab.name.includes('_gen_') ||
                                   tab.name.includes('semantic_layer');
          const shouldKeep = !isGeneratedSQLTab;
          return shouldKeep;
        }
      });
      
      // Check if we need to update an existing file or create a new one
      const { metadata } = state.sqlGeneration;
      const sqlContent = finalSql || state.sqlGeneration.sqlContent;
      
      if (metadata.useExisting && metadata.existingFileData) {
        // Update existing file with version history
        const existingFileData = metadata.existingFileData;
        const fileId = existingFileData.id || `memory-${existingFileData.name}`;
        
        // Find existing memory file
        const existingMemoryFile = state.memoryFiles[fileId];
        if (existingMemoryFile) {
          // Add new version (becomes current version)
          const updatedFile = addVersion(existingMemoryFile, sqlContent, "🤖 AI modification");
          
          newState.memoryFiles = {
            ...state.memoryFiles,
            [fileId]: updatedFile
          };
          
          // Use filtered tabs and ensure existing file tab is active
          newState.openTabs = filteredTabs.map(tab => 
            tab.id === fileId ? { ...tab, isActive: true } : { ...tab, isActive: false }
          );
          
          // If the tab was filtered out, add it back
          const tabExists = filteredTabs.some(tab => tab.id === fileId);
          if (!tabExists) {
            newState.openTabs.push({
              id: fileId,
              name: existingFileData.name,
              type: 'memory',
              isActive: true
            });
          }
          
          newState.activeTabId = fileId;
        } else {
          // Create new memory file if it doesn't exist
          const initialVersion = {
            content: sqlContent,
            timestamp: new Date(),
            description: "🚀 Initial file generation",
            generationId: metadata.generationId || 'initial'
          };
          
          newState.memoryFiles = {
            ...state.memoryFiles,
            [fileId]: {
              name: existingFileData.name,
              type: 'sql',
              isGenerated: true,
              lastModified: new Date(),
              versions: [initialVersion],
              currentVersionIndex: 0
            }
          };
          
          // Use filtered tabs for new memory file too
          newState.openTabs = [
            ...filteredTabs,
            {
              id: fileId,
              name: existingFileData.name,
              type: 'memory',
              isActive: true
            }
          ];
          newState.activeTabId = fileId;
        }
      } else {
        // Create new file as before (default behavior)
        const timestamp = Date.now();
        const fileName = `sql_${timestamp.toString().slice(-6)}.sql`; // Shorter name with last 6 digits
        const fileId = `generated-sql-${timestamp}`;
        
        // Create initial version with the actual generated content
        const initialVersion = {
          content: sqlContent, // Use the actual generated content
          timestamp: new Date(),
          description: "🚀 Initial file generation",
          generationId: metadata.generationId || 'initial'
        };
        
        newState.memoryFiles = {
          ...state.memoryFiles,
          [fileId]: {
            name: fileName,
            type: 'sql',
            isGenerated: true,
            lastModified: new Date(),
            versions: [initialVersion],
            currentVersionIndex: 0
          }
        };
        
        // Add to open tabs using the filtered tabs from above
        const existingTab = filteredTabs.find(tab => tab.id === fileId);
        if (!existingTab) {
          newState.openTabs = [
            ...filteredTabs,
            {
              id: fileId,
              name: fileName,
              type: 'memory',
              isActive: true
            }
          ];
          newState.activeTabId = fileId;
        } else {
          // If tab exists, just make it active and use filtered tabs
          newState.openTabs = filteredTabs.map(tab => 
            tab.id === fileId ? { ...tab, isActive: true } : { ...tab, isActive: false }
          );
          newState.activeTabId = fileId;
        }
      }
      
      return newState;
    }

    case ACTION_TYPES.PAUSE_SQL_GENERATION: {
      return {
        ...state,
        sqlGeneration: {
          ...state.sqlGeneration,
          isPaused: true,
          pausedAt: Date.now()
        }
      };
    }

    case ACTION_TYPES.ASK_USER_QUESTION: {
      const { question } = action.payload;
      return {
        ...state,
        sqlGeneration: {
          ...state.sqlGeneration,
          isPaused: true,
          currentQuestion: question,
          pausedAt: Date.now(),
          questionHistory: [...state.sqlGeneration.questionHistory, question]
        }
      };
    }

    case ACTION_TYPES.SUBMIT_USER_RESPONSE: {
      const { questionId, response } = action.payload;
      return {
        ...state,
        sqlGeneration: {
          ...state.sqlGeneration,
          userResponses: {
            ...state.sqlGeneration.userResponses,
            [questionId]: response
          }
        }
      };
    }

    case ACTION_TYPES.RESUME_SQL_GENERATION: {
      const pauseDuration = state.sqlGeneration.pausedAt 
        ? Date.now() - state.sqlGeneration.pausedAt 
        : 0;
      return {
        ...state,
        sqlGeneration: {
          ...state.sqlGeneration,
          isPaused: false,
          currentQuestion: null,
          pausedAt: null,
          pauseDuration: state.sqlGeneration.pauseDuration + pauseDuration
        }
      };
    }

    case ACTION_TYPES.RESET_SQL_GENERATION: {
      return {
        ...state,
        sqlGeneration: {
          isActive: false,
          generationId: null,
          currentStage: null,
          sqlContent: '',
          stageHistory: [],
          isPaused: false,
          currentQuestion: null,
          questionHistory: [],
          userResponses: {},
          pausedAt: null,
          pauseDuration: 0,
          metadata: {
            sourceFile: null,
            tableStructure: {},
            columnMappings: [],
            joinDefinitions: [],
            selectFields: [],
            whereConditions: []
          }
        }
      };
    }

    // Version management cases
    case ACTION_TYPES.RESTORE_FILE_VERSION: {
      const { fileId, versionIndex } = action.payload;
      const file = state.memoryFiles[fileId];
      
      if (!file || !file.versions || versionIndex >= file.versions.length) {
        return state;
      }
      
      // Simply change the current version index to the selected version
      return {
        ...state,
        memoryFiles: {
          ...state.memoryFiles,
          [fileId]: {
            ...file,
            currentVersionIndex: versionIndex,
            lastModified: new Date()
          }
        }
      };
    }

    case ACTION_TYPES.CLEAR_FILE_HISTORY: {
      const { fileId } = action.payload;
      const file = state.memoryFiles[fileId];
      
      if (!file) {
        return state;
      }
      
      // Keep only the current version
      const currentVersion = file.versions[file.currentVersionIndex || 0];
      if (!currentVersion) {
        return state;
      }
      
      return {
        ...state,
        memoryFiles: {
          ...state.memoryFiles,
          [fileId]: {
            ...file,
            versions: [currentVersion],
            currentVersionIndex: 0
          }
        }
      };
    }

    // Database Connection Management
    case ACTION_TYPES.ADD_DB_CONNECTION: {
      const { connectionId, connectionData } = action.payload;
      const connectionMetadata = {
        id: connectionId,
        name: connectionData.name,
        serverHostname: connectionData.serverHostname,
        httpPath: connectionData.httpPath,
        type: connectionData.type || 'databricks',
        createdAt: new Date().toISOString(),
        lastUsed: null
      };
      
      // Save to localStorage (without access_token)
      const existingConnections = JSON.parse(localStorage.getItem(STORAGE_KEYS.DB_CONNECTIONS) || '[]');
      const updatedConnections = [...existingConnections, connectionMetadata];
      localStorage.setItem(STORAGE_KEYS.DB_CONNECTIONS, JSON.stringify(updatedConnections));
      
      const newState = {
        ...state,
        dbConnections: [...state.dbConnections, connectionMetadata]
      };
      
      // If no active connection is set, make this the active connection
      if (!state.activeConnectionId) {
        newState.activeConnectionId = connectionId;
        saveActiveConnectionToStorage(connectionId);
      }
      
      return newState;
    }

    case ACTION_TYPES.UPDATE_DB_CONNECTION: {
      const { connectionId, updates } = action.payload;
      
      const updatedConnections = state.dbConnections.map(conn =>
        conn.id === connectionId ? { ...conn, ...updates } : conn
      );
      
      // Update localStorage
      localStorage.setItem(STORAGE_KEYS.DB_CONNECTIONS, JSON.stringify(updatedConnections));
      
      return {
        ...state,
        dbConnections: updatedConnections
      };
    }

    case ACTION_TYPES.DELETE_DB_CONNECTION: {
      const { connectionId } = action.payload;
      
      const filteredConnections = state.dbConnections.filter(conn => conn.id !== connectionId);
      
      // Update localStorage for databricks connections
      localStorage.setItem(STORAGE_KEYS.DB_CONNECTIONS, JSON.stringify(filteredConnections));
      
      // Also clean up PySpark connections localStorage
      const pysparkConnections = JSON.parse(localStorage.getItem('pyspark_connections') || '[]');
      const filteredPysparkConnections = pysparkConnections.filter(conn => conn.id !== connectionId);
      localStorage.setItem('pyspark_connections', JSON.stringify(filteredPysparkConnections));
      
      // Clear active connection if it was deleted
      const newActiveId = state.activeConnectionId === connectionId ? null : state.activeConnectionId;
      
      // Update active connection in storage
      saveActiveConnectionToStorage(newActiveId);
      
      // Remove from connection status
      const { [connectionId]: removed, ...remainingStatus } = state.connectionStatus;
      
      return {
        ...state,
        dbConnections: filteredConnections,
        activeConnectionId: newActiveId,
        connectionStatus: remainingStatus
      };
    }

    case ACTION_TYPES.SET_ACTIVE_CONNECTION: {
      const { connectionId } = action.payload;
      
      // Update lastUsed timestamp
      const updatedConnections = state.dbConnections.map(conn =>
        conn.id === connectionId 
          ? { ...conn, lastUsed: new Date().toISOString() }
          : conn
      );
      
      // Update localStorage
      localStorage.setItem(STORAGE_KEYS.DB_CONNECTIONS, JSON.stringify(updatedConnections));
      
      // Persist active connection ID to localStorage
      saveActiveConnectionToStorage(connectionId);
      
      return {
        ...state,
        activeConnectionId: connectionId,
        dbConnections: updatedConnections
      };
    }

    case ACTION_TYPES.SET_FILE_CONNECTION: {
      const { fileName, connectionId } = action.payload;
      
      const updatedFileConnections = {
        ...state.fileConnections,
        [fileName]: connectionId
      };
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEYS.FILE_CONNECTIONS, JSON.stringify(updatedFileConnections));
      
      return {
        ...state,
        fileConnections: updatedFileConnections
      };
    }

    case ACTION_TYPES.SET_CONNECTION_STATUS: {
      const { connectionId, status } = action.payload;
      
      return {
        ...state,
        connectionStatus: {
          ...state.connectionStatus,
          [connectionId]: {
            ...state.connectionStatus[connectionId],
            ...status,
            lastChecked: new Date().toISOString()
          }
        }
      };
    }

    // SQL Execution Cases
    case ACTION_TYPES.SET_SQL_EXECUTING: {
      const { isExecuting } = action.payload;
      console.log('AppStateContext: SET_SQL_EXECUTING action received:', { isExecuting });
      const newState = {
        ...state,
        sqlExecution: {
          ...state.sqlExecution,
          isExecuting
        }
      };
      console.log('AppStateContext: New SQL execution state (executing):', newState.sqlExecution);
      return newState;
    }

    case ACTION_TYPES.SET_SQL_RESULTS: {
      const { query, results, error, resultTabId, sourceFile, isLoading, connectionType } = action.payload;
      console.log('AppStateContext: SET_SQL_RESULTS action received:', { query, results, error, resultTabId, sourceFile, isLoading, connectionType });
      
      // Create file-based tab ID if sourceFile is provided
      let tabId;
      if (sourceFile && (sourceFile.endsWith('.py') || sourceFile.endsWith('.sql'))) {
        // Use filename without extension as tab ID
        tabId = sourceFile.replace(/\.(py|sql)$/, '');
      } else {
        // Fallback to timestamp-based ID
        tabId = resultTabId || `result-${Date.now()}`;
      }
      
      // Create new tab data
      const newTab = {
        id: tabId,
        query: query,
        results: results,
        error: error,
        sourceFile: sourceFile,
        connectionType: connectionType,
        status: error || (results?.status === 'error') ? 'error' : 'success',
        timestamp: new Date().toLocaleTimeString(),
        isExecuting: false,
        isLoading: isLoading || false
      };
      
      console.log('🔥 Creating tab - error debug:', {
        hasError: !!error,
        resultsStatus: results?.status,
        resultsError: !!results?.error,
        finalStatus: error || (results?.status === 'error') ? 'error' : 'success'
      });
      
      // Update or add tab
      const existingTabs = state.sqlExecution.resultTabs || [];
      const existingTabIndex = existingTabs.findIndex(tab => tab.id === tabId);
      
      let updatedTabs;
      if (existingTabIndex >= 0) {
        // Update existing tab, preserving isExecuting state
        const existingTab = existingTabs[existingTabIndex];
        updatedTabs = [...existingTabs];
        updatedTabs[existingTabIndex] = {
          ...newTab,
          isExecuting: existingTab.isExecuting // Preserve existing executing state
        };
        console.log('AppStateContext: Updated existing tab:', tabId, 'preserving isExecuting:', existingTab.isExecuting);
      } else {
        // Add new tab
        updatedTabs = [...existingTabs, newTab];
        console.log('AppStateContext: Created new tab:', tabId);
      }
      
      const newState = {
        ...state,
        sqlExecution: {
          ...state.sqlExecution,
          lastQuery: query,
          lastResults: results,
          lastError: error,
          lastSourceFile: sourceFile,
          lastResultTabId: tabId,
          lastConnectionType: connectionType,
          isLoading: isLoading || false,
          resultTabs: updatedTabs,
          activeTabId: tabId  // Set the new/updated tab as active
        }
      };
      console.log('AppStateContext: New SQL execution state:', newState.sqlExecution);
      console.log('AppStateContext: Total tabs:', updatedTabs.length, 'Active tab:', tabId);
      return newState;
    }

    case ACTION_TYPES.SET_ACTIVE_SQL_TAB: {
      const tabId = action.payload;
      console.log('AppStateContext: Setting active SQL tab:', tabId);
      return {
        ...state,
        sqlExecution: {
          ...state.sqlExecution,
          activeTabId: tabId
        }
      };
    }

    case ACTION_TYPES.SET_SQL_TAB_EXECUTING: {
      const { tabId, isExecuting } = action.payload;
      console.log('AppStateContext: Setting tab executing state:', { tabId, isExecuting });
      
      // Create or update the tab with executing state
      const existingTabs = state.sqlExecution.resultTabs || [];
      const existingTabIndex = existingTabs.findIndex(tab => tab.id === tabId);
      
      let updatedTabs;
      if (existingTabIndex >= 0) {
        // Update existing tab
        updatedTabs = [...existingTabs];
        updatedTabs[existingTabIndex] = {
          ...updatedTabs[existingTabIndex],
          isExecuting: isExecuting,
          status: isExecuting ? 'executing' : updatedTabs[existingTabIndex].status
        };
      } else if (isExecuting) {
        // Create new tab in executing state
        const newTab = {
          id: tabId,
          query: null,
          results: null,
          error: null,
          status: 'executing',
          isExecuting: true,
          timestamp: new Date().toLocaleTimeString()
        };
        updatedTabs = [...existingTabs, newTab];
      } else {
        // No tab exists and not executing, do nothing
        updatedTabs = existingTabs;
      }
      
      return {
        ...state,
        sqlExecution: {
          ...state.sqlExecution,
          resultTabs: updatedTabs,
          activeTabId: isExecuting ? tabId : state.sqlExecution.activeTabId
        }
      };
    }

    case ACTION_TYPES.REMOVE_SQL_TAB: {
      const tabIdToRemove = action.payload;
      console.log('AppStateContext: Removing SQL tab:', tabIdToRemove);
      
      const existingTabs = state.sqlExecution.resultTabs || [];
      const updatedTabs = existingTabs.filter(tab => tab.id !== tabIdToRemove);
      
      // If we're removing the active tab, set a new active tab
      let newActiveTabId = state.sqlExecution.activeTabId;
      if (newActiveTabId === tabIdToRemove) {
        // Set the active tab to the first remaining tab, or null if no tabs left
        newActiveTabId = updatedTabs.length > 0 ? updatedTabs[0].id : null;
      }
      
      // Clear lastResults and related data if this is the last tab being removed
      const sqlExecutionUpdate = {
        ...state.sqlExecution,
        resultTabs: updatedTabs,
        activeTabId: newActiveTabId
      };
      
      // If no tabs remain, clear the fallback data
      if (updatedTabs.length === 0) {
        sqlExecutionUpdate.lastResults = null;
        sqlExecutionUpdate.lastError = null;
        sqlExecutionUpdate.lastQuery = '';
      }
      
      return {
        ...state,
        sqlExecution: sqlExecutionUpdate
      };
    }

    default:
      return state;
  }
};

// Create Context
const AppStateContext = createContext();

// Provider Component
export const AppStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);
  
  // Persist folders when they change
  useEffect(() => {
    saveFoldersToStorage(state.openFolders);
  }, [state.openFolders]);
  
  // Persist expanded folders when they change
  useEffect(() => {
    saveExpandedFoldersToStorage(state.expandedFolders);
  }, [state.expandedFolders]);
  
  // Load existing Databricks connections and auto-activate first connection if none active
  useEffect(() => {
    try {
      // Load existing Databricks connections from localStorage
      const databricksConnections = JSON.parse(localStorage.getItem('databricks_connections') || '[]');
      
      databricksConnections.forEach(connection => {
        // Check if this connection is already in app state
        const existsInState = state.dbConnections.find(c => c.id === connection.id);
        if (!existsInState) {
          console.log('🧱 Loading Databricks connection from localStorage:', connection.name);
          dispatch({ 
            type: ACTION_TYPES.ADD_DB_CONNECTION, 
            payload: { 
              connectionId: connection.id, 
              connectionData: {
                ...connection,
                type: 'databricks'
              }
            }
          });
        }
      });
      
    } catch (error) {
      console.error('🧱 Failed to load Databricks connections from localStorage:', error);
    }
  }, [state.dbConnections]); // React to changes in dbConnections
  
  // Auto-activate first connection if none is active
  useEffect(() => {
    if (!state.activeConnectionId && state.dbConnections.length > 0) {
      const firstConnection = state.dbConnections[0];
      console.log('🔗 Auto-activating first connection:', firstConnection.name);
      dispatch({ 
        type: ACTION_TYPES.SET_ACTIVE_CONNECTION, 
        payload: { connectionId: firstConnection.id }
      });
    }
  }, [state.activeConnectionId, state.dbConnections]);
  
  // Action creators
  const actions = {
    // File Actions
    setSelectedFile: (file) => dispatch({ type: ACTION_TYPES.SET_SELECTED_FILE, payload: file }),
    setAvailableFiles: (files) => dispatch({ type: ACTION_TYPES.SET_AVAILABLE_FILES, payload: files }),
    
    // Memory File Actions
    addMemoryFile: (fileId, name, content, type = 'text', isGenerated = false) => 
      dispatch({ type: ACTION_TYPES.ADD_MEMORY_FILE, payload: { fileId, name, content, type, isGenerated } }),
    addMemoryFilePlaceholder: (fileId, name, type = 'text', isGenerated = false) => 
      dispatch({ type: ACTION_TYPES.ADD_MEMORY_FILE_PLACEHOLDER, payload: { fileId, name, type, isGenerated } }),
    startMemoryFileStreaming: (fileId) => 
      dispatch({ type: ACTION_TYPES.START_MEMORY_FILE_STREAMING, payload: { fileId } }),
    endMemoryFileStreaming: (fileId, finalContent = null, description = null) => 
      dispatch({ type: ACTION_TYPES.END_MEMORY_FILE_STREAMING, payload: { fileId, finalContent, description } }),
    updateMemoryFile: (fileId, content, createVersion = true, description = 'Manual edit') => 
      dispatch({ type: ACTION_TYPES.UPDATE_MEMORY_FILE, payload: { fileId, content, createVersion, description } }),
    renameMemoryFile: (fileId, newName) => 
      dispatch({ type: ACTION_TYPES.RENAME_MEMORY_FILE, payload: { fileId, newName } }),
    removeMemoryFile: (fileId) => 
      dispatch({ type: ACTION_TYPES.REMOVE_MEMORY_FILE, payload: fileId }),
    saveMemoryFileToDisk: (fileId) => 
      dispatch({ type: ACTION_TYPES.SAVE_MEMORY_FILE_TO_DISK, payload: { fileId } }),
    clearGeneratedMemoryFiles: () => {
      // Remove all generated memory files (keep user-modified ones)
      const generatedFileIds = Object.entries(state.memoryFiles)
        .filter(([_, file]) => file.isGenerated)
        .map(([fileId, _]) => fileId);
      
      generatedFileIds.forEach(fileId => 
        dispatch({ type: ACTION_TYPES.REMOVE_MEMORY_FILE, payload: fileId })
      );
    },
    
    // Version management actions
    restoreFileVersion: (fileId, versionIndex) => 
      dispatch({ type: ACTION_TYPES.RESTORE_FILE_VERSION, payload: { fileId, versionIndex } }),
    clearFileHistory: (fileId) => 
      dispatch({ type: ACTION_TYPES.CLEAR_FILE_HISTORY, payload: { fileId } }),
    
    // Folder Actions
    setOpenFolders: (folders) => dispatch({ type: ACTION_TYPES.SET_OPEN_FOLDERS, payload: folders }),
    addFolder: (folder) => dispatch({ type: ACTION_TYPES.ADD_FOLDER, payload: folder }),
    removeFolder: (folderId) => dispatch({ type: ACTION_TYPES.REMOVE_FOLDER, payload: folderId }),
    reconnectFolder: (folderId, folder) => dispatch({ type: ACTION_TYPES.RECONNECT_FOLDER, payload: { folderId, folder } }),
    setExpandedFolders: (expandedSet) => dispatch({ type: ACTION_TYPES.SET_EXPANDED_FOLDERS, payload: Array.from(expandedSet) }),
    
    // Debug/Utility Actions
    clearFolderData: () => {
      localStorage.removeItem(STORAGE_KEYS.FOLDERS);
      localStorage.removeItem(STORAGE_KEYS.EXPANDED_FOLDERS);
      dispatch({ type: ACTION_TYPES.SET_OPEN_FOLDERS, payload: [] });
      dispatch({ type: ACTION_TYPES.SET_EXPANDED_FOLDERS, payload: [] });
    },
    
    // Tab Actions
    addTab: (tab) => dispatch({ type: ACTION_TYPES.ADD_TAB, payload: tab }),
    closeTab: (tabId) => dispatch({ type: ACTION_TYPES.CLOSE_TAB, payload: tabId }),
    setActiveTab: (tabId) => dispatch({ type: ACTION_TYPES.SET_ACTIVE_TAB, payload: tabId }),
    updateTabs: (tabs) => dispatch({ type: ACTION_TYPES.UPDATE_TABS, payload: tabs }),
    
    // Excel Actions
    setExcelData: (data) => dispatch({ type: ACTION_TYPES.SET_EXCEL_DATA, payload: data }),
    updateExcelFile: (fileId, data) => dispatch({ type: ACTION_TYPES.UPDATE_EXCEL_FILE, payload: { fileId, data } }),
    setExcelActiveSheet: (tabId, activeSheet, sheetNames) => dispatch({ 
      type: ACTION_TYPES.SET_EXCEL_ACTIVE_SHEET, 
      payload: { tabId, activeSheet, sheetNames } 
    }),
    clearExcelData: () => dispatch({ type: ACTION_TYPES.CLEAR_EXCEL_DATA }),
    
    // Chat Actions
    setChatInput: (input) => dispatch({ type: ACTION_TYPES.SET_CHAT_INPUT, payload: input }),
    addChatMessage: (message) => dispatch({ type: ACTION_TYPES.ADD_CHAT_MESSAGE, payload: message }),
    setSelectedLLM: (llm) => dispatch({ type: ACTION_TYPES.SET_SELECTED_LLM, payload: llm }),
    addAttachment: (attachment) => dispatch({ type: ACTION_TYPES.ADD_ATTACHMENT, payload: attachment }),
    removeAttachment: (attachmentId) => dispatch({ type: ACTION_TYPES.REMOVE_ATTACHMENT, payload: attachmentId }),
    
    // SQL Generation Actions
    startSqlGeneration: (generationId, sourceFile, options = {}) => dispatch({ 
      type: ACTION_TYPES.START_SQL_GENERATION, 
      payload: { generationId, sourceFile, options } 
    }),
    updateSqlStage: (stage, stageData, sqlContent) => dispatch({ 
      type: ACTION_TYPES.UPDATE_SQL_STAGE, 
      payload: { stage, stageData, sqlContent } 
    }),
    updateSqlContent: (sqlContent) => dispatch({ 
      type: ACTION_TYPES.UPDATE_SQL_CONTENT, 
      payload: sqlContent 
    }),
    completeSqlGeneration: (finalSql) => dispatch({ 
      type: ACTION_TYPES.COMPLETE_SQL_GENERATION, 
      payload: { finalSql } 
    }),
    pauseSqlGeneration: () => dispatch({ type: ACTION_TYPES.PAUSE_SQL_GENERATION }),
    askUserQuestion: (question) => dispatch({ 
      type: ACTION_TYPES.ASK_USER_QUESTION, 
      payload: { question } 
    }),
    submitUserResponse: (questionId, response) => dispatch({ 
      type: ACTION_TYPES.SUBMIT_USER_RESPONSE, 
      payload: { questionId, response } 
    }),
    resumeSqlGeneration: () => dispatch({ type: ACTION_TYPES.RESUME_SQL_GENERATION }),
    resetSqlGeneration: () => dispatch({ type: ACTION_TYPES.RESET_SQL_GENERATION }),
    
    // UI Actions
    setPanelSizes: (sizes) => dispatch({ type: ACTION_TYPES.SET_PANEL_SIZES, payload: sizes }),
    toggleTerminal: () => dispatch({ type: ACTION_TYPES.TOGGLE_TERMINAL }),
    setResizing: (isResizing) => dispatch({ type: ACTION_TYPES.SET_RESIZING, payload: isResizing }),
    
    // Database Connection Actions
    addDbConnection: (connectionId, connectionData) => dispatch({ 
      type: ACTION_TYPES.ADD_DB_CONNECTION, 
      payload: { connectionId, connectionData } 
    }),
    updateDbConnection: (connectionId, updates) => dispatch({ 
      type: ACTION_TYPES.UPDATE_DB_CONNECTION, 
      payload: { connectionId, updates } 
    }),
    deleteDbConnection: (connectionId) => dispatch({ 
      type: ACTION_TYPES.DELETE_DB_CONNECTION, 
      payload: { connectionId } 
    }),
    setActiveConnection: (connectionId) => dispatch({ 
      type: ACTION_TYPES.SET_ACTIVE_CONNECTION, 
      payload: { connectionId } 
    }),
    setFileConnection: (fileName, connectionId) => dispatch({
      type: ACTION_TYPES.SET_FILE_CONNECTION,
      payload: { fileName, connectionId }
    }),
    setConnectionStatus: (connectionId, status) => dispatch({ 
      type: ACTION_TYPES.SET_CONNECTION_STATUS, 
      payload: { connectionId, status } 
    }),
    
    // SQL Execution Actions
    executeSqlQuery: async (query, connectionId = null, sourceFile = null) => {
      const activeConn = connectionId || state.activeConnectionId;
      if (!activeConn) {
        console.warn('No active connection for SQL execution');
        return;
      }

      if (!query?.trim()) {
        console.warn('Empty SQL query');
        return;
      }

      // Create result tab identifier based on source file if provided
      const resultTabId = sourceFile ? `result-${sourceFile}` : `result-${Date.now()}`;
      
      // Create file-based tab ID for .sql files
      let tabId;
      if (sourceFile && sourceFile.endsWith('.sql')) {
        tabId = sourceFile.replace(/\.sql$/, '');
      } else {
        tabId = resultTabId;
      }
      
      // Open terminal automatically to show loading state
      if (actions?.toggleTerminal && !state?.isTerminalVisible) {
        actions.toggleTerminal();
      }
      
      // Set tab-specific executing state
      if (actions?.setSqlTabExecuting) {
        actions.setSqlTabExecuting(tabId, true);
      }
      
      // Set executing state and create/update loading tab
      dispatch({
        type: ACTION_TYPES.SET_SQL_EXECUTING,
        payload: { isExecuting: true }
      });
      
      dispatch({
        type: ACTION_TYPES.SET_SQL_RESULTS,
        payload: { 
          query: query.trim(), 
          results: null, 
          error: null, 
          resultTabId: tabId,
          sourceFile,
          isLoading: true 
        }
      });

      try {
        // Import connectionManager dynamically to avoid circular dependency
        const { connectionManager } = await import('../services/ConnectionManager');
        const result = await connectionManager.executeSQL(activeConn, query.trim(), { actions });
        
        // Update with actual results
        dispatch({
          type: ACTION_TYPES.SET_SQL_RESULTS,
          payload: { 
            query: query.trim(), 
            results: result, 
            error: null, 
            resultTabId: tabId,
            sourceFile,
            isLoading: false 
          }
        });
        
      } catch (error) {
        console.error('SQL execution error:', error);
        console.error('SQL execution error message:', error.message);
        console.error('SQL execution error stack:', error.stack);
        dispatch({
          type: ACTION_TYPES.SET_SQL_RESULTS,
          payload: { 
            query: query.trim(), 
            results: null, 
            error: error.message, 
            resultTabId: tabId,
            sourceFile,
            isLoading: false 
          }
        });
      } finally {
        // Reset tab-specific executing state
        if (actions?.setSqlTabExecuting) {
          actions.setSqlTabExecuting(tabId, false);
        }
        
        dispatch({
          type: ACTION_TYPES.SET_SQL_EXECUTING,
          payload: { isExecuting: false }
        });
      }
    },
    setSqlExecuting: (isExecuting) => dispatch({
      type: ACTION_TYPES.SET_SQL_EXECUTING,
      payload: { isExecuting }
    }),
    setSqlResults: (query, results, error, resultTabId, sourceFile, connectionType) => dispatch({
      type: ACTION_TYPES.SET_SQL_RESULTS,
      payload: { query, results, error, resultTabId, sourceFile, connectionType }
    }),
    setActiveSqlTab: (tabId) => dispatch({
      type: ACTION_TYPES.SET_ACTIVE_SQL_TAB,
      payload: tabId
    }),
    setSqlTabExecuting: (tabId, isExecuting) => dispatch({
      type: ACTION_TYPES.SET_SQL_TAB_EXECUTING,
      payload: { tabId, isExecuting }
    }),
    removeSqlTab: (tabId) => dispatch({
      type: ACTION_TYPES.REMOVE_SQL_TAB,
      payload: tabId
    }),
  };
  
  return (
    <AppStateContext.Provider value={{ state, actions, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
};

// Custom hook to use the context
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

// Export action types for external use
export { ACTION_TYPES };
