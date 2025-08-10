import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import CustomScrollbar from './CustomScrollbar';
import * as XLSX from 'xlsx';

const ChatPanel = ({ width, getAllAvailableFiles }) => {
  const { colors } = useTheme();
  const { state, actions } = useAppState();
  
  const { chatInput, selectedLLM, availableFiles, openTabs, excelFiles, sqlGeneration, memoryFiles } = state;
  const { 
    setChatInput, 
    setSelectedLLM, 
    startSqlGeneration,
    updateSqlStage,
    updateSqlContent,
    completeSqlGeneration,
    resetSqlGeneration,
    addTab,
    setActiveTab
  } = actions;
  
  // @mention detection state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionType, setMentionType] = useState(''); // 'file', 'context', 'code'
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedMentions, setSelectedMentions] = useState([]); // Array of selected files/mentions
  const [excelRowsDropdown, setExcelRowsDropdown] = useState(null); // Excel rows dropdown state
  const [selectedExcelFile, setSelectedExcelFile] = useState(null); // Currently selected Excel file for context
  const [codeLinesDropdown, setCodeLinesDropdown] = useState(null); // Code lines dropdown state
  const [selectedCodeFile, setSelectedCodeFile] = useState(null); // Currently selected code file for line selection
  const [selectedLines, setSelectedLines] = useState([]); // Array of selected line numbers
  const [lastSelectedLine, setLastSelectedLine] = useState(null); // For range selection with shift+click
  const [toast, setToast] = useState(null); // Toast notification state
  
  // Chat Messages State (new - for streaming functionality)
  const [chatMessages, setChatMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeGenerationId, setActiveGenerationId] = useState(null);
  
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Toast notification function
  const showToast = (message, type = 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // Auto-hide after 3 seconds
  };
  
  // Add toast animation styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Chat message persistence and auto-scroll (new functionality)
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('ai-de-chat-messages');
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        setChatMessages(parsedMessages);
      }
    } catch (error) {
      console.warn('Failed to load chat messages from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ai-de-chat-messages', JSON.stringify(chatMessages));
    } catch (error) {
      console.warn('Failed to save chat messages to localStorage:', error);
    }
  }, [chatMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // SQL Building Functions for Progressive Generation
  const buildSqlForStage = (stage, sourceFile) => {
    const timestamp = new Date().toISOString();
    
    switch (stage) {
      case 'parsing-file':
        return `-- ===================================================
-- AI-DE Generated Semantic Layer
-- Source: ${sourceFile || 'CustomerMapping.xlsx'}
-- Generated: ${timestamp}
-- ===================================================

-- Table Structure Discovery
-- Found tables: customers, addresses, orders
-- Processing sheet: Customer_Data`;

      case 'analyzing':
        return `-- ===================================================
-- AI-DE Generated Semantic Layer
-- Source: ${sourceFile || 'CustomerMapping.xlsx'}
-- Generated: ${timestamp}
-- ===================================================

-- Column Mapping Analysis
-- customers table: customer_id, customer_name, email, address_id
-- addresses table: address_id, address_line1, city, state
-- orders table: order_id, customer_id, order_date, amount

-- Data type analysis in progress...`;

      case 'generating-joins':
        return `-- ===================================================
-- AI-DE Generated Semantic Layer
-- Source: ${sourceFile || 'CustomerMapping.xlsx'}
-- Generated: ${timestamp}
-- ===================================================

-- Building JOIN relationships

SELECT 
  -- Fields will be added in next stage
  
FROM raw.customers c
LEFT JOIN raw.addresses a 
  ON c.address_id = a.address_id
LEFT JOIN raw.orders o 
  ON c.customer_id = o.customer_id`;

      case 'generating-select':
        return `-- ===================================================
-- AI-DE Generated Semantic Layer
-- Source: ${sourceFile || 'CustomerMapping.xlsx'}
-- Generated: ${timestamp}
-- ===================================================

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
  ON c.customer_id = o.customer_id`;

      case 'generating-filters':
        return `-- ===================================================
-- AI-DE Generated Semantic Layer
-- Source: ${sourceFile || 'CustomerMapping.xlsx'}
-- Generated: ${timestamp}
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
  AND a.country = 'US'`;

      case 'combining':
        return `-- ===================================================
-- AI-DE Generated Semantic Layer
-- Source: ${sourceFile || 'CustomerMapping.xlsx'}
-- Generated: ${timestamp}
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

ORDER BY total_spent DESC;`;

      case 'complete':
        return `-- ===================================================
-- Customer Semantic Layer - FINAL
-- Generated by AI-DE from ${sourceFile || 'CustomerMapping.xlsx'}
-- Completion time: ${timestamp}
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
-- - Monitor JOIN performance on large datasets`;

      default:
        return '';
    }
  };

  // Mock data generator for testing streaming (new functionality)
  const generateMockProgress = (generationId, mentions = []) => {
    // Check if there are @code mentions with SQL files
    const codeMentions = mentions.filter(mention => mention.type === 'code');
    const sqlFiles = codeMentions.filter(mention => 
      mention.name.toLowerCase().endsWith('.sql') || 
      mention.name.toLowerCase().includes('sql')
    );
    
    // Determine the target file - use existing SQL file if mentioned, otherwise create new
    let targetFileName = 'CustomerMapping.xlsx'; // Default fallback
    let useExistingFile = false;
    let targetSqlFile = null;
    
    if (sqlFiles.length > 0) {
      // Use the first SQL file mentioned in @code
      targetSqlFile = sqlFiles[0];
      targetFileName = targetSqlFile.name;
      useExistingFile = true;
    }
    
    const progressSteps = [
      { stage: "parsing-file", message: "Parsing file", progress: 12, description: "Reading CustomerMapping.xlsx file structure" },
      { stage: "analyzing", message: "Analyzing", progress: 25, description: "Found 47 column mappings in Customer_Data sheet" },
      { stage: "generating-joins", message: "Generating joins", progress: 40, description: "Creating JOIN for customer_addresses table" },
      { stage: "generating-joins", message: "Generating joins", progress: 50, description: "Creating JOIN for customer_orders table" },
      { stage: "generating-select", message: "Generating select", progress: 65, description: "Adding SELECT for customer_id, customer_name attributes" },
      { stage: "generating-select", message: "Generating select", progress: 72, description: "Adding SELECT for address, city, state attributes" },
      { stage: "generating-filters", message: "Generating filters", progress: 85, description: "Adding WHERE for active customers filter" },
      { stage: "generating-filters", message: "Generating filters", progress: 92, description: "Adding WHERE for date range filter" },
      { stage: "combining", message: "Combining", progress: 96, description: "Assembling final semantic layer structure" },
      { stage: "complete", message: "Complete", progress: 100, description: useExistingFile ? `Updated ${targetFileName}` : "Semantic layer ready for review" }
    ];

    // Start SQL generation in context - pass info about target file
    if (useExistingFile) {
      startSqlGeneration(generationId, targetFileName, {
        useExisting: true,
        fileData: targetSqlFile,
        mentions: codeMentions
      });
    } else {
      startSqlGeneration(generationId, targetFileName);
    }

    let stepIndex = 0;
    let currentProgressId = null;
    
    const interval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        const step = progressSteps[stepIndex];
        
        // Generate SQL for current stage
        const sqlContent = buildSqlForStage(step.stage, targetFileName);
        
        // Dispatch SQL update to context (for MainEditor)
        updateSqlStage(step.stage, { 
          description: step.description,
          progress: step.progress 
        }, sqlContent);
        
        // Update existing progress message or create new one (for ChatPanel UI)
        if (currentProgressId) {
          setChatMessages(prev => prev.map(msg => 
            msg.id === currentProgressId 
              ? {
                  ...msg,
                  content: step.description,
                  metadata: {
                    ...msg.metadata,
                    progress: step.progress,
                    currentStage: step.stage,
                    stageMessage: step.message,
                    isStreaming: stepIndex < progressSteps.length - 1
                  }
                }
              : msg
          ));
        } else {
          const progressMessage = {
            id: `progress_${generationId}`,
            type: 'progress',
            content: step.description,
            timestamp: new Date().toISOString(),
            generationId,
            metadata: {
              progress: step.progress,
              currentStage: step.stage,
              stageMessage: step.message,
              isStreaming: stepIndex < progressSteps.length - 1
            }
          };
          setChatMessages(prev => [...prev, progressMessage]);
          currentProgressId = progressMessage.id;
        }
        
        stepIndex++;
      } else {
        clearInterval(interval);
        setIsStreaming(false);
        setActiveGenerationId(null);
        
        // Complete SQL generation in context
        completeSqlGeneration();
      }
    }, 1200);
  };
  
  // Helper function to get Excel data from AppState
  const getExcelDataForFile = (fileName) => {
    try {
      // First, find the tab that corresponds to this file name
      const matchingTab = openTabs.find(tab => tab.name === fileName);
      if (!matchingTab) {
        return null;
      }
      
      // Now get the Excel data using the tab ID
      const fileData = excelFiles[matchingTab.id];
      if (!fileData) {
        return null;
      }
      
      if (!fileData.content) {
        return null;
      }
      
      // Parse Excel content
      const workbook = XLSX.read(fileData.content, { type: 'array' });
      const sheetNames = workbook.SheetNames;
      const sheetsData = {};
      
      // Process each sheet
      sheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '', 
          raw: false 
        });
        
        // Get header row and data rows
        const headers = jsonData[0] || [];
        const dataRows = jsonData.slice(1);
        
        sheetsData[sheetName] = {
          headers,
          rows: dataRows,
          totalRows: dataRows.length
        };
      });
      
      return {
        fileName,
        tabId: matchingTab.id,
        sheetNames,
        sheetsData,
        activeSheet: fileData.activeSheet || sheetNames[0]
      };
    } catch (error) {
      return null;
    }
  };
  
  // @mention detection function
  const detectMention = (text, cursorPosition) => {
    const beforeCursor = text.substring(0, cursorPosition);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const mentionText = mentionMatch[1].toLowerCase();
      
      // Check for specific mention types
      if ('file'.startsWith(mentionText) || mentionText === '') {
        return { type: 'file', partial: mentionText };
      } else if ('context'.startsWith(mentionText)) {
        return { type: 'context', partial: mentionText };
      } else if ('code'.startsWith(mentionText)) {
        return { type: 'code', partial: mentionText };
      }
    }
    
    return null;
  };

  // Handle mention selection from dropdown
  const handleMentionSelect = (selectedFile) => {
    // Check if this is a context mention with an Excel file
    if (selectedFile.type === 'context' && isExcelFile(selectedFile.name)) {
      // For Excel files in context mode, show Excel rows dropdown instead of adding directly
      const excelData = getExcelDataForFile(selectedFile.name);
      
      if (excelData) {
        setSelectedExcelFile(selectedFile);
        setExcelRowsDropdown(excelData);
        setShowMentionDropdown(false);
        return;
      }
    }
    
    // Check if this is a code mention with a code file
    if (selectedFile.type === 'code' && isCodeFile(selectedFile.name)) {
      // Ensure the file is open in MainEditor first
      const tabId = ensureFileIsOpen(selectedFile);
      
      // Get the code content
      const codeContent = getCodeContentForFile(selectedFile.name);
      
      if (codeContent) {
        const lines = codeContent.split('\n');
        setSelectedCodeFile(selectedFile);
        setCodeLinesDropdown({
          fileName: selectedFile.name,
          lines: lines,
          tabId: tabId
        });
        // Reset line selection state
        setSelectedLines([]);
        setLastSelectedLine(null);
        setShowMentionDropdown(false);
        return;
      } else {
        // Show toast if content couldn't be loaded
        showToast(`Could not load content for "${selectedFile.name}". Make sure the file is accessible.`, 'error');
        setShowMentionDropdown(false);
        return;
      }
    }
    
    // Regular file mention handling
    // Check for duplicates
    const isDuplicate = selectedMentions.some(mention => 
      mention.name === selectedFile.name && mention.type === selectedFile.type
    );
    
    if (isDuplicate) {
      // Show toast notification for duplicate
      showToast(`"${selectedFile.name}" is already selected`, 'warning');
      setShowMentionDropdown(false);
      return;
    }
    
    // Add the selected file to mentions array
    const mention = {
      id: `${selectedFile.name}-${selectedFile.type}-${Date.now()}-${Math.random()}`, // Ensure unique ID
      name: selectedFile.name,
      path: selectedFile.path,
      type: selectedFile.type,
      source: selectedFile.source,
      isGitHub: selectedFile.isGitHub,
      isCloud: selectedFile.isCloud
    };
    
    setSelectedMentions(prev => [...prev, mention]);
    
    // Remove the @mention text from input and close dropdown
    const textarea = textareaRef.current;
    if (textarea) {
      const text = textarea.value;
      const cursorPosition = textarea.selectionStart;
      const beforeCursor = text.substring(0, cursorPosition);
      const afterCursor = text.substring(cursorPosition);
      
      // Find and remove the @mention pattern
      const mentionMatch = beforeCursor.match(/@\w*$/);
      if (mentionMatch) {
        const newText = beforeCursor.substring(0, mentionMatch.index) + afterCursor;
        setChatInput(newText);
        
        // Set cursor position after the replacement
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(mentionMatch.index, mentionMatch.index);
        }, 0);
      }
    }
    
    setShowMentionDropdown(false);
  };
  
  // Helper function to check if file is Excel
  const isExcelFile = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension);
  };
  
  // Helper function to check if file is a code file
  const isCodeFile = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['py', 'sql', 'ipynb', 'dbc', 'js', 'ts', 'jsx', 'tsx', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go'].includes(extension);
  };
  
  // Helper function to get code content for a file
  // Helper function to get current content from memory file
  const getCurrentMemoryFileContent = (memoryFile) => {
    if (!memoryFile || !memoryFile.versions || memoryFile.versions.length === 0) {
      return '';
    }
    const currentIndex = memoryFile.currentVersionIndex || 0;
    return memoryFile.versions[currentIndex]?.content || '';
  };

  const getCodeContentForFile = (fileName) => {
    // First check if file is already open in tabs (from MainEditor)
    const openTab = openTabs.find(tab => tab.name === fileName);
    if (openTab) {
      // Get content from memory files or file system
      const memoryFileEntry = Object.entries(memoryFiles || {}).find(([id, file]) => file.name === fileName);
      if (memoryFileEntry) {
        return getCurrentMemoryFileContent(memoryFileEntry[1]);
      }
    }
    
    // If not in tabs, check memory files directly
    const memoryFileEntry = Object.entries(memoryFiles || {}).find(([id, file]) => file.name === fileName);
    if (memoryFileEntry) {
      return getCurrentMemoryFileContent(memoryFileEntry[1]);
    }
    
    // If not found, we'll need to open the file
    return null;
  };
  
  // Helper function to ensure file is open in MainEditor
  const ensureFileIsOpen = (selectedFile) => {
    // Check if file is already open
    const existingTab = openTabs.find(tab => tab.name === selectedFile.name);
    if (existingTab) {
      // File is already open, just set it as active
      setActiveTab(existingTab.id);
      return existingTab.id;
    }
    
    // File is not open, need to open it
    const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    addTab({
      id: newTabId,
      name: selectedFile.name,
      path: selectedFile.path,
      source: selectedFile.source,
      isGitHub: selectedFile.isGitHub,
      isCloud: selectedFile.isCloud
    });
    setActiveTab(newTabId);
    return newTabId;
  };
  
  // Handle Excel row selection
  const handleExcelRowSelect = (rowData, rowIndex, sheetName) => {
    const mention = {
      id: `${selectedExcelFile.name}-${sheetName}-row${rowIndex}-${Date.now()}-${Math.random()}`,
      name: selectedExcelFile.name,
      path: selectedExcelFile.path,
      type: 'context',
      source: selectedExcelFile.source,
      isGitHub: selectedExcelFile.isGitHub,
      isCloud: selectedExcelFile.isCloud,
      excelData: {
        sheetName,
        rowIndex,
        rowData,
        headers: excelRowsDropdown.sheetsData[sheetName].headers
      }
    };
    
    setSelectedMentions(prev => [...prev, mention]);
    setExcelRowsDropdown(null);
    setSelectedExcelFile(null);
  };
  
  // Handle code line selection
  const handleCodeLineSelect = (startLine, endLine, lines) => {
    const selectedLines = lines.slice(startLine - 1, endLine);
    const mention = {
      id: `${selectedCodeFile.name}-lines${startLine}-${endLine}-${Date.now()}-${Math.random()}`,
      name: selectedCodeFile.name,
      path: selectedCodeFile.path,
      type: 'code',
      source: selectedCodeFile.source,
      isGitHub: selectedCodeFile.isGitHub,
      isCloud: selectedCodeFile.isCloud,
      codeData: {
        startLine,
        endLine,
        content: selectedLines.join('\n'),
        totalLines: lines.length
      }
    };
    
    setSelectedMentions(prev => [...prev, mention]);
    
    // Remove the @code text from input and close dropdown
    const textarea = textareaRef.current;
    if (textarea) {
      const text = textarea.value;
      const cursorPosition = textarea.selectionStart;
      const beforeCursor = text.substring(0, cursorPosition);
      const afterCursor = text.substring(cursorPosition);
      
      // Find and remove the @code pattern
      const mentionMatch = beforeCursor.match(/@code$/);
      if (mentionMatch) {
        const newText = beforeCursor.substring(0, mentionMatch.index) + afterCursor;
        setChatInput(newText);
        
        // Set cursor position after the replacement
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(mentionMatch.index, mentionMatch.index);
        }, 0);
      }
    }
    
    setCodeLinesDropdown(null);
    setSelectedCodeFile(null);
    setSelectedLines([]);
    setLastSelectedLine(null);
  };
  
  // Handle individual line click with range selection support
  const handleLineClick = (lineNumber, event) => {
    const lines = codeLinesDropdown.lines;
    
    if (event.shiftKey && lastSelectedLine !== null) {
      // Range selection with Shift+click
      const start = Math.min(lastSelectedLine, lineNumber);
      const end = Math.max(lastSelectedLine, lineNumber);
      const range = [];
      for (let i = start; i <= end; i++) {
        range.push(i);
      }
      setSelectedLines(range);
    } else {
      // Single line selection
      setSelectedLines([lineNumber]);
      setLastSelectedLine(lineNumber);
    }
  };
  
  // Confirm line selection and create mention
  const confirmLineSelection = () => {
    if (selectedLines.length === 0) return;
    
    const lines = codeLinesDropdown.lines;
    const startLine = Math.min(...selectedLines);
    const endLine = Math.max(...selectedLines);
    
    handleCodeLineSelect(startLine, endLine, lines);
  };
  
  // Handle Excel sheet change in dropdown
  const handleExcelSheetChange = (sheetName) => {
    if (excelRowsDropdown) {
      setExcelRowsDropdown({
        ...excelRowsDropdown,
        activeSheet: sheetName
      });
    }
  };

  // Remove a selected mention
  const removeMention = (mentionId) => {
    setSelectedMentions(prev => prev.filter(m => m.id !== mentionId));
  };

  // Generate suggestions based on mention type
  const generateSuggestions = (type) => {
    // Get fresh files from FileExplorer
    const allFiles = getAllAvailableFiles ? getAllAvailableFiles() : (availableFiles || []);
    
    // Get memory files (generated files like SQL) and convert them to the expected format
    const memoryFilesList = Object.entries(memoryFiles || {}).map(([fileId, fileData]) => ({
      name: fileData.name,
      path: fileData.name, // Memory files don't have a traditional path, use name
      source: 'memory',
      isGitHub: false,
      isCloud: false,
      id: `memory-${fileId}`
    }));
    
    // Combine file explorer files with memory files
    const combinedFiles = [...allFiles, ...memoryFilesList];
    
    switch (type) {
      case 'file':
        // Return all files from FileExplorer and memory
        return combinedFiles.map(file => ({
          name: file.name,
          path: file.path,
          source: file.source,
          type: 'file',
          isGitHub: file.isGitHub,
          isCloud: file.isCloud,
          id: file.id
        }));
        
      case 'context':
        // Filter to Excel/CSV files AND code files (.py, .sql, .ipynb, .dbc)
        return combinedFiles
          .filter(file => {
            const ext = file.name.split('.').pop()?.toLowerCase();
            return ['xlsx', 'xls', 'xlsm', 'csv', 'py', 'sql', 'ipynb', 'dbc'].includes(ext);
          })
          .map(file => ({
            name: file.name,
            path: file.path,
            source: file.source,
            type: 'context',
            isGitHub: file.isGitHub,
            isCloud: file.isCloud,
            id: file.id
          }));
          
      case 'code':
        // Filter to code files: .py, .sql, .ipynb, .dbc
        return combinedFiles
          .filter(file => {
            const ext = file.name.split('.').pop()?.toLowerCase();
            return ['py', 'sql', 'ipynb', 'dbc'].includes(ext);
          })
          .map(file => ({
            name: file.name,
            path: file.path,
            source: file.source,
            type: 'code',
            isGitHub: file.isGitHub,
            isCloud: file.isCloud,
            id: file.id
          }));
          
      default:
        return [];
    }
  };

  const handleSendMessage = () => {
    if (chatInput.trim() || selectedMentions.length > 0) {
      // Generate unique generation ID
      const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add user message to chat history
      const userMessage = {
        id: `msg_${Date.now()}`,
        type: 'user',
        content: chatInput.trim(),
        timestamp: new Date().toISOString(),
        generationId,
        attachments: selectedMentions.map(mention => ({
          type: mention.type,
          name: mention.name,
          path: mention.path,
          source: mention.source,
          isGitHub: mention.isGitHub,
          isCloud: mention.isCloud,
          excelData: mention.excelData || null,
          codeData: mention.codeData || null
        }))
      };
      
      setChatMessages(prev => [...prev, userMessage]);
      
      // Set streaming state
      setIsStreaming(true);
      setActiveGenerationId(generationId);
      
      // Add initial AI response
      setTimeout(() => {
        // Check if there are @code mentions with SQL files
        const codeMentions = selectedMentions.filter(mention => mention.type === 'code');
        const sqlFiles = codeMentions.filter(mention => 
          mention.name.toLowerCase().endsWith('.sql') || 
          mention.name.toLowerCase().includes('sql')
        );
        
        let responseContent = 'I\'ll help you generate the semantic layer. Let me analyze your mapping document and start the generation process.';
        
        if (sqlFiles.length > 0) {
          const sqlFile = sqlFiles[0];
          responseContent = `I'll help you modify the existing SQL file "${sqlFile.name}". Let me analyze the referenced code and update it based on your requirements.`;
        }
        
        const aiMessage = {
          id: `msg_${Date.now() + 1}`,
          type: 'ai',
          content: responseContent,
          timestamp: new Date().toISOString(),
          generationId
        };
        setChatMessages(prev => [...prev, aiMessage]);
        
        // Start mock progress after a brief delay
        setTimeout(() => {
          generateMockProgress(generationId, selectedMentions);
        }, 1000);
      }, 500);
      
      // Clear input and mentions (existing logic)
      setChatInput('');
      setSelectedMentions([]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      if (showMentionDropdown) {
        setShowMentionDropdown(false);
        return;
      }
      if (excelRowsDropdown) {
        setExcelRowsDropdown(null);
        setSelectedExcelFile(null);
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMentionDropdown) {
        setShowMentionDropdown(false);
      } else if (excelRowsDropdown) {
        setExcelRowsDropdown(null);
        setSelectedExcelFile(null);
      } else if (codeLinesDropdown) {
        setCodeLinesDropdown(null);
        setSelectedCodeFile(null);
      } else {
        handleSendMessage();
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (textareaRef.current && !textareaRef.current.contains(event.target)) {
        // Check if click is inside dropdown
        const dropdown = event.target.closest('[data-mention-dropdown]');
        const excelDropdown = event.target.closest('[data-excel-dropdown]');
        const codeDropdown = event.target.closest('[data-code-dropdown]');
        if (!dropdown && !excelDropdown && !codeDropdown) {
          setShowMentionDropdown(false);
          setExcelRowsDropdown(null);
          setSelectedExcelFile(null);
          setCodeLinesDropdown(null);
          setSelectedCodeFile(null);
        }
      }
    };

    if (showMentionDropdown || excelRowsDropdown || codeLinesDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMentionDropdown, excelRowsDropdown, codeLinesDropdown]);

  const handleTextareaChange = (e) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setChatInput(newValue);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 36), 150);
    textarea.style.height = newHeight + 'px';
    
    // Check for @mention detection
    const mention = detectMention(newValue, cursorPosition);
    
    if (mention) {
      setMentionType(mention.type);
      setMentionSuggestions(generateSuggestions(mention.type));
      setShowMentionDropdown(true);
      
      // Calculate dropdown position (we'll improve this later)
      const rect = textarea.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 5,
        left: rect.left
      });
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Message rendering functions for the new chat functionality
  const renderUserMessage = (message) => (
    <div key={message.id} className="flex justify-end mb-4">
      <div className="max-w-[80%]">
        <div className={`${colors.accent} text-white border ${colors.borderLight} rounded-lg px-4 py-2`}>
          <div className="text-sm">{message.content}</div>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white border-opacity-20">
              <div className="text-xs opacity-90">Attachments:</div>
              {message.attachments.map((attachment, idx) => (
                <div key={idx} className="text-xs opacity-75 truncate">
                  {attachment.excelData ? 
                    `@context[${attachment.name}:${attachment.excelData.sheetName}:Row${attachment.excelData.rowIndex + 1}]` :
                    attachment.codeData ?
                    `@code[${attachment.name}:line${attachment.codeData.startLine === attachment.codeData.endLine ? '' : 's'} ${attachment.codeData.startLine === attachment.codeData.endLine ? attachment.codeData.startLine : `${attachment.codeData.startLine}-${attachment.codeData.endLine}`}]` :
                    `@${attachment.type}[${attachment.name}]`
                  }
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`text-xs ${colors.textMuted} mt-1 text-right`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );

  const renderAiMessage = (message) => (
    <div key={message.id} className="flex justify-start mb-4">
      <div className="max-w-[80%]">
        <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg px-4 py-2`}>
          <div className={`text-sm ${colors.text}`}>{message.content}</div>
        </div>
        <div className={`text-xs ${colors.textMuted} mt-1`}>
          AI Assistant • {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );

  const renderProgressMessage = (message) => {
    // Extract progress data
    const progress = message.metadata?.progress || 0;
    const currentStage = message.metadata?.currentStage;
    const stageMessage = message.metadata?.stageMessage;
    const isStreaming = message.metadata?.isStreaming;
    
    // Define workflow stages
    const stages = [
      { id: "parsing-file", label: "Parsing file" },
      { id: "analyzing", label: "Analyzing" },
      { id: "generating-joins", label: "Generating joins" },
      { id: "generating-filters", label: "Generating filters" },
      { id: "generating-select", label: "Generating select" },
      { id: "combining", label: "Combining" },
      { id: "complete", label: "Complete" }
    ];
    
    const getStageStatus = (stageId) => {
      if (currentStage === stageId) return 'active';
      const currentIndex = stages.findIndex(s => s.id === currentStage);
      const stageIndex = stages.findIndex(s => s.id === stageId);
      if (currentIndex > stageIndex) return 'complete';
      return 'pending';
    };

    return (
      <div key={message.id} className="flex justify-start mb-3">
        <div className="max-w-[90%] w-full border border-gray-600 rounded-lg p-3 bg-gray-800/50">
          {/* Minimalist Progress Bar */}
          <div className="mb-3">
            {/* Stage indicators with alternating top/bottom labels */}
            <div className="relative flex items-center justify-between mb-2 px-2 sm:px-4" style={{ height: '70px' }}>
              {/* Background connection line - thicker */}
              <div className="absolute top-1/2 left-4 right-4 sm:left-6 sm:right-6 h-0.5 bg-gray-600 transform -translate-y-1/2"></div>
              
              {stages.map((stage, index) => {
                const status = getStageStatus(stage.id);
                const stageNumber = index + 1;
                const isTop = index % 2 === 0; // Alternate top/bottom
                
                return (
                  <div key={stage.id} className="relative flex flex-col items-center z-10">
                    {/* Label on top for even indices - more spacing */}
                    {isTop && (
                      <span className={`text-xs mb-3 text-white font-normal text-center leading-tight ${
                        status === 'active' ? 'opacity-100' : 'opacity-60'
                      }`}>
                        {stage.label}
                      </span>
                    )}
                    
                    {/* Circle with number - green only for "complete" stage */}
                    <div className={`w-4 h-4 rounded-full border transition-all duration-300 flex items-center justify-center text-xs font-medium ${
                      status === 'complete' && stage.id === 'complete'
                        ? 'bg-green-700 text-white border-green-500' 
                        : status === 'complete' 
                        ? 'bg-white text-gray-800 border-gray-300'
                        : status === 'active'
                        ? 'bg-blue-500 text-white border-blue-400'
                        : 'bg-gray-500 text-white border-gray-400'
                    }`}>
                      {stageNumber}
                    </div>
                    
                    {/* Label on bottom for odd indices - more spacing */}
                    {!isTop && (
                      <span className={`text-xs mt-3 text-white font-normal text-center leading-tight ${
                        status === 'active' ? 'opacity-100' : 'opacity-60'
                      }`}>
                        {stage.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Current stage message - top left aligned with underline */}
            <div className="text-left px-2 mb-2">
              <span className="text-white text-sm font-medium border-b border-gray-500 pb-1 inline-block">
                {stageMessage || 'Processing...'}
              </span>
              {isStreaming && (
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse mt-1 ml-2"></span>
              )}
            </div>
          </div>
          
          {/* Description Box - responsive */}
          <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg px-3 py-2`}>
            <div className="text-white text-sm leading-relaxed">
              {message.content}
            </div>
            <div className="text-gray-400 text-xs mt-1">
              {progress}% • {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCodeMessage = (message) => (
    <div key={message.id} className="flex justify-start mb-4">
      <div className="max-w-[95%] w-full">
        <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg overflow-hidden`}>
          <div className={`flex items-center justify-between px-4 py-2 ${colors.secondary} border-b ${colors.borderLight}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${colors.successBg}`}></span>
              <span className={`${colors.text} text-xs font-mono`}>
                {message.metadata?.blockType?.replace('_', ' ').toUpperCase() || 'SQL'} 
              </span>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(message.content);
                showToast('Code copied to clipboard!', 'success');
              }}
              className={`${colors.textSecondary} hover:${colors.text} text-xs px-2 py-1 rounded transition-colors`}
            >
              Copy
            </button>
          </div>
          <pre className={`p-4 text-sm font-mono overflow-x-auto leading-relaxed ${colors.text}`}>
            <code>{message.content}</code>
          </pre>
        </div>
        <div className={`text-xs ${colors.textMuted} mt-1`}>
          Generated • {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );

  const renderMessage = (message) => {
    switch (message.type) {
      case 'user':
        return renderUserMessage(message);
      case 'ai':
        return renderAiMessage(message);
      case 'progress':
        return renderProgressMessage(message);
      case 'code':
        return renderCodeMessage(message);
      default:
        return null;
    }
  };

  return (
    <div 
      className={`${colors.secondary} ${colors.border} border-l flex flex-col h-full`}
      style={{ width }}
    >
      {/* Chat Header */}
      <div className={`p-4 ${colors.border} border-b flex items-center justify-between`}>
        <h3 className={`text-sm font-medium ${colors.text}`}>CHAT</h3>
        {chatMessages.length > 0 && (
          <button
            onClick={() => setChatMessages([])}
            className={`text-xs ${colors.textSecondary} hover:${colors.text} px-2 py-1 rounded transition-colors`}
            title="Clear chat history"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chat Messages */}
      <CustomScrollbar 
        className="flex-1"
        showHorizontal={false}
        showVertical={true}
      >
        <div className="p-4 space-y-2 min-h-full">
          {chatMessages.length === 0 ? (
            /* Original placeholder when no messages */
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${colors.tertiary}`}>
                  <svg className={`w-8 h-8 ${colors.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className={`text-lg font-semibold ${colors.text} mb-2`}>
                  AI-Powered Data Engineering Assistant
                </h3>
                <p className={`text-sm ${colors.textMuted} leading-relaxed mb-4`}>
                  Bring your mapping document, explore your mapping document into File FileExplorer
                  and have our AI assistant help with developing your SQL , Pyspark , Python codes 
                </p>
                <div className={`text-xs ${colors.textSecondary} space-y-1`}>
                  <div>• Type @file to attach files</div>
                  <div>• Type @context to attach rows of Excel / Csv </div>
                  <div>• Type @code to attach your existing code </div>
                  <div>• Drag and drop your files into MainEditor</div>
                  <div>• AutoFormat your sql </div>
                </div>
              </div>
            </div>
          ) : (
            /* Render actual messages when they exist */
            <>
              {chatMessages.map(message => renderMessage(message))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </CustomScrollbar>

      {/* Chat Input */}
      <div className={`p-4 ${colors.border} border-t relative`}>
        <div className={`${colors.tertiary} rounded-lg p-3`}>
          <div className="flex flex-col">
            {/* Selected mentions display */}
            {selectedMentions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-opacity-20" style={{ borderColor: colors.border }}>
                {selectedMentions.map((mention) => (
                  <div
                    key={mention.id}
                    className={`inline-flex items-center px-2 py-1 rounded text-xs ${colors.text} ${colors.tertiary} border ${colors.border}`}
                    style={{
                      fontSize: '11px',
                      maxWidth: '280px'
                    }}
                  >
                    <span 
                      className="truncate"
                      title={mention.excelData ? 
                        `@context[${mention.name}:${mention.excelData.sheetName}:Row${mention.excelData.rowIndex + 1}]` :
                        mention.codeData ?
                        `@code[${mention.name}:line${mention.codeData.startLine === mention.codeData.endLine ? '' : 's'} ${mention.codeData.startLine === mention.codeData.endLine ? mention.codeData.startLine : `${mention.codeData.startLine}-${mention.codeData.endLine}`}]` :
                        `@${mention.type}[${mention.name}]`
                      }
                    >
                      {mention.excelData ? 
                        `@context[${mention.name}:${mention.excelData.sheetName}:Row${mention.excelData.rowIndex + 1}]` :
                        mention.codeData ?
                        `@code[${mention.name}:line${mention.codeData.startLine === mention.codeData.endLine ? '' : 's'} ${mention.codeData.startLine === mention.codeData.endLine ? mention.codeData.startLine : `${mention.codeData.startLine}-${mention.codeData.endLine}`}]` :
                        `@${mention.type}[${mention.name}]`
                      }
                    </span>
                    <button
                      onClick={() => removeMention(mention.id)}
                      className={`ml-2 ${colors.textMuted} hover:${colors.text} rounded w-4 h-4 flex items-center justify-center text-xs`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Textarea - Full width */}
            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="Attach the Mapping Document using '@DocumentName'"
              className={`w-full bg-transparent text-sm focus:outline-none ${colors.text} resize-none border-none p-2 leading-relaxed`}
              style={{ 
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                minHeight: '36px',
                maxHeight: '150px',
                overflow: 'auto'
              }}
              rows="1"
            />
            
            {/* Bottom controls - Agent on left, Send on right */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-opacity-20" style={{ borderColor: colors.border }}>
              {/* Left side - LLM Selector */}
              <div className="flex items-center space-x-2">
                <span className={`text-xs ${colors.textMuted}`}>Model:</span>
                <select 
                  value={selectedLLM}
                  onChange={(e) => setSelectedLLM(e.target.value)}
                  className={`${colors.quaternary} text-xs px-2 py-1 rounded ${colors.text} min-w-[140px] border border-opacity-30`}
                  style={{ borderColor: colors.border }}
                >
                  <option value="claude-3-5-sonnet">Claude Sonnet 3.5</option>
                  <option value="claude-3-opus">Claude Opus 3</option>
                  <option value="claude-3-haiku">Claude Haiku 3</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gemini-pro">Gemini Pro</option>
                  <option value="gemini-ultra">Gemini Ultra</option>
                  <option value="llama-2-70b">Llama 2 70B</option>
                  <option value="codellama-34b">CodeLlama 34B</option>
                  <option value="mistral-large">Mistral Large</option>
                  <option value="mixtral-8x7b">Mixtral 8x7B</option>
                </select>
              </div>
              
              {/* Right side - Send button */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() && selectedMentions.length === 0}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    (chatInput.trim() || selectedMentions.length > 0)
                      ? `${colors.accentBg} hover:opacity-80 text-white` 
                      : `${colors.quaternary} ${colors.textMuted} cursor-not-allowed`
                  }`}
                >
                  Send ➤
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* @mention dropdown */}
        {showMentionDropdown && (
          <div 
            data-mention-dropdown="true"
            className={`absolute z-50 ${colors.secondary} ${colors.border} border rounded-lg shadow-lg mt-1 min-w-[250px] max-h-[200px] overflow-y-auto`}
            style={{
              top: 'auto',
              bottom: '100%',
              left: '1rem',
              marginBottom: '0.5rem'
            }}
          >
            <div className={`p-2 text-xs text-white border-b ${colors.borderLight}`}>
              @{mentionType} suggestions ({mentionSuggestions.length} files):
            </div>
            {mentionSuggestions.length > 0 ? (
              mentionSuggestions.map((suggestion, index) => (
                <div 
                  key={suggestion.id || index}
                  className={`p-2 text-sm text-white hover:${colors.hover} cursor-pointer border-b ${colors.borderLight} last:border-b-0`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent textarea from losing focus
                    handleMentionSelect(suggestion);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMentionSelect(suggestion);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate flex-1">{suggestion.name}</span>
                    <span className={`text-xs text-white ml-2`}>
                      {suggestion.source === 'github' ? '📁' : 
                       suggestion.source === 'cloud' ? '☁️' : '💻'}
                    </span>
                  </div>
                  {suggestion.path !== suggestion.name && (
                    <div className={`text-xs text-white truncate mt-1`}>
                      {suggestion.path}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className={`p-3 text-sm text-white text-center`}>
                No {mentionType} files found
              </div>
            )}
          </div>
        )}
        
        {/* Excel rows dropdown */}
        {excelRowsDropdown && (
          <div 
            data-excel-dropdown="true"
            className={`absolute z-50 ${colors.secondary} ${colors.border} border rounded-lg shadow-lg mt-1 min-w-[400px] max-h-[400px] overflow-hidden`}
            style={{
              top: 'auto',
              bottom: '100%',
              left: '1rem',
              marginBottom: '0.5rem'
            }}
          >
            {/* Header */}
            <div className={`p-3 text-sm ${colors.text} border-b ${colors.borderLight}`}>
              <div className="font-medium">Select data from: {excelRowsDropdown.fileName}</div>
              <div className={`text-xs ${colors.textMuted} mt-1`}>
                Choose sheet and row to include in context
              </div>
            </div>
            
            {/* Sheet tabs */}
            <div className={`flex ${colors.tertiary} border-b ${colors.borderLight} overflow-x-auto`}>
              {excelRowsDropdown.sheetNames.map((sheetName, index) => (
                <button
                  key={sheetName}
                  onClick={() => handleExcelSheetChange(sheetName)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-r ${colors.borderLight} last:border-r-0 ${
                    sheetName === excelRowsDropdown.activeSheet
                      ? `${colors.accent} ${colors.secondary}`
                      : `${colors.textSecondary} hover:${colors.text} hover:${colors.hover}`
                  }`}
                >
                  {sheetName}
                </button>
              ))}
            </div>
            
            {/* Data rows */}
            <div className="max-h-[250px] overflow-y-auto">
              {(() => {
                const currentSheet = excelRowsDropdown.sheetsData[excelRowsDropdown.activeSheet];
                if (!currentSheet || !currentSheet.rows || currentSheet.rows.length === 0) {
                  return (
                    <div className={`p-4 text-sm ${colors.textMuted} text-center`}>
                      No data found in this sheet
                    </div>
                  );
                }
                
                const { headers, rows } = currentSheet;
                return (
                  <>
                    {/* Show all data rows */}
                    {rows.map((row, rowIndex) => (
                      <div 
                        key={rowIndex}
                        className={`p-3 border-b ${colors.borderLight} last:border-b-0 hover:${colors.hover} cursor-pointer`}
                        onClick={() => handleExcelRowSelect(row, rowIndex, excelRowsDropdown.activeSheet)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-medium ${colors.textMuted}`}>Row {rowIndex + 1}</span>
                          <span className={`text-xs ${colors.accent}`}>Click to select</span>
                        </div>
                        
                        {/* Show row data as key-value pairs */}
                        <div className="space-y-1">
                          {row.map((cell, cellIndex) => {
                            const header = headers[cellIndex] || `Column ${cellIndex + 1}`;
                            if (!cell && cell !== 0) return null; // Skip empty cells
                            
                            return (
                              <div key={cellIndex} className="flex">
                                <span className={`text-xs ${colors.textSecondary} min-w-[100px] mr-2 font-medium`}>
                                  {header}:
                                </span>
                                <span className={`text-xs ${colors.text} flex-1`}>
                                  {cell}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
            
            {/* Footer */}
            <div className={`p-2 ${colors.tertiary} border-t ${colors.borderLight} flex justify-end`}>
              <button
                onClick={() => {
                  setExcelRowsDropdown(null);
                  setSelectedExcelFile(null);
                }}
                className={`px-3 py-1 text-xs ${colors.textSecondary} hover:${colors.text}`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* Code lines dropdown */}
        {codeLinesDropdown && (
          <div 
            data-code-dropdown="true"
            className={`absolute z-50 ${colors.secondary} ${colors.border} border rounded-lg shadow-lg mt-1 min-w-[500px] max-h-[400px] overflow-hidden`}
            style={{
              top: 'auto',
              bottom: '100%',
              left: '1rem',
              marginBottom: '0.5rem'
            }}
          >
            {/* Header */}
            <div className={`p-2 text-xs border-b ${colors.borderLight}`}>
              <div className="font-medium text-white">Select lines from: {codeLinesDropdown.fileName}</div>
              <div className={`text-xs text-white mt-1`}>
                Click lines to select • Shift+click for ranges • {selectedLines.length} selected
              </div>
            </div>
            
            {/* Code lines */}
            <div className="max-h-[280px] overflow-y-auto">
              {(() => {
                const lines = codeLinesDropdown.lines;
                if (!lines || lines.length === 0) {
                  return (
                    <div className={`p-3 text-xs text-white text-center`}>
                      No content found in this file
                    </div>
                  );
                }
                
                return (
                  <>
                    {lines.map((line, lineIndex) => {
                      const lineNumber = lineIndex + 1;
                      const isSelected = selectedLines.includes(lineNumber);
                      
                      return (
                        <div 
                          key={lineIndex}
                          className={`px-2 py-1 border-b ${colors.borderLight} last:border-b-0 cursor-pointer flex items-center ${
                            isSelected 
                              ? `${colors.secondary} border-l-2 ${colors.border}` 
                              : `hover:${colors.hover}`
                          }`}
                          onClick={(e) => handleLineClick(lineNumber, e)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center flex-1 min-w-0">
                              <span className={`text-xs min-w-[35px] mr-2 font-mono text-right ${
                                isSelected ? 'text-white' : 'text-white'
                              }`}>
                                {lineNumber}
                              </span>
                              <span className={`text-xs font-mono flex-1 truncate text-white`}>
                                {line || ' '}
                              </span>
                            </div>
                            {isSelected && (
                              <span className={`text-xs text-white ml-2`}>
                                •
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            
            {/* Footer with action buttons */}
            <div className={`p-2 ${colors.tertiary} border-t ${colors.borderLight} flex justify-between items-center`}>
              <div className={`text-xs text-white`}>
                {selectedLines.length > 0 && (
                  <span>
                    Line{selectedLines.length > 1 ? 's' : ''} {Math.min(...selectedLines)}{selectedLines.length > 1 ? `-${Math.max(...selectedLines)}` : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCodeLinesDropdown(null);
                    setSelectedCodeFile(null);
                    setSelectedLines([]);
                    setLastSelectedLine(null);
                  }}
                  className={`px-2 py-1 text-xs text-white hover:text-gray-300 rounded`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLineSelection}
                  disabled={selectedLines.length === 0}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedLines.length === 0 
                      ? `text-gray-500 cursor-not-allowed` 
                      : `text-white ${colors.secondary} border ${colors.borderLight} hover:${colors.hover}`
                  }`}
                >
                  Add Lines
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Toast Notification */}
        {toast && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[10000]">
            <div 
              className={`mx-4 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium max-w-sm pointer-events-auto animate-fade-in ${
                toast.type === 'warning' 
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200'
                  : toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200'
                  : toast.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-200'
                  : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200'
              }`}
              style={{
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <div className="flex items-center justify-between">
                <span>{toast.message}</span>
                <button
                  onClick={() => setToast(null)}
                  className="ml-3 text-current opacity-70 hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
