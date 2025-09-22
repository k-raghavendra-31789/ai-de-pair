import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo, memo } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import CustomScrollbar from './CustomScrollbar';
import MonacoEditor from './MonacoEditor';
import ExcelViewer from './ExcelViewer';
import VersionHistory from './VersionHistory';
import ConnectionConfigModal from './ConnectionConfigModal';
import aiErrorCorrectionService from '../services/AIErrorCorrectionService';
import { FaDownload, FaCodeBranch, FaPlay, FaGitAlt, FaCog, FaInfoCircle, FaLightbulb, FaTimes, FaCheck, FaDatabase, FaPlug, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { BiGitPullRequest, BiGitBranch } from 'react-icons/bi';
import { VscGithub, VscGitPullRequest } from 'react-icons/vsc';
import { connectionManager } from '../services/ConnectionManager';

const MainEditor = forwardRef(({ selectedFile, onFileOpen, isTerminalVisible, getAllAvailableFiles }, ref) => {
  const { theme, toggleTheme, colors } = useTheme();
  const { state, actions } = useAppState();
  
  // Get tab and Excel data from context
  const { 
    openTabs = [], 
    excelFiles = {}, 
    sqlGeneration = {}, 
    memoryFiles = {}, 
    activeConnectionId, 
    dbConnections = [],
    sqlExecution = {} 
  } = state || {};
  const { 
    updateTabs = () => {}, 
    setExcelData = () => {}, 
    updateExcelFile = () => {}, 
    setExcelActiveSheet = () => {}, 
    addTab = () => {}, 
    setActiveTab: setActiveTabInContext = () => {},
    addMemoryFile = () => {},
    updateMemoryFile = () => {},
    renameMemoryFile = () => {},
    executeSqlQuery: executeFromAppState = () => {},
    saveMemoryFileToDisk = () => {},
    removeMemoryFile = () => {},
    restoreFileVersion = () => {},
    clearFileHistory = () => {},
    setSqlExecuting = () => {},
    setSqlResults = () => {},
    resetSqlGeneration = () => {}
  } = actions || {};
  
  // Helper function to safely access openTabs
  const safeOpenTabs = useMemo(() => {
    return Array.isArray(openTabs) ? openTabs : [];
  }, [openTabs]);
  
  // CSS to hide textarea scrollbars
  // CSS to hide textarea scrollbars
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .hidden-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hidden-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // State to store content for each open file
  const [fileContents, setFileContents] = useState({});
  
  // State to track deleted files (tabs that should show as deleted)
  const [deletedFiles, setDeletedFiles] = useState(new Set());
  
  // State for word wrap toggle
  const [wordWrap, setWordWrap] = useState(false);
  
  // Version history state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Git commit state
  const [showGitCommitDialog, setShowGitCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  
  // GitHub PR state
  const [createPR, setCreatePR] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prDescription, setPrDescription] = useState('');
  const [branchName, setBranchName] = useState('');
  const [githubToken, setGithubToken] = useState(localStorage.getItem('github_token') || '');
  const [repoUrl, setRepoUrl] = useState('');
  const [availableBranches, setAvailableBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  const [dragOver, setDragOver] = useState(false);
  const dragTimeoutRef = useRef(null);
  const dragCounterRef = useRef(0);
  const saveTimeoutRef = useRef({});

  // Database connection state
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Tab context menu and renaming state
  const [showTabContextMenu, setShowTabContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTab, setContextMenuTab] = useState(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingTab, setRenamingTab] = useState(null);
  const [newTabName, setNewTabName] = useState('');

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Toast notification function
  const showToast = useCallback((message, type = 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // Auto-hide after 3 seconds
  }, []);

  // Helper function to get current content from memory file
  const getCurrentMemoryFileContent = useCallback((fileId) => {
    const memoryFile = memoryFiles[fileId];
    if (!memoryFile || !memoryFile.versions || memoryFile.versions.length === 0) {
      return '';
    }
    const currentIndex = memoryFile.currentVersionIndex;
    if (currentIndex < 0) return ''; // No versions yet
    return memoryFile.versions[currentIndex]?.content || '';
  }, [memoryFiles]);

  // Sync memory file content with editor when versions are restored
  useEffect(() => {
    // Update file contents when memory files change (e.g., version restored)
    Object.entries(memoryFiles).forEach(([fileId, fileData]) => {
      setFileContents(prev => {
        const currentContent = prev[fileId];
        const memoryFileContent = getCurrentMemoryFileContent(fileId);
        if (currentContent !== memoryFileContent) {
          return {
            ...prev,
            [fileId]: memoryFileContent
          };
        }
        return prev;
      });
    });
  }, [memoryFiles, getCurrentMemoryFileContent]);

  // Get the active tab (moved here to avoid initialization order issues)
  const activeTab = safeOpenTabs.find(tab => tab.isActive);

  // Helper function to check if file is Excel
  const isExcelFile = useCallback((fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension);
  }, []);

  // Helper function to check if file is Jupyter Notebook
  const isJupyterNotebook = useCallback((fileName) => {
    return fileName.endsWith('.ipynb');
  }, []);

  // Helper function to check if file is Databricks Archive
  const isDatabricksArchive = useCallback((fileName) => {
    return fileName.endsWith('.dbc');
  }, []);

  // Helper function to check if file is Scala
  const isScalaFile = useCallback((fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension === 'scala' || extension === 'sc';
  }, []);

  // Helper function to format Jupyter notebook for display
  const formatJupyterNotebook = useCallback((content) => {
    try {
      const notebook = JSON.parse(content);
      if (notebook.cells && Array.isArray(notebook.cells)) {
        let formattedContent = `# Jupyter Notebook: ${notebook.metadata?.kernelspec?.display_name || 'Unknown Kernel'}\n\n`;
        
        notebook.cells.forEach((cell, index) => {
          formattedContent += `## Cell ${index + 1} [${cell.cell_type}]\n\n`;
          
          if (cell.cell_type === 'markdown') {
            formattedContent += cell.source.join('') + '\n\n';
          } else if (cell.cell_type === 'code') {
            formattedContent += '```' + (notebook.metadata?.kernelspec?.language || 'python') + '\n';
            formattedContent += cell.source.join('') + '\n';
            formattedContent += '```\n\n';
            
            // Add outputs if available
            if (cell.outputs && cell.outputs.length > 0) {
              formattedContent += '**Output:**\n```\n';
              cell.outputs.forEach(output => {
                if (output.text) {
                  formattedContent += output.text.join('');
                } else if (output.data && output.data['text/plain']) {
                  formattedContent += output.data['text/plain'].join('');
                }
              });
              formattedContent += '\n```\n\n';
            }
          }
        });
        
        return formattedContent;
      }
    } catch (error) {
      console.warn('Failed to parse Jupyter notebook:', error);
    }
    return content; // Return original if parsing fails
  }, []);

  // Helper function to detect and format Databricks archive content
  const formatDatabricksArchive = useCallback((content) => {
    try {
      // Try to parse as JSON first (many .dbc files contain JSON)
      const parsed = JSON.parse(content);
      if (parsed.commands || parsed.notebooks) {
        let formattedContent = `# Databricks Archive\n\n`;
        
        if (parsed.commands) {
          formattedContent += `## Commands (${parsed.commands.length})\n\n`;
          parsed.commands.forEach((cmd, index) => {
            formattedContent += `### Command ${index + 1}\n`;
            formattedContent += '```sql\n' + cmd.command + '\n```\n\n';
          });
        }
        
        if (parsed.notebooks) {
          formattedContent += `## Notebooks (${parsed.notebooks.length})\n\n`;
          parsed.notebooks.forEach((notebook, index) => {
            formattedContent += `### ${notebook.name || `Notebook ${index + 1}`}\n`;
            formattedContent += `Language: ${notebook.language || 'Unknown'}\n\n`;
          });
        }
        
        return formattedContent;
      }
    } catch (error) {
      // If it's not JSON, treat as binary/text
      return `# Databricks Archive\n\n*This appears to be a binary Databricks archive file (.dbc)*\n\nTo work with this file, you may need to:\n1. Import it into a Databricks workspace\n2. Extract it using Databricks CLI\n3. Use specialized tools to view its contents\n\n**File size:** ${content.length} bytes\n**Preview (first 500 chars):**\n\`\`\`\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}\n\`\`\``;
    }
    return content;
  }, []);

  // Handle file rename by updating open tabs
  const handleFileRenamed = useCallback((oldName, newName, newHandle) => {
    const updatedTabs = safeOpenTabs.map(tab => {
      // Check if this tab corresponds to the renamed file
      if (tab.name === oldName) {
        return {
          ...tab,
          name: newName,
          handle: newHandle
        };
      }
      return tab;
    });
    updateTabs(updatedTabs);

    // Update Excel files data if it's an Excel file
    if (isExcelFile(oldName)) {
      const newFiles = { ...excelFiles };
      Object.keys(newFiles).forEach(tabId => {
        if (newFiles[tabId] && newFiles[tabId].name === oldName) {
          newFiles[tabId] = {
            ...newFiles[tabId],
            name: newName,
            handle: newHandle
          };
        }
      });
      setExcelData(newFiles);
    }

    // Update file contents mapping
    setFileContents(prevContents => {
      const newContents = { ...prevContents };
      Object.keys(newContents).forEach(tabId => {
        // Find the tab with the old name and update the content key if needed
        const tab = safeOpenTabs.find(t => t.id === tabId && t.name === oldName);
        if (tab) {
          // The content stays the same, just the file name reference changes
          // No action needed here as the content is keyed by tabId, not filename
        }
      });
      return newContents;
    });

    // Update file handles registry if used
    if (window.fileHandleRegistry) {
      // Remove old entry and add new one
      for (const [key, value] of window.fileHandleRegistry.entries()) {
        if (value === oldName || key.includes(oldName)) {
          window.fileHandleRegistry.delete(key);
          // Add new entry with updated name
          const newKey = key.replace(oldName, newName);
          window.fileHandleRegistry.set(newKey, newName);
        }
      }
    }
  }, [safeOpenTabs, excelFiles, updateTabs, setExcelData, isExcelFile]);

  // Check if current tab is a GitHub file
  const isGitHubFile = (tabId) => {
    return tabId && tabId.startsWith('github-');
  };

  // Download GitHub file function
  const downloadGitHubFile = async (tabId, fileName) => {
    try {
      const content = fileContents[tabId] || '';
      
      // Extract just the filename without GitHub path prefixes
      const cleanFileName = fileName.includes('/') ? fileName.split('/').pop() : fileName;
      
      // Determine file type from extension
      const extension = cleanFileName.split('.').pop()?.toLowerCase();
      let mimeType = 'text/plain';
      
      // Set appropriate MIME type based on file extension
      switch (extension) {
        case 'js':
        case 'jsx':
          mimeType = 'text/javascript';
          break;
        case 'ts':
        case 'tsx':
          mimeType = 'text/typescript';
          break;
        case 'json':
          mimeType = 'application/json';
          break;
        case 'html':
          mimeType = 'text/html';
          break;
        case 'css':
          mimeType = 'text/css';
          break;
        case 'md':
          mimeType = 'text/markdown';
          break;
        case 'xml':
          mimeType = 'application/xml';
          break;
        case 'sql':
          mimeType = 'application/sql';
          break;
        case 'py':
          mimeType = 'text/x-python';
          break;
        default:
          mimeType = 'text/plain';
      }
      
      // Create a blob from the content
      const blob = new Blob([content], { type: mimeType });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = cleanFileName;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      // Show success message
      
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  // Handle file deletion by marking tabs as deleted
  const handleFileDeleted = useCallback((fileName) => {
    
    setDeletedFiles(prevDeleted => {
      const newDeleted = new Set(prevDeleted);
      newDeleted.add(fileName);
      return newDeleted;
    });
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleFileRenamed: handleFileRenamed,
    handleFileDeleted: handleFileDeleted,
    getOpenTabs: () => openTabs,
    getExcelFiles: () => excelFiles
  }));

  // Function to save memory file to disk
  const saveMemoryToDisk = useCallback(async (fileName) => {
    const currentTab = safeOpenTabs.find(tab => tab.name === fileName);
    if (!currentTab || currentTab.type !== 'memory') return;

    const memoryFile = memoryFiles[currentTab.fileId];
    if (!memoryFile) return;

    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: `${memoryFile.type.toUpperCase()} files`,
          accept: { [`text/${memoryFile.type}`]: [`.${memoryFile.type}`] }
        }]
      });

      const writable = await fileHandle.createWritable();
      await writable.write(getCurrentMemoryFileContent(currentTab.fileId));
      await writable.close();

      // Mark as saved to disk
      saveMemoryFileToDisk(currentTab.fileId);
      
      // Update tab to show it's no longer just in memory
      const updatedTabs = safeOpenTabs.map(tab => 
        tab.name === fileName ? { 
          ...tab, 
          type: 'file',
          isSavedToDisk: true 
        } : tab
      );
      updateTabs(updatedTabs);

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error saving memory file to disk:', error);
      }
    }
  }, [safeOpenTabs, memoryFiles, saveMemoryFileToDisk, updateTabs, getCurrentMemoryFileContent]);

  // Tab context menu handlers
  const handleTabContextMenu = (e, tab) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuTab(tab);
    setShowTabContextMenu(true);
  };

  const closeContextMenu = () => {
    setShowTabContextMenu(false);
    setContextMenuTab(null);
  };

  const handleTabRename = () => {
    if (!contextMenuTab) return;
    setRenamingTab(contextMenuTab);
    setNewTabName(contextMenuTab.name);
    setShowRenameDialog(true);
    closeContextMenu();
  };

  const confirmTabRename = async () => {
    if (!renamingTab || !newTabName.trim() || newTabName.trim() === renamingTab.name) {
      setShowRenameDialog(false);
      setRenamingTab(null);
      setNewTabName('');
      return;
    }

    const trimmedName = newTabName.trim();
    
    try {
      if (renamingTab.type === 'memory') {
        // For memory files, only update in memory - no file system operations needed
        const memoryFile = memoryFiles[renamingTab.fileId];
        if (memoryFile) {
          // Update memory file name using the context action
          renameMemoryFile(renamingTab.fileId, trimmedName);
          
          // Update tab name
          const updatedTabs = safeOpenTabs.map(tab => 
            tab.id === renamingTab.id ? { ...tab, name: trimmedName } : tab
          );
          updateTabs(updatedTabs);
        }
      } else {
        // For regular files, just update the tab name (actual file renaming should be handled in FileExplorer)
        const updatedTabs = safeOpenTabs.map(tab => 
          tab.id === renamingTab.id ? { ...tab, name: trimmedName } : tab
        );
        updateTabs(updatedTabs);
      }

      setShowRenameDialog(false);
      setRenamingTab(null);
      setNewTabName('');
    } catch (error) {
      console.error('Error renaming tab:', error);
      alert('Error renaming file. Please try again.');
    }
  };

  const cancelTabRename = () => {
    setShowRenameDialog(false);
    setRenamingTab(null);
    setNewTabName('');
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showTabContextMenu) {
        closeContextMenu();
      }
    };

    if (showTabContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showTabContextMenu]);

  const saveFileContent = useCallback(async (fileName, content) => {
    try {
      console.log('💾 saveFileContent called:', {
        fileName,
        contentLength: content?.length,
        contentPreview: content?.substring(0, 100)
      });
      
      // Don't save deleted files
      if (deletedFiles.has(fileName)) {
        console.log('❌ File is deleted, skipping save:', fileName);
        return;
      }

      // Check tab type
      const currentTab = safeOpenTabs.find(tab => tab.name === fileName);
      const isMemoryFile = currentTab?.type === 'memory';
      
      console.log('📋 Tab info:', {
        tabFound: !!currentTab,
        tabType: currentTab?.type,
        fileId: currentTab?.fileId,
        isMemoryFile
      });

      if (isMemoryFile) {
        console.log('💾 Saving memory file:', currentTab.fileId, 'with content length:', content?.length);
        // For memory files, update the memory content (create version for manual save)
        updateMemoryFile(currentTab.fileId, content, true, '💾 Manual save (Ctrl+S)');
        console.log('✅ Memory file updated');
        
        // Mark tab as clean
        const updatedTabs = safeOpenTabs.map(tab => 
          tab.name === fileName ? { ...tab, isDirty: false } : tab
        );
        updateTabs(updatedTabs);
        console.log('✅ Tab marked as clean');
        return;
      }

      // Find the active tab to get the fileId for regular files
      if (!currentTab || !currentTab.fileId) {
        return;
      }

      // Get the file handle from our registry using the fileId
      let fileHandle = window.fileHandleRegistry?.get(currentTab.fileId);
      if (!fileHandle) {
        return;
      }

      // Check if we have permission to write to the file
      const permission = await fileHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        // Request permission again
        const newPermission = await fileHandle.requestPermission({ mode: 'readwrite' });
        if (newPermission !== 'granted') {
          return;
        }
      }

      // Create a writable stream
      const writable = await fileHandle.createWritable();
      
      // Write the content
      await writable.write(content);
      
      // Close the file
      await writable.close();

      // Mark file as clean (not dirty)
      const cleanTabs = safeOpenTabs.map(tab => ({
        ...tab,
        isDirty: tab.name === fileName ? false : tab.isDirty
      }));
      updateTabs(cleanTabs);

    } catch (error) {
      // If it's a stale handle error, try to get a fresh handle
      if (error.name === 'InvalidStateError' || error.name === 'NotAllowedError') {
        try {
          // Request a new file handle
          const [newFileHandle] = await window.showOpenFilePicker({
            multiple: false,
            types: [{
              description: 'Files',
              accept: { '*/*': [] }
            }]
          });
          
          // Update the registry with the new handle
          const currentTab = safeOpenTabs.find(tab => tab.name === fileName);
          if (currentTab && currentTab.fileId) {
            window.fileHandleRegistry.set(currentTab.fileId, newFileHandle);
            
            // Try saving again with the new handle
            const writable = await newFileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            
            // Mark file as clean
            const cleanTabs = safeOpenTabs.map(tab => ({
              ...tab,
              isDirty: tab.name === fileName ? false : tab.isDirty
            }));
            updateTabs(cleanTabs);
          }
        } catch (retryError) {
          alert(`Failed to save ${fileName}. Please try dragging the file again to refresh the connection.`);
        }
      }
    }
  }, [safeOpenTabs, deletedFiles, updateMemoryFile, updateTabs]);

  // SQL Execution Function - Use centralized AppState action
  const executeSqlQuery = useCallback(async (query, selectedText = null) => {
    console.log('🚀 MainEditor executeSqlQuery called:', {
      query: query?.substring(0, 100) + '...',
      selectedText: selectedText?.substring(0, 100),
      activeConnectionId,
      fileConnection: activeTab?.name ? state.fileConnections?.[activeTab.name] : null,
      activeTabName: activeTab?.name,
      queryLength: query?.length
    });

    // Get file-specific connection or fall back to global
    const fileConnectionId = activeTab?.name ? state.fileConnections?.[activeTab.name] : null;
    const connectionId = fileConnectionId || activeConnectionId;

    if (!connectionId) {
      console.warn('No active connection selected');
      alert('No database connection selected. Please configure a connection first.');
      return;
    }

    const sqlToExecute = selectedText || query;
    if (!sqlToExecute?.trim()) {
      console.warn('No SQL content to execute');
      alert('No SQL content to execute. Please write some SQL first.');
      return;
    }

    // Get the current file name as source identifier
    const sourceFile = activeTab?.name || null;
    console.log('MainEditor: Executing SQL for source file:', sourceFile, 'using connection:', connectionId);
    console.log('SQL to execute:', sqlToExecute);

    // Use centralized SQL execution from AppState with source file info
    try {
      await executeFromAppState(sqlToExecute, connectionId, sourceFile);
      console.log('✅ SQL execution completed');
    } catch (error) {
      console.error('❌ SQL execution failed:', error);
      // Error is already displayed in TerminalPanel, no need for alert
    }
  }, [activeTab?.name, state.fileConnections, activeConnectionId, executeFromAppState]);

  // Get active connection details
  const getActiveConnection = useCallback(() => {
    // Get file-specific connection first, then fall back to global
    const fileConnectionId = activeTab?.name ? state.fileConnections?.[activeTab.name] : null;
    const connectionId = fileConnectionId || activeConnectionId;
    
    // First check if it's a PySpark connection in sessionStorage (always check this first)
    if (connectionId?.startsWith('pyspark_')) {
      try {
        const pysparkConnections = JSON.parse(sessionStorage.getItem('pyspark_connections') || '[]');
        const pysparkConnection = pysparkConnections.find(conn => conn.id === connectionId);
        if (pysparkConnection) {
          // Migrate connection if it doesn't have type field
          if (!pysparkConnection.type) {
            pysparkConnection.type = 'pyspark';
            console.log('🔧 Migrated PySpark connection to include type field:', pysparkConnection);
            
            // Update sessionStorage with migrated connection
            const updatedConnections = pysparkConnections.map(conn => 
              conn.id === pysparkConnection.id ? pysparkConnection : conn
            );
            sessionStorage.setItem('pyspark_connections', JSON.stringify(updatedConnections));
          }
          
          // Ensure serverUrl is set
          if (!pysparkConnection.serverUrl) {
            pysparkConnection.serverUrl = 'http://localhost:8000';
            console.log('🔧 Added default serverUrl to PySpark connection');
            
            // Update sessionStorage with serverUrl
            const updatedConnections = pysparkConnections.map(conn => 
              conn.id === pysparkConnection.id ? pysparkConnection : conn
            );
            sessionStorage.setItem('pyspark_connections', JSON.stringify(updatedConnections));
          }
          
          return pysparkConnection;
        }
      } catch (error) {
        console.warn('Failed to load PySpark connections from sessionStorage:', error);
      }
    }

    // Fallback to regular database connections
    if (!connectionId || !dbConnections.length) {
      return null;
    }
    return dbConnections.find(conn => conn.id === connectionId);
  }, [activeTab?.name, state.fileConnections, activeConnectionId, dbConnections]);

  // PySpark Execution Function
  const executePySparkCode = useCallback(async (code, selectedText = null) => {
    console.log('🐍 MainEditor executePySparkCode called:', {
      code: code?.substring(0, 100) + '...',
      selectedText: selectedText?.substring(0, 100),
      activeConnectionId,
      fileConnection: activeTab?.name ? state.fileConnections?.[activeTab.name] : null,
      activeTabName: activeTab?.name,
      codeLength: code?.length
    });

    const activeConnection = getActiveConnection();
    if (!activeConnection || activeConnection.type !== 'pyspark') {
      console.warn('No PySpark connection selected');
      alert('No PySpark connection selected. Please configure a PySpark connection first.');
      return;
    }

    const codeToExecute = selectedText || code;
    if (!codeToExecute?.trim()) {
      console.warn('No PySpark code to execute');
      alert('No PySpark code to execute. Please write some PySpark code first.');
      return;
    }

    // Get the current file name as source identifier
    const sourceFile = activeTab?.name || null;
    console.log('MainEditor: Executing PySpark code for source file:', sourceFile);
    console.log('Code to execute:', codeToExecute);

    // Create file-based tab ID
    let tabId;
    if (sourceFile && (sourceFile.endsWith('.py') || sourceFile.endsWith('.sql'))) {
      tabId = sourceFile.replace(/\.(py|sql)$/, '');
    } else {
      tabId = `result-${Date.now()}`;
    }

    // Set execution state
    setSqlExecuting(true);
    
    // Set tab-specific executing state and create/activate the tab
    if (actions?.setSqlTabExecuting) {
      actions.setSqlTabExecuting(tabId, true);
    }
    
    // Open terminal automatically to show loading state
    if (actions?.toggleTerminal && !state?.isTerminalVisible) {
      actions.toggleTerminal();
    }

    try {
      // Prepare request payload
      const payload = {
        code: codeToExecute,
        session_id: `session_${Date.now()}`, // Generate session ID
        user_config: {}, // Optional Spark config
        include_stats: true,
        result_limit: 1000 // Increased limit
      };

      console.log('🐍 Sending PySpark execution request:', payload);

      // Execute PySpark code
      const response = await fetch(`${activeConnection.serverUrl}/api/v1/pyspark/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      // Log raw response details
      console.log('🔍 BACKEND RESPONSE DETAILS:');
      console.log('📡 Response Status:', response.status);
      console.log('📡 Response StatusText:', response.statusText);
      console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));
      console.log('📡 Response OK:', response.ok);
      console.log('📡 Response URL:', response.url);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ RAW ERROR RESPONSE TEXT:', errorText);
        throw new Error(`PySpark server responded with status: ${response.status}. Error: ${errorText}`);
      }

      // Get raw response text first for logging
      const responseText = await response.text();
      console.log('📄 RAW RESPONSE TEXT FROM BACKEND:');
      console.log(responseText);
      
      // Parse the JSON
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('✅ PARSED JSON RESPONSE:');
        console.log(result);
        console.log('🔍 Response Type:', typeof result);
        console.log('🔍 Response Keys:', Object.keys(result || {}));
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        console.log('📄 Response that failed to parse:', responseText);
        throw new Error(`Invalid JSON response from PySpark server: ${parseError.message}`);
      }

      console.log('🐍 FINAL PySpark execution result object:', result);

      console.log('🐍 FINAL PySpark execution result object:', result);

      // Check response status and log details
      console.log('🔍 RESPONSE STATUS CHECK:');
      console.log('📊 result.status:', result.status);
      console.log('📊 Status type:', typeof result.status);
      console.log('📊 Is status "error"?:', result.status === 'error');

      if (result.status === 'error') {
        // Handle error objects properly
        console.log('❌ ERROR RESPONSE DETECTED');
        console.log('❌ result.error:', result.error);
        console.log('❌ Error type:', typeof result.error);
        
        let errorMessage = 'PySpark execution failed';
        if (result.error) {
          if (typeof result.error === 'string') {
            errorMessage = result.error;
            console.log('❌ Using string error message:', errorMessage);
          } else if (result.error.message) {
            // Handle structured error with type and message
            const errorType = result.error.type ? `${result.error.type}: ` : '';
            errorMessage = `${errorType}${result.error.message}`;
            
            // Add traceback if available (truncated for readability)
            if (result.error.traceback) {
              const traceback = result.error.traceback.length > 500 
                ? result.error.traceback.substring(0, 500) + '...\n[Traceback truncated]'
                : result.error.traceback;
              errorMessage += `\n\nTraceback:\n${traceback}`;
            }
            console.log('❌ Using structured error with traceback:', errorMessage);
          } else {
            try {
              errorMessage = JSON.stringify(result.error, null, 2);
              console.log('❌ Using JSON stringified error:', errorMessage);
            } catch (e) {
              errorMessage = `PySpark execution failed. Error: ${result.error.toString()}`;
              console.log('❌ Using toString error:', errorMessage);
            }
          }
        }
        
        // Add execution time and metadata to error if available
        if (result.execution_time) {
          errorMessage = `Execution failed after ${result.execution_time}\n\n${errorMessage}`;
        }
        
        throw new Error(errorMessage);
      }

      // Log successful response processing
      console.log('✅ SUCCESS RESPONSE DETECTED');
      console.log('📊 result.outputs:', result.outputs);
      console.log('📊 result.metadata:', result.metadata);
      console.log('📊 result.execution_time:', result.execution_time);
      console.log('📊 Number of outputs:', result.outputs ? result.outputs.length : 0);
      console.log('📊 Full result object structure:', {
        hasOutputs: !!result.outputs,
        hasMetadata: !!result.metadata,
        executionTime: result.execution_time,
        outputCount: result.outputs ? result.outputs.length : 0,
        outputTypes: result.outputs ? result.outputs.map(output => output.type) : 'no outputs'
      });

      // Set results using the existing SQL results mechanism
      // This will create a results tab in TerminalPanel
      console.log('📤 SENDING TO setSqlResults:');
      console.log('📤 Code:', codeToExecute);
      console.log('📤 Result object:', result);
      console.log('📤 Source file:', sourceFile);
      console.log('📤 Connection type: pyspark');

      setSqlResults(
        codeToExecute,    // query
        result,           // results (the full PySpark response)
        null,             // error (null since it was successful)
        null,             // resultTabId (let it auto-generate)
        sourceFile,       // sourceFile
        'pyspark'         // connectionType
      );

      console.log('✅ PySpark execution completed');
    } catch (error) {
      console.error('❌ PySpark execution failed - Full error object:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error constructor:', error.constructor?.name);
      
      // Comprehensive error message handling
      let errorMessage = 'Unknown error occurred';
      
      try {
        // Try multiple ways to extract a meaningful error message
        if (error?.message) {
          errorMessage = error.message;
        } else if (error?.error) {
          errorMessage = error.error;
        } else if (error?.detail) {
          errorMessage = error.detail;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error?.toString && typeof error.toString === 'function') {
          const stringified = error.toString();
          if (stringified !== '[object Object]') {
            errorMessage = stringified;
          }
        }
        
        // If we still have [object Object], try JSON.stringify
        if (errorMessage === '[object Object]' || errorMessage === 'Unknown error occurred') {
          try {
            const jsonError = JSON.stringify(error, null, 2);
            if (jsonError && jsonError !== '{}') {
              errorMessage = `Error details:\n${jsonError}`;
            }
          } catch (jsonErr) {
            console.error('Failed to stringify error:', jsonErr);
          }
        }
        
        // Check for specific error types
        if (error.name === 'TypeError' && error.message?.includes('fetch')) {
          errorMessage = `Unable to connect to PySpark server at ${activeConnection.serverUrl}. Please ensure the PySpark server is running.`;
        } else if (error.name === 'SyntaxError') {
          errorMessage = `Invalid response from PySpark server. Response might not be valid JSON.`;
        }
        
      } catch (processingError) {
        console.error('Error while processing error message:', processingError);
        errorMessage = `Error processing failed. Original error type: ${typeof error}`;
      }
      
      console.error('❌ Final formatted error message:', errorMessage);
      
      // Set error results to show in the terminal panel
      setSqlResults(
        codeToExecute,    // query
        null,             // results (null since it failed)
        errorMessage,     // error message
        null,             // resultTabId (let it auto-generate)
        sourceFile,       // sourceFile
        'pyspark'         // connectionType
      );
      
      // Error is already displayed in TerminalPanel, no need for alert
    } finally {
      setSqlExecuting(false);
      // Clear tab-specific executing state
      if (actions?.setSqlTabExecuting) {
        actions.setSqlTabExecuting(tabId, false);
      }
    }
  }, [activeTab?.name, state.fileConnections, activeConnectionId, getActiveConnection, setSqlExecuting, setSqlResults, actions, state?.isTerminalVisible]);

  // Handle code correction with AI
  const handleCodeCorrection = useCallback(async (selectedCode, context, userInstructions = '', selectedMentions = []) => {
    console.log('🤖 Code transformation requested:', {
      selectedCode: selectedCode.substring(0, 100) + '...',
      fileName: context.fileName,
      language: context.language,
      lineRange: `${context.startLine}-${context.endLine}`,
      userInstructions: userInstructions || 'No specific instructions',
      selectedMentions: selectedMentions.length > 0 ? selectedMentions.map(m => ({ type: m.type, name: m.name })) : 'None'
    });

    // Check if we have error correction context available
    const hasErrorContext = aiErrorCorrectionService.isErrorCorrectionActive();
    
    if (hasErrorContext) {
      console.log('🎯 Using AI Error Correction Service for error-based correction');
      
      try {
        // Use the error correction service
        const correctionCallback = aiErrorCorrectionService.createCorrectionCallback(context.language);
        const correctedCode = await correctionCallback(selectedCode, context, userInstructions, selectedMentions);
        
        console.log('✅ Error correction completed via AIErrorCorrectionService');
        return correctedCode;
        
      } catch (error) {
        console.error('❌ Error correction failed:', error);
        throw error;
      }
    }

    // Fallback to existing transformation API for non-error corrections
    console.log('🔄 Using existing transformation API');

    // Prepare the transformation request (generalized from correction)
    const transformRequest = {
      code: selectedCode,
      fileName: context.fileName,
      language: context.language,
      startLine: context.startLine,
      endLine: context.endLine,
      startColumn: context.startColumn,
      endColumn: context.endColumn,
      userInstructions: userInstructions || 'Improve this code',
      selectedMentions: selectedMentions || [], // Rich @mentions data with full content
      timestamp: new Date().toISOString(),
      sessionId: `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    console.log('🔧 Transform request prepared:', transformRequest);

    try {

      console.log('🚀 Sending transformation request to API:', {
        endpoint: 'http://localhost:8000/api/v1/data/transform-code',
        request: transformRequest
      });

      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 60000); // 60 second timeout (increased from 30s)

      try {
        // Call the AI transformation API with timeout
        const response = await fetch('http://localhost:8000/api/v1/data/transform-code', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transformRequest),
          signal: controller.signal // Add abort signal for timeout
        });

        clearTimeout(timeoutId); // Clear timeout if request completes

        clearTimeout(timeoutId); // Clear timeout if request completes

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Handle unified format or legacy format
          const errorMessage = errorData.message || 
                              errorData.error?.details || 
                              errorData.error || 
                              'Failed to transform code';
          
          throw new Error(`API Error ${response.status}: ${errorMessage}`);
        }

        const result = await response.json();
        console.log('✅ API Response received:', result);
        
        // Handle unified format
        if (result.success === true && result.data?.transformedCode) {
          console.log('✅ Unified format success response');
          return result.data.transformedCode;
        }
        
        // Handle unified format error
        if (result.success === false) {
          const errorMessage = result.message || 
                              result.error?.details || 
                              'Code transformation failed';
          throw new Error(errorMessage);
        }
        
        // Fallback to legacy formats for backward compatibility
        return result.transformedCode || result.correctedCode || result.data?.transformedCode || result.data?.correctedCode || result;
      } finally {
        clearTimeout(timeoutId); // Ensure timeout is always cleared
      }
    } catch (error) {
      // Handle timeout errors specifically
      if (error.name === 'AbortError') {
        console.error('⏰ Request timeout: AI service took too long to respond');
        throw new Error('Request timeout: The AI service is taking longer than expected. Please try with a smaller code selection or try again later.');
      }
      
      // Handle network/connection errors with fallback to simulation
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED') || error.message.includes('ECONNREFUSED')) {
        console.warn('🔧 AI service unavailable, falling back to simulation mode');
        console.log('💡 Tip: Start the AI service on http://localhost:8000 for full functionality');
        
        // Fallback to simulation for development/testing
        try {
          const simulatedResult = await simulateAITransformation(transformRequest);
          console.log('🎭 Using simulated AI transformation');
          
          // Show a warning to user that simulation is being used
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            // Dispatch a custom event that can be caught by toast system
            window.dispatchEvent(new CustomEvent('show-toast', {
              detail: {
                message: 'AI service unavailable - using offline simulation mode',
                type: 'warning'
              }
            }));
          }
          
          // Handle unified format from simulation
          if (simulatedResult.success && simulatedResult.data?.transformedCode) {
            return simulatedResult.data.transformedCode;
          }
          
          // Fallback if simulation doesn't return unified format
          return simulatedResult;
        } catch (simError) {
          console.error('Simulation also failed:', simError);
          throw new Error('Both AI service and fallback simulation failed. Please check your setup.');
        }
      }
      
      console.error('Code correction failed:', error);
      throw error;
    }
  }, []);

  // Simulate AI transformation (replace with actual API call)
  const simulateAITransformation = async (request) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        let transformedCode = request.code;
        const instructions = (request.userInstructions || '').toLowerCase();
        
        // Analyze user instructions to determine what transformation to apply
        if (instructions.includes('fix') || instructions.includes('error') || instructions.includes('typo')) {
          // FIX MODE: Fix obvious errors, typos, syntax issues
          if (request.language === 'sql') {
            transformedCode = transformedCode
              .replace(/SELCT/gi, 'SELECT')
              .replace(/FORM/gi, 'FROM')
              .replace(/WHRE/gi, 'WHERE')
              .replace(/;$/, ';')
              .trim();
          } else if (request.language === 'python') {
            transformedCode = transformedCode
              .replace(/pint\(/g, 'print(')
              .replace(/dfe\s+/g, 'def ')
              .replace(/:\s*$/, ':')
              .trim();
          } else if (request.language === 'javascript') {
            transformedCode = transformedCode
              .replace(/consol\.log/g, 'console.log')
              .replace(/fucntion/g, 'function')
              .trim();
          }
          
        } else if (instructions.includes('comment') || instructions.includes('document')) {
          // COMMENT MODE: Add comments and documentation
          if (request.language === 'sql') {
            transformedCode = `-- ${request.userInstructions}\n${transformedCode}`;
          } else if (request.language === 'python') {
            transformedCode = `# ${request.userInstructions}\n${transformedCode}`;
          } else {
            transformedCode = `// ${request.userInstructions}\n${transformedCode}`;
          }
          
        } else if (instructions.includes('optimize') || instructions.includes('improve') || instructions.includes('enhance')) {
          // OPTIMIZE MODE: Improve performance and structure
          if (request.language === 'sql') {
            transformedCode = transformedCode
              .replace(/select\s+\*/gi, 'SELECT *')
              .replace(/\bfrom\b/gi, 'FROM')
              .replace(/\bwhere\b/gi, 'WHERE')
              .replace(/\band\b/gi, 'AND');
          } else if (request.language === 'javascript') {
            if (transformedCode.includes('for') && !transformedCode.includes('const ')) {
              transformedCode = transformedCode.replace(/var /g, 'const ');
            }
          }
          
        } else if (instructions.includes('generate') || instructions.includes('create') || instructions.includes('implement')) {
          // GENERATION MODE: Create new code based on context
          if (request.selectedMentions && request.selectedMentions.length > 0) {
            const mention = request.selectedMentions[0];
            if (mention.excelData) {
              const { headers, rowData } = mention.excelData;
              if (request.language === 'python') {
                transformedCode = `# Generated code based on ${mention.name}\ndata = {\n${headers.map((h, i) => `    '${h}': '${rowData[i] || ''}'`).join(',\n')}\n}`;
              } else if (request.language === 'javascript') {
                transformedCode = `// Generated code based on ${mention.name}\nconst data = {\n${headers.map((h, i) => `  ${h}: '${rowData[i] || ''}'`).join(',\n')}\n};`;
              }
            } else {
              transformedCode = `// Generated code based on ${mention.name}\n${transformedCode}`;
            }
          }
          
        } else {
          // DEFAULT MODE: Basic improvements
          transformedCode = transformedCode.trim();
          if (request.language === 'javascript' && !transformedCode.includes('//')) {
            transformedCode = `// Improved code\n${transformedCode}`;
          }
        }
        
        // If no changes were made, at least clean up whitespace
        if (transformedCode === request.code) {
          transformedCode = request.code.trim();
        }
        
        // Return unified format
        resolve({
          success: true,
          data: {
            transformedCode: transformedCode,
            changes: {
              linesAdded: transformedCode.split('\n').length - request.code.split('\n').length,
              linesModified: transformedCode !== request.code ? 1 : 0,
              transformationType: "simulation"
            }
          },
          message: "Code transformed using offline simulation mode",
          timestamp: new Date().toISOString()
        });
      }, 1500);
    });
  };

  // Handle keyboard shortcuts for saving
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (activeTab) {
          // Get content based on tab type
          let content;
          if (activeTab.type === 'memory') {
            content = getCurrentMemoryFileContent(activeTab.fileId);
          } else {
            content = fileContents[activeTab.name] || '';
          }
          console.log('💾 Saving file:', activeTab.name, 'Type:', activeTab.type, 'Content length:', content?.length);
          saveFileContent(activeTab.name, content);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, fileContents, saveFileContent, getCurrentMemoryFileContent]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S to save current file
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const currentActiveTab = safeOpenTabs.find(tab => tab.isActive);
        if (currentActiveTab) {
          // Get content based on tab type
          let content;
          if (currentActiveTab.type === 'memory') {
            content = getCurrentMemoryFileContent(currentActiveTab.fileId);
          } else {
            content = fileContents[currentActiveTab.name] || '';
          }
          console.log('💾 Saving file (duplicate handler):', currentActiveTab.name, 'Type:', currentActiveTab.type, 'Content length:', content?.length);
          saveFileContent(currentActiveTab.name, content);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, safeOpenTabs, fileContents, saveFileContent, getCurrentMemoryFileContent]);

  // Git Commit Functions
  const handleGitCommit = useCallback(() => {
    if (!activeTab) return;
    
    // Auto-detect repository URL from current working directory if possible
    const currentPath = window.location.pathname;
    if (currentPath && !repoUrl) {
      // Try to detect repo from common patterns
      const repoMatch = currentPath.match(/\/([^/]+\/[^/]+)(?:\/|$)/);
      if (repoMatch) {
        setRepoUrl(`https://github.com/${repoMatch[1]}`);
      }
    }
    
    // Auto-populate PR title if not set
    if (!prTitle) {
      setPrTitle(`Update ${activeTab.name}`);
    }
    
    // Auto-populate commit message with reasonable default
    if (!commitMessage) {
      setCommitMessage(activeTab.type === 'memory' 
        ? `Add ${activeTab.name}` 
        : `Update ${activeTab.name}`
      );
    }
    
    setShowGitCommitDialog(true);
  }, [activeTab, repoUrl, prTitle, commitMessage]);

  // Helper function to fetch existing branches from repository
  const fetchRepositoryBranches = useCallback(async (owner, repoName) => {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches`, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        console.warn('Could not fetch branches:', response.status);
        return [];
      }

      const branches = await response.json();
      return branches.map(branch => branch.name);
    } catch (error) {
      console.warn('Error fetching branches:', error);
      return [];
    }
  }, [githubToken]);

  // Effect to fetch available branches when repo URL changes
  useEffect(() => {
    if (githubToken && repoUrl && showGitCommitDialog) {
      const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (repoMatch) {
        const [, owner, repo] = repoMatch;
        const repoName = repo.replace('.git', '');
        
        setLoadingBranches(true);
        fetchRepositoryBranches(owner, repoName)
          .then(branches => {
            setAvailableBranches(branches);
            setLoadingBranches(false);
          })
          .catch(error => {
            console.warn('Failed to fetch branches:', error);
            setAvailableBranches([]);
            setLoadingBranches(false);
          });
      }
    }
  }, [githubToken, repoUrl, showGitCommitDialog, fetchRepositoryBranches]);

  // Helper function to create a new branch from base branch
  const createGitHubBranch = useCallback(async (owner, repoName, newBranchName, baseBranch = 'main') => {
    try {
      // Get the SHA of the base branch
      const baseResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${baseBranch}`, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!baseResponse.ok) {
        throw new Error(`Failed to get base branch ${baseBranch}`);
      }

      const baseData = await baseResponse.json();
      const baseSha = baseData.object.sha;

      // Create the new branch
      const createResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: `refs/heads/${newBranchName}`,
          sha: baseSha
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        // Branch might already exist, which is fine
        if (errorData.message && errorData.message.includes('already exists')) {
          return { success: true, exists: true };
        }
        throw new Error(`Failed to create branch: ${errorData.message}`);
      }

      return { success: true, exists: false };
    } catch (error) {
      console.error('Error creating branch:', error);
      throw error;
    }
  }, [githubToken]);

  // GitHub API integration for pushing memory files directly
  const pushMemoryFileToGitHub = useCallback(async (fileName, content, commitMessage, branch = 'main') => {
    if (!githubToken || !repoUrl) {
      throw new Error('GitHub token and repository URL are required');
    }

    // Extract owner and repo from URL
    const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL format');
    }
    
    const [, owner, repo] = repoMatch;
    const repoName = repo.replace('.git', '');

    try {
      // If not pushing to main/master, ensure the branch exists
      if (branch !== 'main' && branch !== 'master') {
        await createGitHubBranch(owner, repoName, branch, 'main');
      }
      // First, try to get the current file (if it exists) to get its SHA
      let sha = null;
      try {
        const getResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${fileName}`, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (getResponse.ok) {
          const existingFile = await getResponse.json();
          sha = existingFile.sha;
        }
      } catch (e) {
        // File doesn't exist yet, which is fine
      }

      // Create or update the file
      const createResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${fileName}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: commitMessage,
          content: btoa(unescape(encodeURIComponent(content))), // Base64 encode UTF-8 content
          branch: branch,
          ...(sha && { sha }) // Include SHA if updating existing file
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`GitHub API error: ${errorData.message || 'Unknown error'}`);
      }

      const result = await createResponse.json();
      return {
        success: true,
        commit: result.commit,
        content: result.content,
        url: result.content.html_url
      };
    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      throw error;
    }
  }, [githubToken, repoUrl, createGitHubBranch]);

  // Create Pull Request via GitHub API
  const createGitHubPullRequest = useCallback(async (branchName, title, description, baseBranch = 'main') => {
    if (!githubToken || !repoUrl) {
      throw new Error('GitHub token and repository URL are required');
    }

    // Extract owner and repo from URL
    const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL format');
    }
    
    const [, owner, repo] = repoMatch;
    const repoName = repo.replace('.git', '');

    try {
      const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title,
          body: description,
          head: branchName,
          base: baseBranch
        })
      });

      if (!prResponse.ok) {
        const errorData = await prResponse.json();
        throw new Error(`GitHub PR API error: ${errorData.message || 'Unknown error'}`);
      }

      const result = await prResponse.json();
      return {
        success: true,
        number: result.number,
        url: result.html_url,
        id: result.id
      };
    } catch (error) {
      console.error('Error creating Pull Request:', error);
      throw error;
    }
  }, [githubToken, repoUrl]);

  // Enhanced performGitCommit with direct GitHub API support
  const performGitCommit = useCallback(async () => {
    if (!activeTab || !commitMessage.trim()) return;

    setIsCommitting(true);
    
    try {
      const fileName = activeTab.name;
      const isMemoryFile = activeTab.type === 'memory';
      const isRegularFile = activeTab.type === 'file' || !activeTab.type; // Include files with no type
      
      // Check if we have GitHub credentials for direct push
      // Allow API push for both memory files and regular files that have content in the editor
      const hasFileContent = isMemoryFile 
        ? getCurrentMemoryFileContent(activeTab.fileId)
        : fileContents[activeTab.id] || '';
      
      const canPushDirectly = githubToken && repoUrl && hasFileContent && (isMemoryFile || isRegularFile);
      
      console.log('🔍 Debug GitHub API conditions:', {
        githubToken: githubToken ? `${githubToken.substring(0, 4)}...` : 'NOT SET',
        repoUrl: repoUrl || 'NOT SET',
        isMemoryFile,
        isRegularFile,
        hasFileContent: hasFileContent ? `${hasFileContent.length} chars` : 'NO CONTENT',
        canPushDirectly,
        fileName: activeTab.name,
        fileId: activeTab.fileId,
        tabType: activeTab.type
      });
      
      if (canPushDirectly) {
        // Direct GitHub API push for files with content - no confirmation needed
        console.log('🚀 Attempting direct GitHub API push...');
        
        const fileContent = isMemoryFile 
          ? getCurrentMemoryFileContent(activeTab.fileId)
          : fileContents[activeTab.id] || '';
        
        console.log('📝 File content length:', fileContent?.length || 0);
        
        const branch = branchName.trim() || (createPR ? `feature/${fileName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}` : 'main');
        console.log('🌿 Using branch:', branch);
        
        try {
          const result = await pushMemoryFileToGitHub(fileName, fileContent, commitMessage, branch);
          console.log('✅ GitHub push successful:', result);
          
          // Create Pull Request if requested
          let prResult = null;
          if (createPR && branch !== 'main') {
            const prTitleText = prTitle.trim() || `Update ${fileName}`;
            const prDescriptionText = prDescription.trim() || `${commitMessage}\n\nFile: ${fileName}`;
            
            try {
              prResult = await createGitHubPullRequest(branch, prTitleText, prDescriptionText, 'main');
              console.log(`✅ Created Pull Request #${prResult.number}:`, prResult.url);
            } catch (prError) {
              console.error('❌ Failed to create Pull Request:', prError);
              // Continue without failing the entire operation
            }
          }
          
          // Save GitHub token to localStorage if provided
          if (githubToken && githubToken !== localStorage.getItem('github_token')) {
            localStorage.setItem('github_token', githubToken);
          }
          
          // Close the dialog immediately after successful push
          setShowGitCommitDialog(false);
          setCommitMessage('');
          setCreatePR(false);
          setPrTitle('');
          setPrDescription('');
          setBranchName('');
          
          // Show success notification in console only
          console.log(`✅ Successfully pushed "${fileName}" to GitHub:`, {
            url: result.url,
            commit: result.commit.sha.substring(0, 7),
            branch: branch,
            pullRequest: prResult ? `#${prResult.number} - ${prResult.url}` : null
          });
          
          return; // Exit function after successful API push
        } catch (apiError) {
          console.error('❌ GitHub API push failed:', apiError);
          // Log error details but don't show alert for API errors
          console.error('GitHub API Error Details:', {
            message: apiError.message,
            token: githubToken ? 'Present' : 'Missing',
            repoUrl,
            fileName
          });
          return; // Don't fall back to manual instructions for API errors
        }
      }
      
      // Only show manual instructions if API push is not available
      let instructions = '';
      
      if (createPR) {
        // Enhanced workflow with PR creation
        const branch = branchName.trim() || `feature/${fileName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
        const prTitleText = prTitle.trim() || `Update ${fileName}`;
        const prDescriptionText = prDescription.trim() || `${commitMessage}\n\nFile: ${fileName}`;
        
        if (isMemoryFile) {
          instructions = `To commit the memory file "${fileName}" and create a Pull Request:

1. Save the file to disk:
   - Press Ctrl+S (or Cmd+S on Mac) to save
   - Choose a location in your Git repository
   - Name the file "${fileName}"

2. Navigate to your repository directory:
   cd /path/to/your/repository

3. Create and switch to a new branch:
   git checkout -b ${branch}

4. Add the file to Git:
   git add "${fileName}"

5. Commit with your message:
   git commit -m "${commitMessage}"

6. Push the branch to GitHub:
   git push origin ${branch}

7. Create Pull Request using GitHub CLI (if installed):
   gh pr create --title "${prTitleText}" --body "${prDescriptionText}"

   Or manually create PR at:
   https://github.com/YOUR_USERNAME/YOUR_REPO/compare/${branch}

GitHub Token: ${githubToken ? '✓ Configured' : '⚠️ Not set - needed for API operations'}
Repository: ${repoUrl || 'Not specified'}`;
        } else {
          instructions = `To commit "${fileName}" and create a Pull Request:

1. Create and switch to a new branch:
   git checkout -b ${branch}

2. Add the file to Git:
   git add "${fileName}"

3. Commit with your message:
   git commit -m "${commitMessage}"

4. Push the branch to GitHub:
   git push origin ${branch}

5. Create Pull Request using GitHub CLI:
   gh pr create --title "${prTitleText}" --body "${prDescriptionText}"

   Or manually create PR at:
   https://github.com/YOUR_USERNAME/YOUR_REPO/compare/${branch}

Alternative: Direct GitHub API PR creation (requires token):
${githubToken ? `curl -X POST \\
  -H "Authorization: token ${githubToken}" \\
  -H "Accept: application/vnd.github.v3+json" \\
  https://api.github.com/repos/OWNER/REPO/pulls \\
  -d '{
    "title": "${prTitleText}",
    "body": "${prDescriptionText}",
    "head": "${branch}",
    "base": "main"
  }'` : 'Set GitHub token first to use API method'}

Repository: ${repoUrl || 'Configure repository URL in dialog'}`;
        }
      } else {
        // Original simple commit workflow
        if (isMemoryFile) {
          instructions = `To commit the memory file "${fileName}", follow these steps:

1. Save the file to disk:
   - Press Ctrl+S (or Cmd+S on Mac) to save
   - Choose a location on your file system
   - Name the file "${fileName}"

2. Navigate to the directory where you saved the file:
   cd /path/to/your/saved/file

3. Add the file to Git:
   git add "${fileName}"

4. Commit with your message:
   git commit -m "${commitMessage}"

5. Push to remote repository:
   git push`;
        } else {
          instructions = `To commit the file "${fileName}", run these commands in your terminal:

1. Add the file to Git:
   git add "${fileName}"

2. Commit with your message:
   git commit -m "${commitMessage}"

3. Push to remote repository:
   git push

Tip: Make sure you're in the correct directory containing "${fileName}"`;
        }
      }

      // Show instructions for manual workflow only
      const proceed = window.confirm(instructions + '\n\nWould you like to copy these commands to clipboard?');
        
      if (proceed) {
        let commandsOnly = '';
        
        if (createPR) {
          const branch = branchName.trim() || `feature/${fileName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
          const prTitleText = prTitle.trim() || `Update ${fileName}`;
          const prDescriptionText = prDescription.trim() || `${commitMessage}\n\nFile: ${fileName}`;
          
          commandsOnly = isMemoryFile 
            ? `# Save file first (Ctrl+S), then:\ngit checkout -b ${branch}\ngit add "${fileName}"\ngit commit -m "${commitMessage}"\ngit push origin ${branch}\ngh pr create --title "${prTitleText}" --body "${prDescriptionText}"`
            : `git checkout -b ${branch}\ngit add "${fileName}"\ngit commit -m "${commitMessage}"\ngit push origin ${branch}\ngh pr create --title "${prTitleText}" --body "${prDescriptionText}"`;
        } else {
          commandsOnly = isMemoryFile 
            ? `# Save file first (Ctrl+S), then:\ngit add "${fileName}"\ngit commit -m "${commitMessage}"\ngit push`
            : `git add "${fileName}"\ngit commit -m "${commitMessage}"\ngit push`;
        }
        
        try {
          await navigator.clipboard.writeText(commandsOnly);
          console.log(`${createPR ? 'Git + PR' : 'Git'} commands copied to clipboard!`);
        } catch (err) {
          console.log('Could not copy to clipboard:', err);
        }
      }
      
      // Save GitHub token to localStorage if provided
      if (githubToken && githubToken !== localStorage.getItem('github_token')) {
        localStorage.setItem('github_token', githubToken);
      }
      
      // Close dialog and reset for manual workflows
      setShowGitCommitDialog(false);
      setCommitMessage('');
      setCreatePR(false);
      setPrTitle('');
      setPrDescription('');
      setBranchName('');
      
    } catch (error) {
      console.error('❌ Git commit error:', error);
      // Log error details instead of showing alert
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    } finally {
      setIsCommitting(false);
    }
  }, [activeTab, commitMessage, createPR, prTitle, prDescription, branchName, githubToken, repoUrl, getCurrentMemoryFileContent, fileContents, pushMemoryFileToGitHub, createGitHubPullRequest]);

  const closeGitCommitDialog = useCallback(() => {
    setShowGitCommitDialog(false);
    setCommitMessage('');
    setIsCommitting(false);
    setCreatePR(false);
    setPrTitle('');
    setPrDescription('');
    setBranchName('');
    // Don't reset GitHub token and repo URL as they should persist
  }, []);

  // Add Git commit keyboard shortcut
  useEffect(() => {
    const handleGitCommitKeyDown = (e) => {
      // Ctrl+Shift+G for Git commit
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        const currentActiveTab = safeOpenTabs.find(tab => tab.isActive);
        if (currentActiveTab) {
          handleGitCommit();
        }
      }
    };

    document.addEventListener('keydown', handleGitCommitKeyDown);
    return () => document.removeEventListener('keydown', handleGitCommitKeyDown);
  }, [openTabs, safeOpenTabs, handleGitCommit]);

  // SQL Generation Hooks
  
  // Hook to create SQL tab when generation starts
  useEffect(() => {
    if (sqlGeneration.isActive && sqlGeneration.generationId) {
      const sqlTabId = `sql_${sqlGeneration.generationId}`;
      const existingSqlTab = safeOpenTabs.find(tab => tab.id === sqlTabId);
      
      if (!existingSqlTab) {
        const sqlFileName = `generated-sql-${sqlGeneration.generationId}.sql`;
        const sqlTab = {
          id: sqlTabId,
          name: sqlFileName,
          type: 'file',
          path: sqlFileName,
          isGenerated: true,
          isActive: true,
          language: 'sql'
        };
        
        // Initialize with empty content first
        setFileContents(prev => ({
          ...prev,
          [sqlTabId]: '-- SQL Generation Starting...\n-- Please wait while we build your semantic layer\n'
        }));
        
        addTab(sqlTab);
        setActiveTabInContext(sqlTabId);
      }
    }
  }, [sqlGeneration.isActive, sqlGeneration.generationId, openTabs, safeOpenTabs, addTab, setActiveTabInContext]);

  // Hook to update SQL content in real-time and auto-save when complete
  useEffect(() => {
    if (sqlGeneration.isActive && sqlGeneration.generationId && sqlGeneration.sqlContent) {
      const sqlTabId = `sql_${sqlGeneration.generationId}`;
      
      // Update file contents for the SQL tab only if content is different
      setFileContents(prev => {
        const currentContent = prev[sqlTabId];
        if (currentContent !== sqlGeneration.sqlContent) {
          return {
            ...prev,
            [sqlTabId]: sqlGeneration.sqlContent
          };
        }
        return prev; // Return same object to prevent unnecessary re-render
      });

      // Auto-save to memory when generation is complete and sync tab type
      if (sqlGeneration.currentStage === 'complete' && sqlGeneration.sqlContent) {
        const fileName = `generated-sql-${sqlGeneration.generationId}.sql`;
        const memoryFileId = `sql_gen_${sqlGeneration.generationId}`;
        
        // Check if already in memory - only act if not already processed
        const existingMemoryFile = memoryFiles[memoryFileId];
        const currentTab = safeOpenTabs.find(tab => tab.id === sqlTabId);
        
        // Only proceed if memory file doesn't exist OR tab is not yet marked as memory file
        if (!existingMemoryFile || (currentTab && currentTab.type !== 'memory')) {
          console.log('🔄 Converting SQL tab to memory file:', fileName, 'fileId:', memoryFileId);
          
          if (existingMemoryFile) {
            console.log('📝 Updating existing memory file');
            updateMemoryFile(memoryFileId, sqlGeneration.sqlContent, true, '🔄 SQL generation update'); // Create version for SQL generation update
          } else {
            console.log('📝 Creating new memory file');
            // Add new memory file with consistent ID
            addMemoryFile(memoryFileId, fileName, sqlGeneration.sqlContent, 'sql', false);
          }

          // Update tab to reference memory file only if not already a memory file
          if (currentTab && currentTab.type !== 'memory') {
            console.log('🔄 Converting tab to memory type with fileId:', memoryFileId);
            const updatedTabs = safeOpenTabs.map(tab => 
              tab.id === sqlTabId ? { 
                ...tab, 
                isGenerated: false,
                type: 'memory',
                fileId: memoryFileId,
                isDirty: false 
              } : tab
            );
            updateTabs(updatedTabs);
            
            // Also update fileContents to sync with memory file
            setFileContents(prev => ({
              ...prev,
              [sqlTabId]: sqlGeneration.sqlContent
            }));
          }
        }
      }
    }
  }, [
    sqlGeneration.sqlContent, 
    sqlGeneration.generationId, 
    sqlGeneration.isActive, 
    sqlGeneration.currentStage,
    memoryFiles, 
    openTabs,
    safeOpenTabs,
    addMemoryFile, 
    updateMemoryFile,
    updateTabs
  ]);  // Hook to update tab title based on generation stage
  useEffect(() => {
    if (sqlGeneration.isActive && sqlGeneration.generationId) {
      const sqlTabId = `sql_${sqlGeneration.generationId}`;
      const stageIndicators = {
        'parsing-file': '📊',
        'analyzing': '🔍', 
        'generating-joins': '🔗',
        'generating-select': '📋',
        'generating-filters': '🔍',
        'combining': '🔧',
        'complete': '✅'
      };
      
      const stageIndicator = stageIndicators[sqlGeneration.currentStage] || '🔄';
      const baseFileName = `generated-sql-${sqlGeneration.generationId}.sql`;
      const newTabName = sqlGeneration.currentStage === 'complete' 
        ? `${baseFileName}` 
        : `${stageIndicator} ${baseFileName}`;
      
      // Update tab name if it's different
      const currentTab = safeOpenTabs.find(tab => tab.id === sqlTabId);
      if (currentTab && currentTab.name !== newTabName) {
        const updatedTabs = safeOpenTabs.map(tab => 
          tab.id === sqlTabId ? { ...tab, name: newTabName } : tab
        );
        updateTabs(updatedTabs);
      }
    }
  }, [sqlGeneration.currentStage, sqlGeneration.generationId, sqlGeneration.isActive, openTabs, safeOpenTabs, updateTabs]);

  // Load memory file content when memory file tab becomes active
  useEffect(() => {
    if (activeTab?.type === 'memory' && activeTab?.fileId) {
      console.log('🔍 Loading memory file content for tab:', activeTab.name, 'fileId:', activeTab.fileId);
      const memoryFile = memoryFiles[activeTab.fileId];
      console.log('📁 Memory file found:', !!memoryFile, memoryFile ? 'versions:' + memoryFile.versions?.length : 'no file');
      
      if (memoryFile && memoryFile.versions && memoryFile.versions.length > 0) {
        const currentMemoryContent = getCurrentMemoryFileContent(activeTab.fileId);
        console.log('📄 Memory file content length:', currentMemoryContent?.length);
        
        // Only update if content is different to prevent infinite loops
        setFileContents(prev => {
          const currentContent = prev[activeTab.id];
          if (currentContent !== currentMemoryContent) {
            console.log('✅ Updating fileContents for memory file:', activeTab.name);
            return {
              ...prev,
              [activeTab.id]: currentMemoryContent
            };
          }
          return prev; // Return same object to prevent unnecessary re-render
        });
      } else {
        console.log('⚠️ Memory file not found or has no versions:', activeTab.fileId);
      }
    }
  }, [activeTab?.id, activeTab?.type, activeTab?.fileId, activeTab?.name, memoryFiles, getCurrentMemoryFileContent]);

  // Handle keyboard shortcuts for SQL execution
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check if we're in a SQL file and user pressed Ctrl+Enter (or Cmd+Enter on Mac)
      // BUT skip if code correction toolbar is active (to avoid conflicts)
      const isCorrectionToolbarActive = document.querySelector('[data-correction-toolbar="true"]');
      
      if (
        activeTab?.name.toLowerCase().endsWith('.sql') &&
        (event.ctrlKey || event.metaKey) &&
        event.key === 'Enter' &&
        !isCorrectionToolbarActive // Don't trigger SQL execution if correction toolbar is active
      ) {
        event.preventDefault();
        
        let sqlContent;
        if (activeTab?.type === 'memory') {
          sqlContent = getCurrentMemoryFileContent(activeTab?.fileId);
        } else {
          sqlContent = fileContents[activeTab?.id] || '';
        }
        
        console.log('⌨️ Ctrl+Enter SQL execution:', {
          tabType: activeTab?.type,
          fileId: activeTab?.fileId,
          contentLength: sqlContent?.length
        });
        
        executeSqlQuery(sqlContent);
      }
    };

    // Add event listener to the document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab?.name, activeTab?.id, activeTab?.fileId, activeTab?.type, fileContents, getCurrentMemoryFileContent, executeSqlQuery]);

  const openFileInTab = (fileName) => {
    // For simple filename-only cases, use filename as both identifier and name
    const tabId = fileName;
    
    // Check if file is already open using the identifier
    const existingTab = Array.isArray(openTabs) ? openTabs.find(tab => tab.id === tabId) : null;
    if (existingTab) {
      // Just activate the existing tab
      setActiveTab(tabId);
      return;
    }

    // Initialize file content if not already loaded
    if (!fileContents[tabId]) {
      setFileContents(prev => ({
        ...prev,
        [tabId]: getInitialFileContent(fileName)
      }));
    }

    // Add new tab and make it active
    const newTab = {
      id: tabId,
      name: fileName,
      isActive: true,
      isDirty: false
    };

    const updatedTabsForFile = [
      ...safeOpenTabs.map(tab => ({ ...tab, isActive: false })),
      newTab
    ];
    updateTabs(updatedTabsForFile);
    
    // Notify parent component about file opening
    if (onFileOpen) {
      onFileOpen(fileName);
    }
  };

  // Function to open GitHub files as memory files for editing
  const openGitHubFileAsMemoryFile = (fileName, content, uniqueId) => {
    // Create a consistent memory file ID based on the GitHub file's unique identifier
    const memoryFileId = `memory-github-${uniqueId}`;
    
    // Check if this GitHub file already exists as a memory file (by checking memoryFiles, not just tabs)
    const existingMemoryFile = memoryFiles[memoryFileId];
    
    if (existingMemoryFile) {
      // Memory file already exists, check if there's an open tab for it
      const existingTab = Array.isArray(openTabs) ? openTabs.find(tab => tab.fileId === memoryFileId) : null;
      
      if (existingTab) {
        // Tab is already open, just activate it
        setActiveTabInContext(existingTab.id);
        return;
      } else {
        // Memory file exists but tab was closed, reopen the tab
        const tabId = `tab-${memoryFileId}-${Date.now()}`;
        const newTab = {
          id: tabId,
          name: fileName,
          isActive: true,
          isDirty: false,
          type: 'memory',
          fileId: memoryFileId
        };
        
        // Update tabs
        const updatedTabs = [
          ...safeOpenTabs.map(tab => ({ ...tab, isActive: false })),
          newTab
        ];
        updateTabs(updatedTabs);
        
        // Set initial content in fileContents from existing memory file
        setFileContents(prev => ({
          ...prev,
          [tabId]: getCurrentMemoryFileContent(memoryFileId)
        }));
        
        console.log('🔄 Reopened existing GitHub memory file:', fileName, 'with saved content');
        return;
      }
    }
    
    // Create new memory file if it doesn't exist
    console.log('🆕 Creating new GitHub memory file:', fileName);
    
    // Add memory file to context using the correct signature
    addMemoryFile(memoryFileId, fileName, content, 'text', false);
    
    // Create new tab as memory type
    const tabId = `tab-${memoryFileId}-${Date.now()}`;
    const newTab = {
      id: tabId,
      name: fileName,
      isActive: true,
      isDirty: false,
      type: 'memory',
      fileId: memoryFileId
    };
    
    // Update tabs
    const updatedTabs = [
      ...safeOpenTabs.map(tab => ({ ...tab, isActive: false })),
      newTab
    ];
    updateTabs(updatedTabs);
    
    // Set initial content in fileContents for editor display
    setFileContents(prev => ({
      ...prev,
      [tabId]: content
    }));
    
    // Notify parent component about file opening
    if (onFileOpen) {
      onFileOpen(fileName);
    }
  };

  const openFileInTabWithContent = (fileName, content, fileId = null, uniqueId = null) => {
    // Create a truly unique identifier for the tab
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const tabId = uniqueId ? `${uniqueId}_${timestamp}_${random}` : `${fileId || fileName}_${timestamp}_${random}`;
    
    // Check if file is already open using the unique identifier
    const existingTab = safeOpenTabs.find(tab => tab.id === tabId);
    if (existingTab) {
      // Just activate the existing tab and update content if needed
      setActiveTab(existingTab.id);
      
      if (isExcelFile(fileName)) {
        // Update existing Excel file content
        updateExcelFile(tabId, {
          content: content,
          fileId: fileId
        });
      } else {
        // Update existing text file content
        setFileContents(prev => ({
          ...prev,
          [tabId]: content
        }));
      }
      return;
    }

    // Handle Excel files differently
    if (isExcelFile(fileName)) {
      // Store Excel file data for the ExcelViewer
      updateExcelFile(tabId, {
        content: content,
        fileId: fileId
      });
    } else {
      // Set the file content directly from the provided content for text files
      setFileContents(prev => ({
        ...prev,
        [tabId]: content
      }));
    }

    // Add new tab and make it active
    const newTab = {
      id: tabId,
      name: fileName,
      isActive: true,
      isDirty: false,
      fileId: fileId // Store fileId for local file handle lookup
    };

    const updatedTabs = [
      ...safeOpenTabs.map(tab => ({ ...tab, isActive: false })),
      newTab
    ];
    updateTabs(updatedTabs);
    
    // Notify parent component about file opening
    if (onFileOpen) {
      onFileOpen(fileName);
    }
  };

  const closeTab = (tabId) => {
    const tabToClose = safeOpenTabs.find(tab => tab.id === tabId);
    
    // Before closing, ensure any unsaved changes in fileContents are persisted to memory files
    if (tabToClose?.type === 'memory' && tabToClose?.fileId) {
      const currentContent = fileContents[tabId];
      const memoryFileContent = getCurrentMemoryFileContent(tabToClose.fileId);
      
      // If there's a difference between fileContents and memory file, update the memory file
      if (currentContent && currentContent !== memoryFileContent) {
        console.log('💾 Persisting unsaved changes before closing tab:', tabToClose.name);
        updateMemoryFile(tabToClose.fileId, currentContent, true, '🔄 Auto-save on tab close'); // true = create version when saving
      }
    }
    
    const remainingTabs = openTabs.filter(tab => tab.id !== tabId);
    
    // Clean up deleted files state if this tab was for a deleted file
    if (tabToClose && deletedFiles.has(tabToClose.name)) {
      setDeletedFiles(prevDeleted => {
        const newDeleted = new Set(prevDeleted);
        newDeleted.delete(tabToClose.name);
        return newDeleted;
      });
    }
    
    // Clean up fileContents for this tab
    setFileContents(prev => {
      const newContents = { ...prev };
      delete newContents[tabId];
      return newContents;
    });
    
    if (remainingTabs.length === 0) {
      // If no tabs left, just set empty tabs array (Welcome screen will show)
      updateTabs([]);
      return;
    }

    // If we're closing the active tab, activate the last remaining tab
    const wasActive = safeOpenTabs.find(tab => tab.id === tabId)?.isActive;
    if (wasActive) {
      remainingTabs[remainingTabs.length - 1].isActive = true;
    }

    updateTabs(remainingTabs);
  };

  // Optimized tab click handler
  const handleTabClick = useCallback((tabId) => {
    // Immediate UI feedback - update active tab right away
    const updatedTabs = safeOpenTabs.map(tab => ({
      ...tab,
      isActive: tab.id === tabId
    }));
    updateTabs(updatedTabs);
    
    // Handle memory file persistence asynchronously without blocking UI
    requestAnimationFrame(() => {
      const currentActiveTab = safeOpenTabs.find(tab => tab.isActive && tab.id !== tabId);
      if (currentActiveTab?.type === 'memory' && currentActiveTab?.fileId) {
        const currentContent = fileContents[currentActiveTab.id];
        const memoryFileContent = getCurrentMemoryFileContent(currentActiveTab.fileId);
        
        if (currentContent && currentContent !== memoryFileContent) {
          console.log('💾 Persisting unsaved changes before switching tabs:', currentActiveTab.name);
          updateMemoryFile(currentActiveTab.fileId, currentContent, true, '🔄 Auto-save on tab switch');
        }
      }
    });
  }, [safeOpenTabs, updateTabs, fileContents, getCurrentMemoryFileContent, updateMemoryFile]);

  const setActiveTab = (tabId) => {
    handleTabClick(tabId);
  };

  const handleContentChange = (tabId, newContent) => {
    // Update file content
    setFileContents(prev => ({
      ...prev,
      [tabId]: newContent
    }));

    // Mark file as dirty
    const updatedTabs = safeOpenTabs.map(tab => ({
      ...tab,
      isDirty: tab.id === tabId ? true : tab.isDirty
    }));
    updateTabs(updatedTabs);

    // Get the current tab to check if it's a memory file
    const currentTab = safeOpenTabs.find(t => t.id === tabId);
    const isMemoryFile = currentTab?.type === 'memory';
    
    // For memory files, update the memory file content immediately (WITHOUT creating version for every keystroke)
    if (isMemoryFile && currentTab?.fileId) {
      updateMemoryFile(currentTab.fileId, newContent, false, '✏️ Manual edit'); // false = don't create version for every keystroke
    }
    
    // Only auto-save for regular files, not memory files
    // Memory files will be saved manually via Ctrl+S
    if (!isMemoryFile) {
      // Debounced auto-save after 1 second of no typing
      if (saveTimeoutRef.current[tabId]) {
        clearTimeout(saveTimeoutRef.current[tabId]);
      }
      
      const fileName = currentTab?.name;
      if (fileName) {
        saveTimeoutRef.current[tabId] = setTimeout(() => {
          saveFileContent(fileName, newContent);
        }, 1000);
      }
    }
  };

  const getFileIcon = (fileName) => {
    // No icon - just return empty string for cleaner look
    return '';
  };

  const getInitialFileContent = (fileName) => {
    return '';
  };

  // Drag and drop handlers with counter-based tracking
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current = 0;
    setDragOver(false);
    
    // Get the dropped file data
    const data = e.dataTransfer.getData('text/plain');
    
    if (data) {
      try {
        // Try to parse as JSON (from FileExplorer local files or GitHub files)
        const fileData = JSON.parse(data);
        
        if (fileData.isGitHubFile) {
          // Handle GitHub files - treat them as memory files for editing
          if (fileData.error) {
            openFileInTabWithContent(fileData.name, `// Error loading GitHub file: ${fileData.error}\n// Download URL: ${fileData.downloadUrl}`);
          } else {
            const uniqueId = `github-${fileData.repoInfo.owner}-${fileData.repoInfo.repo}-${fileData.path}`;
            
            // Handle Excel files differently
            if (isExcelFile(fileData.name)) {
              openFileInTabWithContent(fileData.name, fileData.content, null, uniqueId);
            } else {
              // Convert GitHub file to memory file for editing
              openGitHubFileAsMemoryFile(fileData.name, fileData.content, uniqueId);
            }
          }
        } else if (fileData.isLocalFile && fileData.fileId && fileData.name) {
          // Handle local files (existing logic)
          const fileHandle = window.fileHandleRegistry?.get(fileData.fileId);
          
          if (fileHandle) {
            try {
              const fileObj = await fileHandle.getFile();
              
              // Use fullPath as unique identifier if available, otherwise use fileId
              const uniqueId = fileData.fullPath || fileData.fileId;
              
              // Handle Excel files differently - read as binary
              if (isExcelFile(fileData.name)) {
                const arrayBuffer = await fileObj.arrayBuffer();
                openFileInTabWithContent(fileData.name, arrayBuffer, fileData.fileId, uniqueId);
              } else {
                const content = await fileObj.text();
                openFileInTabWithContent(fileData.name, content, fileData.fileId, uniqueId);
              }
              
              // Keep the file handle in registry for saving later
              // window.fileHandleRegistry.delete(fileData.fileId); // Don't delete, we need it for saving
              
            } catch (error) {
              console.error('Error reading file content:', error);
              openFileInTabWithContent(fileData.name, `// Error reading file: ${error.message}\n// Please try again.`);
            }
          } else {
            openFileInTabWithContent(fileData.name, `// File handle not found\n// Please try dragging the file again.`);
          }
        } else {
          // Fallback to regular file opening
          openFileInTab(data);
        }
      } catch (error) {
        // Not JSON, treat as filename (from sample files or other sources)
        openFileInTab(data);
      }
    }
  };

  // Memoize Excel content to prevent unnecessary re-renders
  const memoizedExcelContent = useMemo(() => {
    const excelFile = activeTab && isExcelFile(activeTab.name) ? excelFiles[activeTab.id] : null;
    return excelFile?.content || null;
  }, [activeTab, excelFiles, isExcelFile]);

  // Memoize Excel metadata (activeSheet, sheetNames)
  const memoizedExcelMeta = useMemo(() => {
    const excelFile = activeTab && isExcelFile(activeTab.name) ? excelFiles[activeTab.id] : null;
    return {
      activeSheet: excelFile?.activeSheet,
      sheetNames: excelFile?.sheetNames
    };
  }, [activeTab, excelFiles, isExcelFile]);

  // Handle Excel sheet changes
  const handleExcelSheetChange = useCallback((tabId, activeSheet, sheetNames) => {
    setExcelActiveSheet(tabId, activeSheet, sheetNames);
  }, [setExcelActiveSheet]);

  // Memoize file handle to prevent unnecessary re-renders
  const memoizedFileHandle = useMemo(() => {
    return activeTab?.fileId ? window.fileHandleRegistry?.get(activeTab.fileId) : null;
  }, [activeTab?.fileId]);

  // Memoize file prop to prevent unnecessary re-renders
  const memoizedFileProps = useMemo(() => {
    if (!activeTab || !isExcelFile(activeTab.name)) return null;
    return {
      name: activeTab.name,
      handle: memoizedFileHandle,
      tabId: activeTab.id
    };
  }, [activeTab, memoizedFileHandle, isExcelFile]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Tab Bar */}
      <div className={`${colors.secondary} ${colors.border} border-b flex items-center relative flex-shrink-0`}>
        {/* Tabs Container */}
        <div className="flex items-center flex-1 overflow-x-auto">
          {safeOpenTabs.map((tab) => {
            const isDeleted = deletedFiles.has(tab.name);
            return (
            <div
              key={tab.id}
              className={`
                flex items-center px-3 py-2 border-r ${colors.borderLight} cursor-pointer 
                min-w-0 max-w-[200px] group relative transition-colors duration-150 active:scale-98
                ${isDeleted ? 'opacity-60' : ''}
                ${tab.isActive 
                  ? `${colors.primary} ${colors.text} border-t-2 ${colors.accent.replace('text-', 'border-t-')}` 
                  : `${colors.secondary} ${colors.textSecondary} ${colors.hover}`
                }
              `}
              onClick={() => handleTabClick(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(e, tab)}
              title={isDeleted ? `${tab.name} (deleted)` : tab.name}
            >
              {/* File Icon - Enhanced with special file type indicators */}
              <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                isDeleted ? colors.error.replace('text-', 'bg-') : 
                isJupyterNotebook(tab.name) ? 'bg-orange-500' :
                isDatabricksArchive(tab.name) ? 'bg-red-500' :
                isScalaFile(tab.name) ? 'bg-purple-500' :
                isExcelFile(tab.name) ? 'bg-green-500' :
                isTerminalVisible ? colors.accentBg : colors.textMuted.replace('text-', 'bg-')
              }`}></span>
              
              {/* Special file type indicator */}
              {isJupyterNotebook(tab.name) && (
                <span className="text-xs text-orange-600 dark:text-orange-400 mr-1 font-mono" title="Jupyter Notebook">
                  .ipynb
                </span>
              )}
              {isDatabricksArchive(tab.name) && (
                <span className="text-xs text-red-600 dark:text-red-400 mr-1 font-mono" title="Databricks Archive">
                  .dbc
                </span>
              )}
              {isScalaFile(tab.name) && (
                <span className="text-xs text-purple-600 dark:text-purple-400 mr-1 font-mono" title="Scala with Spark Support">
                  .scala
                </span>
              )}
              
              {/* File Name */}
              <span className={`text-sm truncate flex-1 ${isDeleted ? `${colors.error} line-through` : ''}`}>
                {tab.name}{tab.isDirty ? '*' : ''}
              </span>
              
              {/* Save to Disk Button for Memory Files */}
              {tab.type === 'memory' && (
                <button
                  className={`
                    ml-1 mr-1 w-4 h-4 rounded flex items-center justify-center flex-shrink-0
                    ${colors.accent} ${colors.text} hover:${colors.primary} text-xs
                    transition-colors
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    saveMemoryToDisk(tab.name);
                  }}
                  title="Save to disk"
                >
                  💾
                </button>
              )}
              
              {/* Close Button */}
              {tab.name !== 'Welcome' && (
                <button
                  className={`
                    ml-2 w-4 h-4 rounded flex items-center justify-center flex-shrink-0
                    opacity-0 group-hover:opacity-100 transition-opacity
                    ${colors.hover} ${colors.textSecondary} hover:${colors.text} text-xs
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
            );
          })}
        </div>

        {/* Save Button for Testing */}
        {activeTab && (
          <div className="flex items-center px-2 gap-1">
            {/* Word Wrap Toggle */}
            <button
              onClick={() => setWordWrap(prev => !prev)}
              className={`px-2 py-1 text-xs ${colors.border} rounded ${
                wordWrap 
                  ? `${colors.accentBg} text-white ${colors.accent.replace('text-', 'border-')}` 
                  : `${colors.textSecondary} hover:${colors.text}`
              }`}
              title={wordWrap ? "Disable Word Wrap (Enable Horizontal Scroll)" : "Enable Word Wrap (Disable Horizontal Scroll)"}
            >
              {wordWrap ? '↵' : '↔'}
            </button>
            
            <button
              onClick={() => {
                if (!deletedFiles.has(activeTab.name)) {
                  const content = fileContents[activeTab.id] || '';
                  saveFileContent(activeTab.name, content);
                }
              }}
              disabled={deletedFiles.has(activeTab.name)}
              className={`px-2 py-1 text-xs ${colors.border} rounded ${
                deletedFiles.has(activeTab.name) 
                  ? `${colors.textMuted} cursor-not-allowed opacity-50` 
                  : `${colors.textSecondary} hover:${colors.text}`
              }`}
            >
              Save
            </button>
            <button
              onClick={async () => {
                try {
                  const content = fileContents[activeTab.id] || '';
                  const fileHandle = await window.showSaveFilePicker({
                    suggestedName: activeTab.name,
                    types: [{
                      description: 'Files',
                      accept: { '*/*': [] }
                    }]
                  });
                  
                  const writable = await fileHandle.createWritable();
                  await writable.write(content);
                  await writable.close();
                  
                } catch (error) {
                  // Save As cancelled or failed
                }
              }}
              className={`px-2 py-1 text-xs ${colors.textSecondary} hover:${colors.text} ${colors.border} rounded`}
            >
              Save As
            </button>
            
            {/* Download button for GitHub files */}
            {isGitHubFile(activeTab?.id) && (
              <button
                onClick={() => downloadGitHubFile(activeTab.id, activeTab.name)}
                className={`px-2 py-1 text-xs ${colors.textSecondary} hover:${colors.text} ${colors.border} rounded flex items-center gap-1`}
                title="Download GitHub file to local machine"
              >
                <FaDownload size={10} />
                Download
              </button>
            )}
            
            {/* Version History button for memory files - Debug mode */}
            {activeTab?.type === 'memory' && (
              <button
                onClick={() => setShowVersionHistory(true)}
                className={`px-2 py-1 text-xs ${colors.textSecondary} hover:${colors.text} ${colors.border} rounded flex items-center gap-1`}
                title={`View version history (${memoryFiles[activeTab.fileId]?.versions?.length || 0} versions) - Debug: ID=${activeTab.id}, Type=${activeTab.type}`}
              >
                <span className="text-xs">📝</span>
                History
                {memoryFiles[activeTab.fileId]?.versions?.length > 0 && (
                  <span className="text-xs bg-blue-600 text-white rounded-full px-1 ml-1">
                    {memoryFiles[activeTab.fileId].versions.length}
                  </span>
                )}
              </button>
            )}

            {/* Run Code Button - Show for SQL and Python files */}
            {(activeTab?.name.toLowerCase().endsWith('.sql') || activeTab?.name.toLowerCase().endsWith('.py')) && (
              <button
                onClick={() => {
                  console.log('🚀 Run button clicked!');
                  
                  let codeContent;
                  if (activeTab?.type === 'memory') {
                    codeContent = getCurrentMemoryFileContent(activeTab?.fileId);
                  } else {
                    codeContent = fileContents[activeTab?.id] || '';
                  }
                  
                  console.log('🚀 Code content length:', codeContent?.length);
                  console.log('🚀 Code preview:', codeContent?.substring(0, 100));
                  
                  const activeConnection = getActiveConnection();
                  const isPySparkFile = activeTab?.name.toLowerCase().endsWith('.py');
                  const isPySparkConnection = activeConnection?.type === 'pyspark';
                  
                  // Simple debug logging
                  console.log('🔍 File name:', activeTab?.name);
                  console.log('🔍 File ID:', activeTab?.fileId);
                  console.log('🔍 ActiveConnectionId:', activeConnectionId);
                  console.log('🔍 ActiveConnection:', activeConnection);
                  console.log('🔍 Connection type:', activeConnection?.type);
                  console.log('🔍 Is PySpark connection:', isPySparkConnection);
                  console.log('🔍 Is Python file:', isPySparkFile);
                  console.log('🔍 Is SQL file:', activeTab?.name.toLowerCase().endsWith('.sql'));
                  
                  // Check if this is a PySpark memory file based on fileId
                  const isPySparkMemoryFile = activeTab?.fileId?.includes('pyspark');
                  console.log('🔍 Is PySpark memory file:', isPySparkMemoryFile);

                  // Determine execution type
                  if (isPySparkConnection && (isPySparkFile || activeTab?.name.toLowerCase().endsWith('.sql'))) {
                    // PySpark execution for .py files or SQL files with PySpark connection
                    console.log('🚀 Calling executePySparkCode...');
                    executePySparkCode(codeContent);
                  } else if (!isPySparkConnection && activeTab?.name.toLowerCase().endsWith('.sql')) {
                    // SQL execution for .sql files with non-PySpark connection
                    console.log('🚀 Calling executeSqlQuery...');
                    executeSqlQuery(codeContent);
                  } else {
                    // Invalid combination
                    console.log('🚀 Invalid combination detected');
                    alert('Invalid combination: Please use a PySpark connection for Python files or a SQL connection for SQL files.');
                  }
                }}
                disabled={sqlExecution.isExecuting || (!activeConnectionId && !(activeTab?.name && state.fileConnections?.[activeTab.name]))}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors duration-150 active:scale-95 ${
                  sqlExecution.isExecuting || (!activeConnectionId && !(activeTab?.name && state.fileConnections?.[activeTab.name]))
                    ? `bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 border border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600` 
                    : `bg-green-600 text-white hover:bg-green-700 border border-green-600 hover:border-green-700 active:bg-green-800`
                }`}
                title={
                  (!activeConnectionId && !(activeTab?.name && state.fileConnections?.[activeTab.name]))
                    ? "No connection selected. Please configure a connection first." 
                    : sqlExecution.isExecuting 
                      ? "Executing code..." 
                      : (() => {
                          const activeConnection = getActiveConnection();
                          const isPySparkFile = activeTab?.name.toLowerCase().endsWith('.py');
                          const isPySparkConnection = activeConnection?.type === 'pyspark';
                          
                          if (isPySparkConnection && (isPySparkFile || activeTab?.name.toLowerCase().endsWith('.sql'))) {
                            return "Run PySpark Code (Ctrl+Enter)";
                          } else if (!isPySparkConnection && activeTab?.name.toLowerCase().endsWith('.sql')) {
                            return "Run SQL Query (Ctrl+Enter)";
                          } else {
                            return "Invalid combination: Check connection and file type";
                          }
                        })()
                }
              >
                {sqlExecution.isExecuting ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Running...
                  </>
                ) : (
                  <>
                    <FaPlay />
                    {(() => {
                      const activeConnection = getActiveConnection();
                      const isPySparkFile = activeTab?.name.toLowerCase().endsWith('.py');
                      const isPySparkConnection = activeConnection?.type === 'pyspark';
                      
                      if (isPySparkConnection && (isPySparkFile || activeTab?.name.toLowerCase().endsWith('.sql'))) {
                        return "Run PySpark";
                      } else if (!isPySparkConnection && activeTab?.name.toLowerCase().endsWith('.sql')) {
                        return "Run SQL";
                      } else {
                        return "Run Code";
                      }
                    })()}
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Theme Toggle Slider (without icons) */}
        <div className={`flex items-center px-4 ${colors.borderLight} border-l`}>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={theme === 'light'}
              onChange={toggleTheme}
              className="sr-only peer"
            />
            <div className={`w-9 h-5 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${theme === 'dark' ? 'peer-checked:bg-blue-600' : 'peer-checked:bg-blue-500'}`}></div>
          </label>
        </div>

        {/* Database Connection Selector - Larger Size */}
        <div className={`flex items-center px-4 ${colors.borderLight} border-l`}>
          <div className="flex items-center gap-3">
            {/* Connection Status Indicator - Larger */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                (activeTab && state.fileConnections?.[activeTab.name]) || activeConnectionId
                  ? 'bg-green-500' 
                  : theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
              }`} title={
                (activeTab && state.fileConnections?.[activeTab.name]) || activeConnectionId
                  ? 'Connected' 
                  : 'Not Connected'
              }></div>
              <span className={`text-xs font-medium ${colors.text}`}>
                {(activeTab && state.fileConnections?.[activeTab.name]) || activeConnectionId ? 'Connected' : 'No Connection'}
              </span>
            </div>
            
            {/* Connection Selector Dropdown - Larger */}
            <select
              value={(activeTab && state.fileConnections?.[activeTab.name]) || activeConnectionId || ''}
              onChange={(e) => {
                const connectionId = e.target.value;
                if (activeTab) {
                  // Set file-specific connection
                  actions.setFileConnection(activeTab.name, connectionId);
                } else {
                  // Fall back to global connection
                  actions.setActiveConnection(connectionId);
                }
              }}
              className={`text-sm px-3 py-2 rounded border ${colors.borderLight} ${colors.secondary} ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px] font-medium`}
              title="Select database connection for this file"
            >
              <option value="">No Connection</option>
              {dbConnections.map(conn => (
                <option key={conn.id} value={conn.id}>
                  {conn.name || `${conn.type} (${conn.host})`}
                </option>
              ))}
            </select>
            
            {/* Quick Manage Button - Larger */}
            <button
              onClick={() => setShowConnectionModal(true)}
              className={`px-3 py-2 rounded border ${colors.borderLight} ${colors.textSecondary} hover:${colors.text} hover:${colors.hover} transition-colors duration-150 active:scale-95`}
              title="Manage connections"
            >
              <FaCog size={14} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
            </button>
          </div>
            
          {/* SQL Generation Control */}
          {sqlGeneration.isActive && (
            <div className="flex items-center gap-3 border-l pl-4 ml-4 border-gray-300 dark:border-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" title="SQL Generation Active"></div>
                <span className={`text-xs font-medium ${colors.text}`}>
                  Generating Code...
                </span>
              </div>
              <button
                onClick={() => {
                  // Reset SQL generation state
                  resetSqlGeneration();
                  
                  // Clear any persisted state that might be causing the issue
                  try {
                    sessionStorage.removeItem('sqlGeneration');
                    localStorage.removeItem('sqlGeneration');
                  } catch (e) {
                    console.warn('Could not clear storage:', e);
                  }
                  
                  // Send message to close any active SSE connections
                  try {
                    window.postMessage({ type: 'FORCE_CLOSE_SSE_CONNECTION' }, '*');
                  } catch (e) {
                    console.warn('Could not send SSE close message:', e);
                  }
                  
                  console.log('🛑 SQL Generation stopped by user');
                  console.log('🧹 Cleared any persisted generation state');
                  console.log('📡 Requested SSE connection closure');
                }}
                className={`px-3 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900 transition-colors duration-150 active:scale-95 text-xs font-medium`}
                title="Stop automatic code generation and close streaming connections"
              >
                ⏹ Stop Generation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor Area with Drop Zone */}
      <div 
        className={`
          flex-1 ${colors.primary} relative flex flex-col overflow-hidden
          ${dragOver ? `${colors.accentBg} bg-opacity-20 border-2 ${colors.accent.replace('text-', 'border-')} border-dashed` : ''}
        `}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop Overlay */}
        {dragOver && (
          <div className={`absolute inset-0 flex items-center justify-center ${colors.accentBg} bg-opacity-90 z-50 backdrop-blur-sm`}>
            <div className={`text-center text-white`}>
              <div className="text-4xl mb-4">⊞</div>
              <div className="text-xl font-semibold">Drop file here to open</div>
              <div className="text-sm opacity-75">Release to add file to tabs</div>
            </div>
          </div>
        )}

        {openTabs.length === 0 ? (
          // Welcome Screen with Large Logo
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-6 max-w-md text-center p-6">
              {/* Large Logo */}
              <img 
                src="/logo.png" 
                alt="DataMonk Logo" 
                className="w-32 h-auto opacity-90 hover:opacity-100 transition-opacity duration-300"
              />
              
              {/* Welcome Text */}
              <div className="space-y-3">
                <h1 className={`text-2xl font-bold ${colors.textMuted}`}>
                  Vibe with your data
                </h1>
              </div>
              
              {/* Quick Actions */}
              <div className="flex flex-col items-center space-y-2 w-full">
                <div className={`text-sm ${colors.textMuted} mb-2`}>Quick Actions:</div>
                <div className="flex flex-col gap-1 text-sm">
                  <div className={`flex items-center justify-center ${colors.textMuted} py-1`}>
                    <div className="flex items-center gap-4">
                      <span>Toggle Terminal</span>
                      <div className="flex items-center space-x-1">
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-600 text-white rounded">Ctrl</kbd>
                        <span className="text-xs text-gray-400">+</span>
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-600 text-white rounded">`</kbd>
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center ${colors.textMuted} py-1`}>
                    <div className="flex items-center gap-4">
                      <span>Bring up In-line AI Editing</span>
                      <div className="flex items-center space-x-1">
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-600 text-white rounded">Ctrl</kbd>
                        <span className="text-xs text-gray-400">+</span>
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-600 text-white rounded">K</kbd>
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center ${colors.textMuted} py-1`}>
                    <div className="flex items-center gap-4">
                      <span>Attach DataContext with</span>
                      <div className="flex items-center">
                        <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-600 text-white rounded">@context</kbd>
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center ${colors.textMuted} py-1`}>
                    <div className="flex items-center gap-4">
                      <span>Drag files from explorer to open</span>
                      <div className="flex items-center">
                        <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-600 text-white rounded">Drag & Drop</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Full Screen File Editor
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* File Header */}
            <div className={`${colors.secondary} px-4 py-2 border-b ${colors.borderLight} flex items-center justify-between flex-shrink-0`}>
              {/* Left side - Status indicator and file name */}
              <span className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 ${colors.successBg} rounded-full`}></span>
                <span className={colors.text}>{activeTab?.name}</span>
              </span>
              
              {/* Right side - Actions and status */}
              <div className="flex items-center gap-3">
                {/* Git Commit Button */}
                {activeTab && (
                  <button
                    onClick={handleGitCommit}
                    className={`flex items-center gap-1 px-2 py-1 text-xs ${colors.textMuted} hover:${colors.text} hover:${colors.accentBg} hover:bg-opacity-20 rounded transition-colors`}
                    title={`Git commit ${activeTab.type === 'memory' ? 'memory file' : 'file'}: ${activeTab.name}`}
                  >
                    <FaGitAlt size={12} />
                    <span>Commit</span>
                  </button>
                )}
                
                {/* Unsaved changes indicator */}
                {activeTab?.isDirty && (
                  <span className={`${colors.warning} text-xs flex items-center gap-1`}>
                    ● Unsaved changes
                    {activeTab?.type === 'memory' && (
                      <span className={`${colors.textMuted} text-xs`}>(Press Ctrl+S to save)</span>
                    )}
                  </span>
                )}
              </div>
            </div>
            
            {/* Deleted File Warning */}
            {/* File deleted warning */}
            {activeTab && deletedFiles.has(activeTab.name) && (
              <div className={`${colors.errorBg} border-l-4 ${colors.errorBorder} px-4 py-3 flex-shrink-0`}>
                <div className="flex items-center">
                  <span className={`${colors.error} text-sm`}>
                    ⚠️ This file has been deleted from the file system but is still open in the editor.
                  </span>
                </div>
              </div>
            )}
            
            {/* Full File Content Editor - Only this scrolls */}
            <div className={`flex-1 ${colors.primary} overflow-hidden`}>
              {activeTab && isExcelFile(activeTab.name) ? (
                <ExcelViewer
                  key={`excel-${activeTab.id}`} // Unique key per Excel file to maintain separate state
                  file={memoizedFileProps}
                  fileContent={memoizedExcelContent}
                  initialActiveSheet={memoizedExcelMeta.activeSheet}
                  sheetNames={memoizedExcelMeta.sheetNames}
                  onSheetChange={(activeSheet, sheetNames) => handleExcelSheetChange(activeTab.id, activeSheet, sheetNames)}
                />
              ) : activeTab ? (
                (() => {
                  const currentContent = activeTab.type === 'memory' && activeTab.fileId ? 
                    getCurrentMemoryFileContent(activeTab.fileId) || fileContents[activeTab?.id] || '' : 
                    (fileContents[activeTab?.id] || '');
                  
                  // Handle special file types
                  if (isJupyterNotebook(activeTab.name)) {
                    const formattedContent = formatJupyterNotebook(currentContent);
                    return (
                      <div className="p-4">
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                            <FaInfoCircle />
                            <span className="font-medium">Jupyter Notebook (.ipynb)</span>
                          </div>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            This is a read-only preview of the notebook. Cells and outputs are displayed as formatted text.
                          </p>
                        </div>
                        <MonacoEditor
                          key={activeTab?.id}
                          value={formattedContent}
                          onChange={(newValue) => handleContentChange(activeTab?.id, newValue)}
                          fileName="preview.md"
                          onSave={(content) => saveFileContent(activeTab?.name, content)}
                          onGitCommit={handleGitCommit}
                          onCodeCorrection={handleCodeCorrection}
                          wordWrap={wordWrap}
                          getAllAvailableFiles={getAllAvailableFiles}
                          additionalFiles={{ memoryFiles, excelFiles }}
                          showToast={showToast}
                        />
                      </div>
                    );
                  } else if (isDatabricksArchive(activeTab.name)) {
                    const formattedContent = formatDatabricksArchive(currentContent);
                    return (
                      <div className="p-4">
                        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                            <FaInfoCircle />
                            <span className="font-medium">Databricks Archive (.dbc)</span>
                          </div>
                          <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                            This is a preview of the Databricks archive. For full functionality, import this into a Databricks workspace.
                          </p>
                        </div>
                        <MonacoEditor
                          key={activeTab?.id}
                          value={formattedContent}
                          onChange={(newValue) => handleContentChange(activeTab?.id, newValue)}
                          fileName="preview.md"
                          onSave={(content) => saveFileContent(activeTab?.name, content)}
                          onGitCommit={handleGitCommit}
                          onCodeCorrection={handleCodeCorrection}
                          wordWrap={wordWrap}
                        />
                      </div>
                    );
                  } else if (isScalaFile(activeTab.name)) {
                    return (
                      <div className="p-4">
                        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                            <FaLightbulb />
                            <span className="font-medium">Scala with Spark Support</span>
                          </div>
                          <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                            Enhanced syntax highlighting with Spark/Databricks keywords and autocompletion.
                          </p>
                        </div>
                        <MonacoEditor
                          key={activeTab?.id}
                          value={currentContent}
                          onChange={(newValue) => handleContentChange(activeTab?.id, newValue)}
                          fileName={activeTab?.name}
                          onSave={(content) => saveFileContent(activeTab?.name, content)}
                          onGitCommit={handleGitCommit}
                          onCodeCorrection={handleCodeCorrection}
                          wordWrap={wordWrap}
                          getAllAvailableFiles={getAllAvailableFiles}
                          additionalFiles={{ memoryFiles, excelFiles }}
                          showToast={showToast}
                        />
                      </div>
                    );
                  } else {
                    return (
                      <MonacoEditor
                        key={activeTab?.id}
                        value={currentContent}
                        onChange={(newValue) => handleContentChange(activeTab?.id, newValue)}
                        fileName={activeTab?.name}
                        onSave={(content) => saveFileContent(activeTab?.name, content)}
                        onGitCommit={handleGitCommit}
                        onCodeCorrection={handleCodeCorrection}
                        wordWrap={wordWrap}
                        getAllAvailableFiles={getAllAvailableFiles}
                        additionalFiles={{ memoryFiles, excelFiles }}
                        showToast={showToast}
                      />
                    );
                  }
                })()
              ) : null}
            </div>
          </div>
        )}
      </div>
      
      {/* Version History Modal */}
      {showVersionHistory && activeTab?.type === 'memory' && memoryFiles[activeTab?.fileId] && (
        <VersionHistory
          fileId={activeTab.fileId}
          fileName={activeTab.name}
          versions={memoryFiles[activeTab.fileId].versions || []}
          currentContent={(() => {
            const memoryFile = memoryFiles[activeTab.fileId];
            if (!memoryFile || !memoryFile.versions || memoryFile.versions.length === 0) {
              return '';
            }
            const currentIndex = memoryFile.currentVersionIndex || 0;
            return memoryFile.versions[currentIndex]?.content || '';
          })()}
          onRestoreVersion={restoreFileVersion}
          onClearHistory={clearFileHistory}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {/* Git Commit Dialog */}
      {showGitCommitDialog && activeTab && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${colors.primary} rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border ${colors.borderLight}`}>
            
            {/* Header */}
            <div className={`px-6 py-5 border-b ${colors.borderLight} ${colors.secondary}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${colors.tertiary}`}>
                    {createPR ? <VscGitPullRequest size={20} className="text-gray-400" /> : <VscGithub size={20} className="text-gray-400" />}
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${colors.text}`}>
                      {createPR ? 'Create Pull Request' : 'Commit Changes'}
                    </h3>
                    <p className={`text-sm ${colors.textMuted}`}>
                      {activeTab.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGitCommitDialog(false)}
                  className={`p-2 rounded-lg ${colors.hover} ${colors.textMuted} hover:${colors.text} transition-colors`}
                >
                  <FaTimes size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6 overflow-y-auto max-h-[60vh]">
              
              {/* Commit Message */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${colors.text}`}>
                  Commit Message
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={`${activeTab.type === 'memory' ? 'Add' : 'Update'} ${activeTab.name}`}
                  className={`w-full px-4 py-3 ${colors.secondary} border ${colors.borderLight} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${colors.text} resize-none transition-all`}
                  rows={3}
                />
              </div>

              {/* Pull Request Toggle */}
              <div className={`p-4 rounded-lg border ${colors.borderLight} ${colors.secondary}`}>
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <VscGitPullRequest className="text-gray-400" size={20} />
                    <div>
                      <div className={`font-medium ${colors.text}`}>Create Pull Request</div>
                      <div className={`text-sm ${colors.textMuted}`}>Create a PR for code review</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={createPR}
                    onChange={(e) => setCreatePR(e.target.checked)}
                    className="w-5 h-5 text-gray-600 bg-gray-700 border-gray-600 rounded focus:ring-gray-500"
                  />
                </label>
              </div>

              {/* PR Details Section */}
              {createPR && (
                <div className={`border ${colors.borderLight} rounded-lg p-5 space-y-4 ${colors.tertiary}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <FaCog className="text-gray-400" size={16} />
                    <h4 className={`font-medium ${colors.text}`}>Pull Request Configuration</h4>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Branch Name */}
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                        Branch Name
                      </label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder={`feature/${activeTab.name.replace(/[^a-zA-Z0-9]/g, '-')}-update`}
                        className={`w-full px-4 py-3 ${colors.primary} border ${colors.borderLight} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text} transition-all`}
                      />
                      
                      {/* Branch Examples */}
                      <div className="mt-3">
                        <div className={`text-xs font-medium ${colors.textMuted} mb-2`}>Quick Select:</div>
                        <div className="flex flex-wrap gap-2">
                          {['feature/new-component', 'bugfix/fix-issue', 'hotfix/urgent', 'dev'].map(example => (
                            <button
                              key={example}
                              onClick={() => setBranchName(example)}
                              className="px-3 py-1 text-xs rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600 transition-all"
                              type="button"
                            >
                              {example}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Repository URL */}
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                        Repository URL
                      </label>
                      <input
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/owner/repo"
                        className={`w-full px-4 py-3 ${colors.primary} border ${colors.borderLight} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text} transition-all`}
                      />
                    </div>

                    {/* PR Title */}
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                        Pull Request Title
                      </label>
                      <input
                        type="text"
                        value={prTitle}
                        onChange={(e) => setPrTitle(e.target.value)}
                        placeholder={`Update ${activeTab.name}`}
                        className={`w-full px-4 py-3 ${colors.primary} border ${colors.borderLight} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text} transition-all`}
                      />
                    </div>

                    {/* PR Description */}
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                        Description
                      </label>
                      <textarea
                        value={prDescription}
                        onChange={(e) => setPrDescription(e.target.value)}
                        placeholder="Describe your changes..."
                        className={`w-full px-4 py-3 ${colors.primary} border ${colors.borderLight} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text} resize-none transition-all`}
                        rows={3}
                      />
                    </div>

                    {/* GitHub Token */}
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                        GitHub Token (Optional)
                      </label>
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className={`w-full px-4 py-3 ${colors.primary} border ${colors.borderLight} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text} transition-all`}
                      />
                      <p className={`text-xs ${colors.textMuted} mt-1 flex items-center gap-1`}>
                        <FaInfoCircle />
                        Saved locally for GitHub API operations
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info Panel */}
              <div className={`p-4 rounded-lg border-l-4 border-gray-600 ${colors.tertiary}`}>
                <div className="flex items-start gap-3">
                  <FaLightbulb className="text-gray-400 mt-0.5" size={16} />
                  <div>
                    <div className={`text-sm font-medium ${colors.text}`}>
                      {createPR ? 'Pull Request Workflow' : 'Direct Commit'}
                    </div>
                    <div className={`text-sm ${colors.textMuted} mt-1`}>
                      {createPR 
                        ? 'Creates a new branch, commits changes, and opens a Pull Request for review.'
                        : 'Commits changes directly to the repository.'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${colors.borderLight} flex items-center justify-between`}>
              <button
                onClick={() => setShowGitCommitDialog(false)}
                className={`px-4 py-2 text-sm font-medium ${colors.textMuted} ${colors.hover} rounded-lg transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={performGitCommit}
                disabled={!commitMessage.trim() || isCommitting}
                className={`px-6 py-3 text-sm font-medium text-white rounded-lg transition-all ${
                  !commitMessage.trim() || isCommitting
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gray-700 hover:bg-gray-600'
                } flex items-center gap-2`}
              >
                {isCommitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Committing...
                  </>
                ) : (
                  <>
                    {createPR ? <VscGitPullRequest size={16} /> : <VscGithub size={16} />}
                    {createPR ? 'Create PR' : 'Commit'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Context Menu */}
      {showTabContextMenu && contextMenuTab && (
        <div 
          className={`fixed z-50 ${colors.secondary} ${colors.border} border rounded-lg shadow-lg py-1 min-w-[150px]`}
          style={{ 
            left: contextMenuPosition.x, 
            top: contextMenuPosition.y,
            transform: 'translate(-50%, 0)'
          }}
        >
          <button
            onClick={handleTabRename}
            className={`w-full px-3 py-2 text-left text-sm ${colors.text} hover:${colors.hover} transition-colors`}
          >
            Rename
          </button>
          {contextMenuTab.type === 'memory' && (
            <button
              onClick={() => {
                saveMemoryToDisk(contextMenuTab.name);
                closeContextMenu();
              }}
              className={`w-full px-3 py-2 text-left text-sm ${colors.text} hover:${colors.hover} transition-colors`}
            >
              Save to Disk
            </button>
          )}
          <hr className={`my-1 ${colors.border} border-t`} />
          <button
            onClick={() => {
              closeTab(contextMenuTab.id);
              closeContextMenu();
            }}
            className={`w-full px-3 py-2 text-left text-sm ${colors.error} hover:${colors.hover} transition-colors`}
          >
            Close Tab
          </button>
        </div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && renamingTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.secondary} ${colors.border} border rounded-lg p-6 w-80 max-w-md`}>
            <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>
              Rename {renamingTab.type === 'memory' ? 'Memory File' : 'Tab'}
            </h3>
            <div className="mb-4">
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                Current name: {renamingTab.name}
              </label>
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                New name:
              </label>
              <input
                type="text"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmTabRename();
                  } else if (e.key === 'Escape') {
                    cancelTabRename();
                  }
                }}
                placeholder="Enter new name"
                className={`w-full px-3 py-2 ${colors.primary} ${colors.border} border rounded text-sm ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                autoFocus
              />
              <p className={`text-xs ${colors.textMuted} mt-1`}>
                {renamingTab.type === 'memory' 
                  ? 'This will rename the memory file'
                  : 'This will rename the tab only'
                }
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={cancelTabRename}
                className={`px-4 py-2 text-sm ${colors.textMuted} hover:${colors.text} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={confirmTabRename}
                disabled={!newTabName.trim() || newTabName.trim() === renamingTab.name}
                className={`px-4 py-2 text-sm ${colors.accentBg} text-white rounded-md hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Config Modal */}
      {showConnectionModal && (
        <ConnectionConfigModal
          onClose={() => setShowConnectionModal(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-3 rounded-lg shadow-lg transition-all duration-300 ${
            toast.type === 'error' ? 'bg-red-500 text-white' :
            toast.type === 'success' ? 'bg-green-500 text-white' :
            'bg-yellow-500 text-black'
          }`}
          style={{
            animation: 'fadeIn 0.3s ease-in-out'
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
});

MainEditor.displayName = 'MainEditor';

export default MainEditor;
