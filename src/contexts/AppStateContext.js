import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Action Types
const ACTION_TYPES = {
  // File Management
  SET_SELECTED_FILE: 'SET_SELECTED_FILE',
  SET_AVAILABLE_FILES: 'SET_AVAILABLE_FILES',
  ADD_MEMORY_FILE: 'ADD_MEMORY_FILE',
  UPDATE_MEMORY_FILE: 'UPDATE_MEMORY_FILE',
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
};

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
  
  const versions = [newVersion, ...(memoryFile.versions || [])].slice(0, 10);
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

// Initial State with persistence
const createInitialState = () => ({
  // File State
  selectedFile: null,
  availableFiles: [],
  memoryFiles: {}, // { fileId: { name: string, type: string, isGenerated: boolean, lastModified: Date, versions: Array, currentVersionIndex: number } }
  
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
      const { fileId, content, saveVersion = false } = action.payload;
      const existingFile = state.memoryFiles[fileId];
      if (!existingFile) return state;
      
      // Always save a new version (content becomes the new current version)
      const updatedFile = addVersion(existingFile, content, 'Manual edit');
      
      return {
        ...state,
        memoryFiles: {
          ...state.memoryFiles,
          [fileId]: updatedFile
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
  
  // Action creators
  const actions = {
    // File Actions
    setSelectedFile: (file) => dispatch({ type: ACTION_TYPES.SET_SELECTED_FILE, payload: file }),
    setAvailableFiles: (files) => dispatch({ type: ACTION_TYPES.SET_AVAILABLE_FILES, payload: files }),
    
    // Memory File Actions
    addMemoryFile: (fileId, name, content, type = 'text', isGenerated = false) => 
      dispatch({ type: ACTION_TYPES.ADD_MEMORY_FILE, payload: { fileId, name, content, type, isGenerated } }),
    updateMemoryFile: (fileId, content) => 
      dispatch({ type: ACTION_TYPES.UPDATE_MEMORY_FILE, payload: { fileId, content } }),
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
