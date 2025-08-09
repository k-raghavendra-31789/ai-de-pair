import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Action Types
const ACTION_TYPES = {
  // File Management
  SET_SELECTED_FILE: 'SET_SELECTED_FILE',
  SET_AVAILABLE_FILES: 'SET_AVAILABLE_FILES',
  
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
  
  // UI State
  panelSizes: {
    leftPanelWidth: 250,
    rightPanelWidth: 450, // Increased from 350 to 450 for larger ChatPanel
    bottomPanelHeight: 0,
  },
  isTerminalVisible: false,
  isResizing: false,
});

// Initial State
const initialState = createInitialState();

// Reducer
const appStateReducer = (state, action) => {
  // console.log('AppState Reducer:', action.type, action.payload);
  // console.log('Current openFolders count:', Array.isArray(state.openFolders) ? state.openFolders.length : 'not array');
  
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
    
    // Folder Management
    case ACTION_TYPES.SET_OPEN_FOLDERS:
      return {
        ...state,
        openFolders: Array.isArray(action.payload) ? action.payload : [],
      };
      
    case ACTION_TYPES.ADD_FOLDER:
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
      
    case ACTION_TYPES.REMOVE_FOLDER:
      // Ensure openFolders is an array
      const foldersToFilter = Array.isArray(state.openFolders) ? state.openFolders : [];
      return {
        ...state,
        openFolders: foldersToFilter.filter(folder => folder.id !== action.payload),
      };
      
    case ACTION_TYPES.RECONNECT_FOLDER:
      // Ensure openFolders is an array
      const foldersToReconnect = Array.isArray(state.openFolders) ? state.openFolders : [];
      return {
        ...state,
        openFolders: foldersToReconnect.map(folder => 
          folder.id === action.payload.folderId ? action.payload.folder : folder
        ),
      };
      
    case ACTION_TYPES.SET_EXPANDED_FOLDERS:
      return {
        ...state,
        expandedFolders: new Set(action.payload),
      };
    
    // Tab Management
    case ACTION_TYPES.ADD_TAB:
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
      
    case ACTION_TYPES.CLOSE_TAB:
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
      
    case ACTION_TYPES.UPDATE_EXCEL_FILE:
      const { fileId, data } = action.payload;
      return {
        ...state,
        excelFiles: {
          ...state.excelFiles,
          [fileId]: data,
        },
      };
      
    case ACTION_TYPES.SET_EXCEL_ACTIVE_SHEET:
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
      
    case ACTION_TYPES.TOGGLE_TERMINAL:
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
      
    case ACTION_TYPES.SET_RESIZING:
      return {
        ...state,
        isResizing: action.payload,
      };
    
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
