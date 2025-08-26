import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import CustomScrollbar from './CustomScrollbar';
import MonacoEditor from './MonacoEditor';
import ExcelViewer from './ExcelViewer';
import VersionHistory from './VersionHistory';
import { FaDownload, FaCodeBranch } from 'react-icons/fa';
import { connectionManager } from '../services/ConnectionManager';

const MainEditor = forwardRef(({ selectedFile, onFileOpen, isTerminalVisible }, ref) => {
  const { theme, toggleTheme, colors } = useTheme();
  const { state, actions } = useAppState();
  
  // Get tab and Excel data from context
  const { 
    openTabs = [], 
    excelFiles = {}, 
    sqlGeneration = {}, 
    memoryFiles = {}, 
    activeConnectionId, 
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
    executeSqlQuery: executeFromAppState = () => {},
    saveMemoryFileToDisk = () => {},
    removeMemoryFile = () => {},
    restoreFileVersion = () => {},
    clearFileHistory = () => {},
    setSqlExecuting = () => {},
    setSqlResults = () => {}
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
  
  const [dragOver, setDragOver] = useState(false);
  const dragTimeoutRef = useRef(null);
  const dragCounterRef = useRef(0);
  const saveTimeoutRef = useRef({});

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
      activeTabName: activeTab?.name,
      queryLength: query?.length
    });

    if (!activeConnectionId) {
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
    console.log('MainEditor: Executing SQL for source file:', sourceFile);
    console.log('SQL to execute:', sqlToExecute);

    // Use centralized SQL execution from AppState with source file info
    try {
      await executeFromAppState(sqlToExecute, activeConnectionId, sourceFile);
      console.log('✅ SQL execution completed');
    } catch (error) {
      console.error('❌ SQL execution failed:', error);
      alert(`SQL execution failed: ${error.message}`);
    }
  }, [activeConnectionId, executeFromAppState, activeTab?.name]);

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

  const performGitCommit = useCallback(async () => {
    if (!activeTab || !commitMessage.trim()) return;

    setIsCommitting(true);
    
    try {
      const fileName = activeTab.name;
      const isMemoryFile = activeTab.type === 'memory';
      
      let instructions = '';
      
      if (createPR) {
        // Enhanced workflow with PR creation
        const branch = branchName.trim() || `feature/${fileName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
        const prTitleText = prTitle.trim() || `Update ${fileName}`;
        const prDescriptionText = prDescription.trim() || `${commitMessage}\n\nFile: ${fileName}`;
        
        if (isMemoryFile) {
          instructions = `To commit the memory file "${fileName}" and create a Pull Request:

1. First save the file to disk:
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

1. First save the file to disk:
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
   git push

Note: Memory files exist only in browser memory until saved to disk.`;
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

      // Show instructions in a modal or alert
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
          alert(`${createPR ? 'Git + PR' : 'Git'} commands copied to clipboard!`);
        } catch (err) {
          console.log('Could not copy to clipboard:', err);
          alert('Commands ready - please copy them manually from the previous dialog.');
        }
      }
      
      // Save GitHub token to localStorage if provided
      if (githubToken && githubToken !== localStorage.getItem('github_token')) {
        localStorage.setItem('github_token', githubToken);
      }
      
      // Close dialog and reset
      setShowGitCommitDialog(false);
      setCommitMessage('');
      setCreatePR(false);
      setPrTitle('');
      setPrDescription('');
      setBranchName('');
      
    } catch (error) {
      console.error('Git commit error:', error);
      alert('Error generating Git commands. Please try again.');
    } finally {
      setIsCommitting(false);
    }
  }, [activeTab, commitMessage, createPR, prTitle, prDescription, branchName, githubToken, repoUrl]);

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
      if (
        activeTab?.name.toLowerCase().endsWith('.sql') &&
        (event.ctrlKey || event.metaKey) &&
        event.key === 'Enter'
      ) {
        event.preventDefault();
        
        let sqlContent;
        if (activeTab?.type === 'memory') {
          sqlContent = getCurrentMemoryFileContent(activeTab?.fileId);
        } else {
          sqlContent = fileContents[activeTab?.name] || '';
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

  const setActiveTab = (tabId) => {
    // Before switching tabs, ensure any unsaved changes in the current active tab are persisted
    const currentActiveTab = safeOpenTabs.find(tab => tab.isActive);
    if (currentActiveTab?.type === 'memory' && currentActiveTab?.fileId && currentActiveTab.id !== tabId) {
      const currentContent = fileContents[currentActiveTab.id];
      const memoryFileContent = getCurrentMemoryFileContent(currentActiveTab.fileId);
      
      // If there's a difference between fileContents and memory file, update the memory file
      if (currentContent && currentContent !== memoryFileContent) {
        console.log('💾 Persisting unsaved changes before switching tabs:', currentActiveTab.name);
        updateMemoryFile(currentActiveTab.fileId, currentContent, true, '🔄 Auto-save on tab switch'); // true = create version when switching
      }
    }
    
    const updatedTabs = safeOpenTabs.map(tab => ({
      ...tab,
      isActive: tab.id === tabId
    }));
    updateTabs(updatedTabs);
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
                min-w-0 max-w-[200px] group relative
                ${isDeleted ? 'opacity-60' : ''}
                ${tab.isActive 
                  ? `${colors.primary} ${colors.text} border-t-2 ${colors.accent.replace('text-', 'border-t-')}` 
                  : `${colors.secondary} ${colors.textSecondary} ${colors.hover}`
                }
              `}
              onClick={() => setActiveTab(tab.id)}
              title={isDeleted ? `${tab.name} (deleted)` : tab.name}
            >
              {/* File Icon - Simple colored indicator */}
              <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                isDeleted ? colors.error.replace('text-', 'bg-') : 
                isTerminalVisible ? colors.accentBg : colors.textMuted.replace('text-', 'bg-')
              }`}></span>
              
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

            {/* Run SQL Button - Show for SQL files */}
            {activeTab?.name.toLowerCase().endsWith('.sql') && (
              <button
                onClick={() => {
                  let sqlContent;
                  if (activeTab?.type === 'memory') {
                    sqlContent = getCurrentMemoryFileContent(activeTab?.fileId);
                  } else {
                    sqlContent = fileContents[activeTab?.name] || '';
                  }
                  console.log('🚀 Running SQL from MainEditor:', {
                    tabType: activeTab?.type,
                    fileId: activeTab?.fileId,
                    contentLength: sqlContent?.length,
                    contentPreview: sqlContent?.substring(0, 100)
                  });
                  executeSqlQuery(sqlContent);
                }}
                disabled={sqlExecution.isExecuting || !activeConnectionId}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                  sqlExecution.isExecuting || !activeConnectionId
                    ? `${colors.textMuted} cursor-not-allowed opacity-50 ${colors.border}` 
                    : `${colors.primary} text-white hover:bg-green-600`
                }`}
                title={
                  !activeConnectionId 
                    ? "No database connection selected. Please configure a connection first." 
                    : sqlExecution.isExecuting 
                      ? "Executing query..." 
                      : "Run SQL Query (Ctrl+Enter)"
                }
              >
                {sqlExecution.isExecuting ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Running...
                  </>
                ) : (
                  <>
                    ▶️
                    Run SQL
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Theme Toggle Slider */}
        <div className={`flex items-center px-4 ${colors.borderLight} border-l`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${colors.textSecondary}`}>🌙</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={theme === 'light'}
                onChange={toggleTheme}
                className="sr-only peer"
              />
              <div className={`w-9 h-5 ${colors.quaternary} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:${colors.accentBg}`}></div>
            </label>
            <span className={`text-xs ${colors.textSecondary}`}>☀️</span>
          </div>
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
          // Welcome Screen
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6 max-w-2xl">
              <div className={`text-lg mb-4 ${colors.text}`}>Welcome to AI-DE Editor</div>
              <div className={`space-y-2 text-sm ${colors.textMuted}`}>
                <div>Toggle Terminal: Ctrl + `</div>
                <div className="mt-4 text-xs">
                  ▣ Drag files from the explorer to open them in tabs!
                </div>
                <div className="mt-2 text-xs">
                  ○ Use the theme toggle in the tab bar!
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
                    <FaCodeBranch size={12} />
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
                <MonacoEditor
                  key={activeTab?.id} // Force re-render when tab changes
                  value={activeTab.type === 'memory' && activeTab.fileId ? 
                    // For memory files, use memory content if available, otherwise fall back to fileContents (for streaming)
                    getCurrentMemoryFileContent(activeTab.fileId) || fileContents[activeTab?.id] || '' : 
                    (fileContents[activeTab?.id] || '')
                  }
                  onChange={(newValue) => handleContentChange(activeTab?.id, newValue)}
                  fileName={activeTab?.name}
                  onSave={(content) => saveFileContent(activeTab?.name, content)}
                  onGitCommit={handleGitCommit}
                  wordWrap={wordWrap}
                />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.secondary} rounded-lg border ${colors.borderLight} w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto`}>
            {/* Dialog Header */}
            <div className={`px-6 py-4 border-b ${colors.borderLight}`}>
              <h3 className={`text-lg font-semibold ${colors.text} flex items-center gap-2`}>
                <FaCodeBranch />
                Git Commit {createPR ? '+ Pull Request' : ''} {activeTab.type === 'memory' ? 'Memory File' : 'File'}
              </h3>
              <p className={`text-sm ${colors.textMuted} mt-1`}>
                {activeTab.type === 'memory' 
                  ? `Prepare to commit memory file: ${activeTab.name}`
                  : `Commit file: ${activeTab.name}`
                }
                {createPR && ' and create a Pull Request'}
              </p>
            </div>

            {/* Dialog Content */}
            <div className="px-6 py-4 space-y-4">
              {/* Commit Message */}
              <div>
                <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                  Commit Message *
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={`${activeTab.type === 'memory' ? 'Add memory file' : 'Update'} ${activeTab.name}`}
                  className={`w-full px-3 py-2 ${colors.primary} border ${colors.borderLight} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text} resize-none`}
                  rows={3}
                  autoFocus
                />
              </div>

              {/* Create PR Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="createPR"
                  checked={createPR}
                  onChange={(e) => setCreatePR(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="createPR" className={`text-sm font-medium ${colors.text} flex items-center gap-2`}>
                  <span>🔄 Create Pull Request</span>
                  <span className={`text-xs ${colors.textMuted}`}>(Advanced Git workflow)</span>
                </label>
              </div>

              {/* PR Details Section */}
              {createPR && (
                <div className={`border ${colors.borderLight} rounded-lg p-4 space-y-4 bg-opacity-50 ${colors.accentBg}`}>
                  <h4 className={`text-sm font-semibold ${colors.text} flex items-center gap-2`}>
                    🚀 Pull Request Details
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-1`}>
                        Branch Name
                      </label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder={`feature/${activeTab.name.replace(/[^a-zA-Z0-9]/g, '-')}-update`}
                        className={`w-full px-3 py-2 text-sm ${colors.primary} border ${colors.borderLight} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-1`}>
                        Repository URL
                      </label>
                      <input
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/owner/repo"
                        className={`w-full px-3 py-2 text-sm ${colors.primary} border ${colors.borderLight} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${colors.text} mb-1`}>
                      PR Title
                    </label>
                    <input
                      type="text"
                      value={prTitle}
                      onChange={(e) => setPrTitle(e.target.value)}
                      placeholder={`Update ${activeTab.name}`}
                      className={`w-full px-3 py-2 text-sm ${colors.primary} border ${colors.borderLight} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${colors.text} mb-1`}>
                      PR Description
                    </label>
                    <textarea
                      value={prDescription}
                      onChange={(e) => setPrDescription(e.target.value)}
                      placeholder={`${commitMessage}\n\nChanges made to ${activeTab.name}`}
                      className={`w-full px-3 py-2 text-sm ${colors.primary} border ${colors.borderLight} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text} resize-none`}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${colors.text} mb-1`}>
                      GitHub Token (Optional - for API operations)
                    </label>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className={`w-full px-3 py-2 text-sm ${colors.primary} border ${colors.borderLight} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${colors.text}`}
                    />
                    <p className={`text-xs ${colors.textMuted} mt-1`}>
                      💡 Token is saved locally and used for GitHub API operations
                    </p>
                  </div>
                </div>
              )}
              
              {activeTab.type === 'memory' && (
                <div className={`p-3 ${colors.accentBg} bg-opacity-20 rounded-md`}>
                  <p className={`text-xs ${colors.textMuted}`}>
                    💡 <strong>Tip:</strong> Memory files need to be saved to disk before committing. 
                    You&apos;ll get instructions on how to save and commit this file{createPR ? ' and create the PR' : ''}.
                  </p>
                </div>
              )}

              {createPR && (
                <div className={`p-3 border-l-4 border-blue-500 ${colors.secondary} bg-opacity-50`}>
                  <p className={`text-xs ${colors.text}`}>
                    <strong>🔄 PR Workflow:</strong> This will create a new branch, commit your changes, push to GitHub, and provide instructions for creating a Pull Request.
                  </p>
                </div>
              )}
            </div>

            {/* Dialog Actions */}
            <div className={`px-6 py-4 border-t ${colors.borderLight} flex justify-end gap-3`}>
              <button
                onClick={closeGitCommitDialog}
                className={`px-4 py-2 text-sm ${colors.textMuted} hover:${colors.text} transition-colors`}
                disabled={isCommitting}
              >
                Cancel
              </button>
              <button
                onClick={performGitCommit}
                disabled={!commitMessage.trim() || isCommitting}
                className={`px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2`}
              >
                {isCommitting ? (
                  <>
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FaCodeBranch size={12} />
                    {createPR 
                      ? (activeTab.type === 'memory' ? 'Show Save, Commit & PR Steps' : 'Show Git + PR Commands')
                      : (activeTab.type === 'memory' ? 'Show Save & Commit Steps' : 'Show Git Commands')
                    }
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MainEditor.displayName = 'MainEditor';

export default MainEditor;
