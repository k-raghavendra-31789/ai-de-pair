import React, { useState, useRef, useEffect, useCallback } from 'react';
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
    setActiveTab,
    addMemoryFile,
    updateTabs,
    updateMemoryFile
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
  
  // Chat Messages State
  const [chatMessages, setChatMessages] = useState([]);
  const [activeGenerationId, setActiveGenerationId] = useState(null);
  const [sseConnection, setSseConnection] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [processingStrategy, setProcessingStrategy] = useState(null); // Store strategy selection
  
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const sseRef = useRef(null);
  
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

  // SSE Connection Management
  const startSSEConnection = (sessionId, generationId) => {
    console.log(`🔥 Starting SSE connection for session: ${sessionId}`);
    
    // Close existing connection if any
    if (sseConnection) {
      sseConnection.close();
    }
    
    const eventSource = new EventSource(`http://localhost:8000/api/v1/data/session/${sessionId}/stream`);
    
    eventSource.onopen = () => {
      console.log('✅ SSE Connection opened successfully');
      console.log('🔗 SSE URL:', `http://localhost:8000/api/v1/data/session/${sessionId}/stream`);
      console.log('🔗 Session ID:', sessionId);
      console.log('🔗 Generation ID:', generationId);
    };
    
    eventSource.onmessage = (event) => {
      console.log('🚨 SSE EVENT RECEIVED - Raw data:', event.data);
      console.log('🚨 SSE EVENT RECEIVED - Event object:', event);
      
      try {
        console.log('🔧 Raw SSE event data:', event.data);
        const data = JSON.parse(event.data);
        console.log('📡 SSE Event received:', data);
        console.log('📊 Event details - Type:', data.event_type, 'Stage:', data.data?.stage, 'Status:', data.data?.status);
        
        // Handle connection closing event - this is the final event
        if (data.event_type === 'connection_closing') {
          console.log('🔌 Received connection_closing event - closing SSE');
          if (eventSource.completionTimeoutId) {
            clearTimeout(eventSource.completionTimeoutId);
          }
          if (eventSource.debugInterval) {
            clearInterval(eventSource.debugInterval);
          }
          eventSource.close();
          setSseConnection(null);
          return;
        }
        
        console.log('🏗️ Column tracking data:', data.data?.column_tracking);
        console.log('📋 Field tracking data:', data.data?.field_tracking);
        console.log('🔍 Checking for extracted_sql:', data.data?.extracted_sql, data.extracted_sql);
        console.log('🔍 Full event data structure:', JSON.stringify(data, null, 2));
        
        // Handle completion event with SQL result - check multiple completion indicators
        // Check for nested message structure first (your backend format)
        const extractedSQL = data.message?.data?.extracted_sql || 
                           data.data?.extracted_sql || 
                           data.extracted_sql;
        
        // Check completion indicators in nested structure
        const isCompleted = extractedSQL || 
                           data.message?.status === 'success' ||
                           data.message?.event_type === 'completion' ||
                           data.message?.processing_status === 'completed' ||
                           data.data?.status === 'completed' || 
                           data.status === 'completed' ||
                           data.event_type === 'completion' ||
                           data.event_type === 'single_pass_processing_complete' ||
                           (typeof data.message === 'string' && data.message?.includes('completed successfully')) ||
                           (typeof data.message?.message === 'string' && data.message?.message?.includes('completed successfully'));
        
        console.log('🎯 Completion check - extractedSQL:', !!extractedSQL, 'isCompleted:', isCompleted);
        console.log('🔍 Detailed completion check:');
        console.log('  - data.message?.data?.extracted_sql:', data.message?.data?.extracted_sql ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.data?.extracted_sql:', data.data?.extracted_sql ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.extracted_sql:', data.extracted_sql ? 'FOUND' : 'NOT FOUND'); 
        console.log('  - data.message?.status:', data.message?.status);
        console.log('  - data.message?.event_type:', data.message?.event_type);
        console.log('  - data.message?.processing_status:', data.message?.processing_status);
        console.log('  - data.event_type:', data.event_type);
        console.log('  - message object type:', typeof data.message);
        
        if (isCompleted && extractedSQL) {
          console.log('🎉 SQL extraction completed:', extractedSQL);
          console.log('🔄 Updating progress to complete and adding SQL result...');
          
          // Update progress to completed state first
          setChatMessages(prev => {
            const existingIndex = prev.findIndex(msg => 
              msg.type === 'progress' && msg.generationId === generationId
            );
            
            console.log('📍 Found progress message at index:', existingIndex);
            
            if (existingIndex >= 0) {
              const completedProgressMessage = {
                ...prev[existingIndex],
                metadata: {
                  ...prev[existingIndex].metadata,
                  currentStage: 'complete',
                  stageStatus: 'completed'
                }
              };
              const newMessages = [...prev];
              newMessages[existingIndex] = completedProgressMessage;
              console.log('✅ Updated progress message to complete');
              return newMessages;
            }
            return prev;
          });
          
          // Create SQL file immediately and start streaming
          console.log('➕ Creating in-memory SQL file and streaming to MainEditor');
          
          // Create unique identifiers
          const timestamp = Date.now();
          const memoryFileId = `sql_chat_${generationId}_${timestamp}`;
          const fileName = `chat-generated-sql-${timestamp}.sql`;
          
          console.log('📄 Creating memory file with ID:', memoryFileId, 'name:', fileName);
          console.log('📝 SQL content length:', extractedSQL.length);
          console.log('📝 SQL content preview:', extractedSQL.substring(0, 100) + '...');
          
          // Create in-memory file with empty content initially
          addMemoryFile(memoryFileId, fileName, '', 'sql', false);
          console.log('✅ Empty memory file created, starting stream...');
          
          // Create new tab for the SQL file
          const newTab = {
            id: `tab_${timestamp}`,
            name: fileName,
            type: 'memory',
            fileId: memoryFileId,
            isGenerated: false,
            isDirty: false,
            metadata: {
              source: 'chat',
              generationId,
              modelUsed: data.message?.data?.model_used || data.data?.model_used || data.model_used,
              processingStrategy: data.message?.data?.processing_strategy || data.data?.processing_strategy || data.processing_strategy,
              completionMessage: data.message?.message || data.message || 'SQL generation completed'
            }
          };
          
          console.log('📑 Creating new tab:', newTab);
          
          // Add tab and set it as active
          addTab(newTab);
          console.log('✅ Tab added to state');
          
          setActiveTab(newTab.id);
          console.log('✅ Active tab set to:', newTab.id);
          
          // Start streaming the SQL content
          streamSQLContent(memoryFileId, extractedSQL);
          
          console.log('✅ SQL file created and streaming initiated:', fileName);
          
          // Note: Don't close SSE here - wait for connection_closing event
          return;
        } else if (isCompleted && !extractedSQL) {
          console.log('⚠️ Completion detected but no extracted SQL found');
          console.log('🔍 Searching for SQL in other event fields...');
          
          // Try to find SQL in other possible locations
          const possibleSQL = data.message?.data?.extracted_sql || 
                             data.message?.data?.sql || 
                             data.message?.data?.query || 
                             data.message?.data?.result ||
                             data.sql || data.query || data.result || 
                             data.data?.sql || data.data?.query || data.data?.result ||
                             data.data?.generated_sql || data.generated_sql;
          
          if (possibleSQL) {
            console.log('✨ Found SQL in alternative location:', possibleSQL);
            
            // Use the found SQL and create the file with streaming
            const timestamp = Date.now();
            const memoryFileId = `sql_chat_${generationId}_${timestamp}`;
            const fileName = `chat-generated-sql-${timestamp}.sql`;
            
            // Create empty memory file initially
            addMemoryFile(memoryFileId, fileName, '', 'sql', false);
            
            const newTab = {
              id: `tab_${timestamp}`,
              name: fileName,
              type: 'memory',
              fileId: memoryFileId,
              isGenerated: false,
              isDirty: false,
              metadata: {
                source: 'chat',
                generationId,
                modelUsed: data.message?.data?.model_used || data.data?.model_used || data.model_used,
                processingStrategy: data.message?.data?.processing_strategy || data.data?.processing_strategy || data.processing_strategy,
                completionMessage: data.message?.message || data.message || 'SQL generation completed'
              }
            };
            
            addTab(newTab);
            setActiveTab(newTab.id);
            
            // Start streaming the alternative SQL content
            streamSQLContent(memoryFileId, possibleSQL);
            
            console.log('✅ SQL file created from alternative field with streaming:', fileName);
            return;
          } else {
            console.log('❌ No SQL found in any event fields');
          }
          // Handle case where completion is indicated but no SQL is present
          console.log('⚠️ Completion detected but no extracted SQL found');
          console.log('🔄 Marking progress as complete anyway...');
          
          setChatMessages(prev => {
            const existingIndex = prev.findIndex(msg => 
              msg.type === 'progress' && msg.generationId === generationId
            );
            
            if (existingIndex >= 0) {
              const completedProgressMessage = {
                ...prev[existingIndex],
                metadata: {
                  ...prev[existingIndex].metadata,
                  currentStage: 'complete',
                  stageStatus: 'completed'
                }
              };
              const newMessages = [...prev];
              newMessages[existingIndex] = completedProgressMessage;
              
              // Add an error message about no SQL being generated
              newMessages.push({
                id: `error_${Date.now()}`,
                type: 'text',
                content: 'Processing completed but no SQL was generated. Please try rephrasing your question.',
                timestamp: new Date().toISOString(),
                generationId,
                metadata: {
                  messageType: 'error',
                  completionMessage: data.message
                }
              });
              
              return newMessages;
            }
            return prev;
          });
          
          // Note: Don't close SSE here - wait for connection_closing event
          return;
        }
        
        // Update existing progress message or create new one
        setChatMessages(prev => {
          console.log('🔄 Updating chat messages with SSE data, current messages count:', prev.length);
          // Find existing progress message for this generation
          const existingIndex = prev.findIndex(msg => 
            msg.type === 'progress' && msg.generationId === generationId
          );
          
          console.log('🔍 Existing progress message index:', existingIndex);
          
          // Determine current stage based on status
          let currentStage = data.data?.stage || data.event_type;
          let stageStatus = data.data?.status || 'in_progress';
          
          // Map backend stage names to frontend stage names
          const stageMapping = {
            'analyzing': 'analyzing',
            'parsing': 'parsing_file',
            'generating_joins': 'generating_joins',
            'generating_filters': 'generating_filters', 
            'generating_select': 'generating_select',
            'combining': 'combining',
            'complete': 'complete',
            // Single pass mapping
            'generating_sql': 'generating_sql'
          };
          
          let mappedStage = stageMapping[currentStage] || currentStage;
          
          // For single_pass strategy, map multi-stage events to simplified stages
          if (processingStrategy === 'single_pass') {
            const singlePassMapping = {
              'parsing_file': 'generating_sql',
              'generating_joins': 'generating_sql',
              'generating_filters': 'generating_sql',
              'generating_select': 'generating_sql',
              'combining': 'generating_sql'
            };
            mappedStage = singlePassMapping[mappedStage] || mappedStage;
          }
          console.log('🎯 Mapped stage:', currentStage, '→', mappedStage, 'Status:', stageStatus, 'Strategy:', processingStrategy);
          
          const progressMessage = {
            id: existingIndex >= 0 ? prev[existingIndex].id : `progress_${Date.now()}`,
            type: 'progress',
            content: data.message || 'Processing...',
            timestamp: data.timestamp || new Date().toISOString(),
            generationId,
            metadata: {
              eventType: data.event_type,
              currentStage: mappedStage,
              stageStatus: stageStatus,
              processingStatus: data.data?.processing_status,
              totalFields: data.data?.total_fields,
              processedFields: data.data?.processed_fields,
              columnTracking: data.data?.column_tracking,
              fieldTracking: data.data?.field_tracking,
              sessionId: sessionId,
              processingStrategy: existingIndex >= 0 ? prev[existingIndex].metadata?.processingStrategy : processingStrategy
            }
          };
          
          if (existingIndex >= 0) {
            console.log('✏️ Updating existing progress message at index:', existingIndex);
            // Update existing progress message
            const newMessages = [...prev];
            newMessages[existingIndex] = progressMessage;
            return newMessages;
          } else {
            console.log('➕ Creating new progress message');
            // Create new progress message
            return [...prev, progressMessage];
          }
        });
        
      } catch (error) {
        console.error('❌ Error parsing SSE data:', error);
        console.error('🔧 Raw event data that failed to parse:', event.data);
        console.error('🔧 Event type:', typeof event.data);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('🔥 SSE Error:', error);
      if (eventSource.completionTimeoutId) {
        clearTimeout(eventSource.completionTimeoutId);
      }
      if (eventSource.debugInterval) {
        clearInterval(eventSource.debugInterval);
      }
      eventSource.close();
      setSseConnection(null);
    };
    
    setSseConnection(eventSource);
    
    // Debug: Periodically log SSE connection status
    const debugInterval = setInterval(() => {
      console.log('🔍 SSE Connection Status:', {
        readyState: eventSource.readyState,
        url: eventSource.url,
        sessionId: sessionId,
        generationId: generationId,
        connectionStates: {
          0: 'CONNECTING',
          1: 'OPEN', 
          2: 'CLOSED'
        }[eventSource.readyState]
      });
    }, 2000);
    
    // Store interval ID for cleanup
    eventSource.debugInterval = debugInterval;
    
    // Also add a safety timeout to handle cases where completion event might be missed
    const completionTimeoutId = setTimeout(() => {
      console.log('⏰ Completion timeout reached - checking for completion...');
      
      // Check if there were any code messages generated for this generation
      setChatMessages(prev => {
        const hasCodeMessage = prev.some(msg => 
          msg.generationId === generationId && msg.type === 'code'
        );
        
        if (hasCodeMessage) {
          console.log('✅ Found code message, assuming completion is handled');
          return prev;
        }
        
        // Check if progress is still showing
        const progressIndex = prev.findIndex(msg => 
          msg.type === 'progress' && msg.generationId === generationId
        );
        
        if (progressIndex >= 0 && prev[progressIndex].metadata?.currentStage !== 'complete') {
          console.log('⚠️ Progress still showing, forcing completion...');
          const completedProgressMessage = {
            ...prev[progressIndex],
            metadata: {
              ...prev[progressIndex].metadata,
              currentStage: 'complete',
              stageStatus: 'completed'
            }
          };
          const newMessages = [...prev];
          newMessages[progressIndex] = completedProgressMessage;
          return newMessages;
        }
        
        return prev;
      });
    }, 30000); // 30 second timeout

    // Store timeout ID for cleanup
    eventSource.completionTimeoutId = completionTimeoutId;
  };

  // SQL Content Streaming Function
  const streamSQLContent = useCallback((memoryFileId, fullSQLContent) => {
    console.log('🚀 Starting SQL content streaming:', memoryFileId);
    
    // Split content into manageable chunks (words or lines)
    const lines = fullSQLContent.split('\n');
    let currentContent = '';
    let lineIndex = 0;
    
    const streamNextLine = () => {
      if (lineIndex < lines.length) {
        // Add the next line
        currentContent += (lineIndex > 0 ? '\n' : '') + lines[lineIndex];
        
        // Update memory file with current content
        updateMemoryFile(memoryFileId, currentContent);
        
        console.log(`📝 Streamed line ${lineIndex + 1}/${lines.length}:`, lines[lineIndex]);
        
        lineIndex++;
        
        // Schedule next line with a slight delay for streaming effect
        setTimeout(streamNextLine, 50); // 50ms delay between lines
      } else {
        console.log('✅ SQL streaming completed');
      }
    };
    
    // Start streaming after a small initial delay
    setTimeout(streamNextLine, 100);
  }, [updateMemoryFile]);

  // Clean up SSE connection on unmount
  useEffect(() => {
    return () => {
      if (sseConnection) {
        if (sseConnection.completionTimeoutId) {
          clearTimeout(sseConnection.completionTimeoutId);
        }
        if (sseConnection.debugInterval) {
          clearInterval(sseConnection.debugInterval);
        }
        sseConnection.close();
      }
    };
  }, [sseConnection]);

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

    // For @file mentions, extract full content if it's an Excel file
    if (selectedFile.type === 'file' && isExcelFile(selectedFile.name)) {
      const excelData = getExcelDataForFile(selectedFile.name);
      if (excelData) {
        // Convert Excel data to JSON format with full content
        const fullExcelContent = {
          fileName: selectedFile.name,
          sheets: {}
        };
        
        // Extract all sheets and their data
        excelData.sheetNames.forEach(sheetName => {
          const sheetData = excelData.sheetsData[sheetName];
          fullExcelContent.sheets[sheetName] = {
            headers: sheetData.headers,
            rows: sheetData.rows,
            totalRows: sheetData.totalRows
          };
        });
        
        // Add the full Excel content to the mention
        mention.fileContent = {
          type: 'excel',
          content: fullExcelContent,
          contentString: JSON.stringify(fullExcelContent, null, 2)
        };
      }
    }
    
    // For @file mentions, extract full content if it's a code file
    if (selectedFile.type === 'file' && isCodeFile(selectedFile.name)) {
      const codeContent = getCodeContentForFile(selectedFile.name);
      if (codeContent) {
        mention.fileContent = {
          type: 'code',
          content: codeContent,
          contentString: codeContent,
          totalLines: codeContent.split('\n').length
        };
      }
    }
    
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
      
      // Console log file attachment content for debugging
      if (selectedMentions.length > 0) {
        console.log('=== FILE ATTACHMENTS BEING SENT ===');
        selectedMentions.forEach((mention, index) => {
          console.log(`\nAttachment ${index + 1}:`);
          console.log(`  Type: ${mention.type}`);
          console.log(`  Name: ${mention.name}`);
          console.log(`  Path: ${mention.path || 'N/A'}`);
          console.log(`  Source: ${mention.source || 'N/A'}`);
          console.log(`  IsGitHub: ${mention.isGitHub || false}`);
          console.log(`  IsCloud: ${mention.isCloud || false}`);
          
          if (mention.excelData) {
            console.log(`  Excel Data:`);
            console.log(`    Sheet: ${mention.excelData.sheetName}`);
            console.log(`    Row Index: ${mention.excelData.rowIndex}`);
            console.log(`    Headers:`, mention.excelData.headers);
            console.log(`    Row Data:`, mention.excelData.rowData);
          } else if (mention.codeData) {
            console.log(`  Code Data:`);
            console.log(`    Lines: ${mention.codeData.startLine}-${mention.codeData.endLine}`);
            console.log(`    Total Lines: ${mention.codeData.totalLines}`);
            console.log(`    Content:\n${mention.codeData.content}`);
          } else if (mention.type === 'file') {
            console.log(`  File Data:`);
            
            // Check if we have extracted file content
            if (mention.fileContent) {
              console.log(`    ✅ Full File Content Extracted!`);
              console.log(`    Content Type: ${mention.fileContent.type}`);
              
              if (mention.fileContent.type === 'excel') {
                const excelContent = mention.fileContent.content;
                console.log(`    📊 Excel Content Summary:`);
                console.log(`    File: ${excelContent.fileName}`);
                console.log(`    Sheets: ${Object.keys(excelContent.sheets).join(', ')}`);
                
                Object.keys(excelContent.sheets).forEach(sheetName => {
                  const sheet = excelContent.sheets[sheetName];
                  console.log(`    Sheet "${sheetName}":`);
                  console.log(`      Headers: [${sheet.headers.join(', ')}]`);
                  console.log(`      Total Rows: ${sheet.totalRows}`);
                  if (sheet.rows.length > 0) {
                    console.log(`      First Row: [${sheet.rows[0].join(', ')}]`);
                  }
                });
                
                console.log(`    📄 JSON String Length: ${mention.fileContent.contentString.length} characters`);
                console.log(`    📋 Full JSON Content:`);
                console.log(mention.fileContent.contentString);
                
              } else if (mention.fileContent.type === 'code') {
                console.log(`    💻 Code Content Summary:`);
                console.log(`    Total Lines: ${mention.fileContent.totalLines}`);
                console.log(`    Content Length: ${mention.fileContent.content.length} characters`);
                console.log(`    📄 Full Code Content:`);
                console.log(mention.fileContent.content);
              }
            } else {
              console.log(`    ⚠️  No content extracted - file may not be loaded in memory or unsupported type`);
            }
          } else {
            console.log(`  ⚠️  Unknown attachment type or no content data`);
          }
        });
        console.log('=== END FILE ATTACHMENTS ===\n');
      }

      // Send Excel JSON data to backend if available
      const excelAttachments = selectedMentions.filter(mention => 
        mention.type === 'file' && 
        mention.fileContent && 
        mention.fileContent.type === 'excel'
      );

      if (excelAttachments.length > 0) {
        console.log('🚀 Sending Excel data to backend...');
        
        excelAttachments.forEach(async (attachment, index) => {
          try {
            // Send the Excel content directly as JSON string
            const payload = attachment.fileContent.contentString;

            console.log(`📤 Sending Excel file ${index + 1}: ${attachment.name}`);
            console.log('📦 JSON Payload Length:', payload.length, 'characters');
            console.log('📋 JSON Content Preview:', payload.substring(0, 500) + '...');

            const response = await fetch('http://localhost:8000/api/v1/data/upload-excel-json', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: payload
            });

            console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
              const responseData = await response.json();
              console.log('✅ Backend Response Success:', responseData);
              
              // Handle the backend response with question
              if (responseData.status === 'success' && responseData.question) {
                setTimeout(() => {
                  const questionMessage = {
                    id: `question_${Date.now()}`,
                    type: 'question',
                    content: responseData.question.question,
                    timestamp: new Date().toISOString(),
                    generationId,
                    metadata: {
                      sessionId: responseData.session_id,
                      questionId: responseData.question.question_id,
                      questionType: responseData.question.question_type,
                      options: responseData.question.options,
                      required: responseData.question.required,
                      description: responseData.question.description,
                      dataSummary: responseData.data_summary
                    }
                  };
                  setChatMessages(prev => [...prev, questionMessage]);
                }, 200);
              }
            } else {
              const errorText = await response.text();
              console.error('❌ Backend Response Error:', errorText);
            }
          } catch (error) {
            console.error('🔥 Network Error sending Excel data:', error);
          }
        });
      }
      
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
          codeData: mention.codeData || null,
          fileContent: mention.fileContent || null
        }))
      };
      
      setChatMessages(prev => [...prev, userMessage]);
      
      // Clear input and mentions
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
          <div className="text-sm">{typeof message.content === 'string' ? message.content : 'Message'}</div>
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
          <div className={`text-sm ${colors.text}`}>{typeof message.content === 'string' ? message.content : 'AI Response'}</div>
        </div>
        <div className={`text-xs ${colors.textMuted} mt-1`}>
          AI Assistant • {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );

  const renderProgressMessage = (message) => {
    const { eventType, processingStatus, totalFields, currentStage, stageStatus, columnTracking, fieldTracking, processingStrategy } = message.metadata || {};
    
    // Use currentStage from metadata
    const activeStage = currentStage;
    
    // Define progress stages based on processing strategy
    const getStagesForStrategy = (strategy) => {
      if (strategy === 'single_pass') {
        return [
          { id: "analyzing", label: "Analyzing", number: 1 },
          { id: "generating_sql", label: "Generating SQL", number: 2 },
          { id: "complete", label: "Complete", number: 3 }
        ];
      } else {
        // multi_pass or default
        return [
          { id: "analyzing", label: "Analyzing", number: 1 },
          { id: "parsing_file", label: "Parsing file", number: 2 },
          { id: "generating_joins", label: "Generating joins", number: 3 },
          { id: "generating_filters", label: "Generating filters", number: 4 },
          { id: "generating_select", label: "Generating select", number: 5 },
          { id: "combining", label: "Combining", number: 6 },
          { id: "complete", label: "Complete", number: 7 }
        ];
      }
    };
    
    const stages = getStagesForStrategy(processingStrategy);
    console.log('🎯 Using stages for strategy:', processingStrategy, stages);
    
    const getStageStatus = (stageId) => {
      const currentIndex = stages.findIndex(s => s.id === activeStage);
      const stageIndex = stages.findIndex(s => s.id === stageId);
      
      // Debug logging
      console.log(`🔍 Stage ${stageId}: currentStage=${activeStage}, stageStatus=${stageStatus}, currentIndex=${currentIndex}, stageIndex=${stageIndex}`);
      
      if (stageId === activeStage) {
        // Current active stage - check if completed or in progress
        const status = stageStatus === 'completed' ? 'complete' : 'active';
        console.log(`🎯 Current stage ${stageId} status: ${status}`);
        return status;
      } else if (stageIndex < currentIndex) {
        // All previous stages are always complete when we've moved past them
        console.log(`✅ Previous stage ${stageId}: complete`);
        return 'complete';
      } else if (stageIndex === currentIndex && stageStatus === 'completed') {
        // Current stage is completed
        console.log(`🏁 Current completed stage ${stageId}: complete`);
        return 'complete';
      } else {
        // Future stages are pending
        console.log(`⏳ Future stage ${stageId}: pending`);
        return 'pending';
      }
    };

    // Calculate overall progress percentage based on completed stages
    const currentStageIndex = stages.findIndex(s => s.id === activeStage);
    let progressPercentage = 0;
    
    if (currentStageIndex >= 0) {
      // Add completed stages
      progressPercentage = (currentStageIndex / stages.length) * 100;
      
      // Add partial progress for current stage if completed
      if (stageStatus === 'completed') {
        progressPercentage += (1 / stages.length) * 100;
      } else if (stageStatus === 'in_progress') {
        // Add partial progress for in-progress stage
        progressPercentage += (0.5 / stages.length) * 100;
      }
    }
    
    progressPercentage = Math.round(progressPercentage);

    // Process column tracking data
    const getColumnStats = () => {
      if (!columnTracking) return null;
      
      const columns = Object.entries(columnTracking);
      const totalColumns = columns.length;
      const completedColumns = columns.filter(([_, column]) => column.status === 'completed').length;
      const processingColumns = columns.filter(([_, column]) => column.status === 'processing').length;
      const pendingColumns = columns.filter(([_, column]) => column.status === 'pending').length;
      const errorColumns = columns.filter(([_, column]) => column.status === 'error').length;
      
      return {
        total: totalColumns,
        completed: completedColumns,
        processing: processingColumns,
        pending: pendingColumns,
        error: errorColumns,
        columns: columns
      };
    };

    const columnStats = getColumnStats();

    return (
      <div key={message.id} className="flex justify-start mb-3">
        <div className="max-w-[90%] w-full border border-gray-600 rounded-lg p-3 bg-gray-800/50">
          {/* Progress indicator with stages */}
          <div className="mb-3">
            <div className="relative flex items-center justify-between mb-2 px-2 sm:px-4" style={{ height: '70px' }}>
              {/* Background connection line */}
              <div className="absolute top-1/2 left-4 right-4 sm:left-6 sm:right-6 h-0.5 bg-gray-600 transform -translate-y-1/2"></div>
              
              {stages.map((stage, index) => {
                const status = getStageStatus(stage.id);
                const isTop = index % 2 === 0;
                
                return (
                  <div key={stage.id} className="relative flex flex-col items-center z-10">
                    {/* Label on top for even indices */}
                    {isTop && (
                      <span className={`text-xs mb-3 text-white font-normal text-center leading-tight ${
                        status === 'active' ? 'opacity-100' : 'opacity-60'
                      }`}>
                        {stage.label}
                      </span>
                    )}
                    
                    {/* Circle with number */}
                    <div className={`w-4 h-4 rounded-full border transition-all duration-300 flex items-center justify-center text-xs font-medium ${
                      status === 'complete'
                        ? 'bg-green-600 text-white border-green-500' 
                        : status === 'active' && stageStatus === 'in_progress'
                        ? 'bg-blue-500 text-white border-blue-400 animate-pulse'
                        : status === 'active' && stageStatus === 'completed'
                        ? 'bg-green-500 text-white border-green-400'
                        : status === 'active'
                        ? 'bg-blue-500 text-white border-blue-400'
                        : 'bg-gray-500 text-white border-gray-400'
                    }`}>
                      {status === 'complete' ? '✓' : stage.number}
                    </div>
                    
                    {/* Label on bottom for odd indices */}
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
            
            {/* Current stage message */}
            <div className="text-left px-2 mb-2">
              <span className="text-white text-sm font-medium border-b border-gray-500 pb-1 inline-block">
                {activeStage ? activeStage.replace('_', ' ').charAt(0).toUpperCase() + activeStage.replace('_', ' ').slice(1) : 'Processing...'}
                {stageStatus && (
                  <span className={`ml-2 text-xs px-2 py-1 rounded ${
                    stageStatus === 'completed' 
                      ? 'bg-green-600 text-white' 
                      : stageStatus === 'in_progress'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-white'
                  }`}>
                    {stageStatus === 'in_progress' ? 'In Progress' : stageStatus === 'completed' ? 'Completed' : stageStatus}
                  </span>
                )}
              </span>
              {activeStage && activeStage !== 'complete' && stageStatus === 'in_progress' && (
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse mt-1 ml-2"></span>
              )}
            </div>
          </div>
          
          {/* Description Box */}
          <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg px-3 py-2`}>
            <div className="text-white text-sm leading-relaxed">
              {typeof message.content === 'string' ? message.content : 'Processing...'}
            </div>
            
            {/* Field Level Progress */}
            {processingStatus && (
              <div className="text-gray-400 text-xs mt-2">
                Fields: {processingStatus.fields_completed}/{processingStatus.total_fields} completed
                {processingStatus.fields_processing > 0 && ` • ${processingStatus.fields_processing} processing`}
              </div>
            )}
            
            {/* Column Level Progress */}
            {columnStats && (
              <div className="text-gray-400 text-xs mt-1">
                <div className="flex items-center gap-4">
                  <span>Columns: {columnStats.completed}/{columnStats.total} completed</span>
                  {columnStats.processing > 0 && (
                    <span className="text-blue-400">{columnStats.processing} processing</span>
                  )}
                  {columnStats.error > 0 && (
                    <span className="text-red-400">{columnStats.error} errors</span>
                  )}
                </div>
                
                {/* Column Details */}
                {columnStats.columns.length > 0 && activeStage !== 'complete' && (
                  <div className="mt-2 max-h-24 overflow-y-auto">
                    {columnStats.columns.slice(0, 5).map(([columnKey, column]) => (
                      <div key={columnKey} className="flex items-center justify-between py-1 text-xs">
                        <span className="truncate max-w-[200px]" title={column.column_name}>
                          {column.column_name}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          column.status === 'completed' 
                            ? 'bg-green-600/20 text-green-400' 
                            : column.status === 'processing'
                            ? 'bg-blue-600/20 text-blue-400'
                            : column.status === 'error'
                            ? 'bg-red-600/20 text-red-400'
                            : 'bg-gray-600/20 text-gray-400'
                        }`}>
                          {column.status}
                        </span>
                      </div>
                    ))}
                    {columnStats.columns.length > 5 && (
                      <div className="text-xs text-gray-500 mt-1">
                        ... and {columnStats.columns.length - 5} more columns
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="text-gray-400 text-xs mt-1">
              {progressPercentage}% • {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionMessage = (message) => {
    const { options, description, questionType } = message.metadata || {};
    
    const handleOptionSelect = async (selectedOption) => {
      console.log('Selected option:', selectedOption);
      
      // Find the option object to get the label for display
      const optionObj = options.find(opt => 
        (typeof opt === 'object' && opt.value === selectedOption) || opt === selectedOption
      );
      const displayLabel = (typeof optionObj === 'object' && optionObj.label) ? optionObj.label : selectedOption;
      
      // Add user response message to show selection
      const userResponse = {
        id: `response_${Date.now()}`,
        type: 'user',
        content: displayLabel,
        timestamp: new Date().toISOString(),
        generationId: message.generationId
      };
      setChatMessages(prev => [...prev, userResponse]);
      
      // Send selection back to backend with session ID
      const { sessionId, questionId, questionType } = message.metadata;
      
      // Store processing strategy for SSE stage customization
      if (questionId === 3 && questionType === 'strategy_selection') {
        console.log('💾 Storing processing strategy:', selectedOption);
        setProcessingStrategy(selectedOption);
      }
      
      // Start SSE connection immediately for third question to catch all events
      if (questionId === 3) {
        console.log('🔥 Starting SSE for processing before third question submission');
        console.log('🎯 Selected strategy:', selectedOption);
        
        // Create initial progress message
        const initialProgressMessage = {
          id: `progress_${Date.now()}`,
          type: 'progress',
          content: 'Starting data analysis...',
          timestamp: new Date().toISOString(),
          generationId: message.generationId,
          metadata: {
            eventType: 'analyzing',
            currentStage: 'analyzing',
            stageStatus: 'in_progress',
            sessionId: sessionId,
            processingStrategy: selectedOption // Store strategy in progress message
          }
        };
        setChatMessages(prev => [...prev, initialProgressMessage]);
        
        // Start SSE connection and wait a bit for it to establish
        console.log('🚀 About to start SSE connection...');
        console.log('🚀 Session ID:', sessionId);
        console.log('🚀 Generation ID:', message.generationId);
        startSSEConnection(sessionId, message.generationId);
        console.log('🚀 SSE connection start call completed');
        
        // Small delay to ensure SSE connection is ready
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      try {
        const answerPayload = {
          question_id: questionId,
          answer: selectedOption,
          question_type: questionType
        };

        console.log(`🚀 Sending answer to session: ${sessionId}`);
        console.log('📦 Answer Payload:', answerPayload);

        const response = await fetch(`http://localhost:8000/api/v1/data/session/${sessionId}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(answerPayload)
        });

        console.log(`📡 Answer Response Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const responseData = await response.json();
          console.log('✅ Answer Response Success:', responseData);
          
          // Handle the next question or completion response
          if (responseData.status === 'success' && responseData.next_question) {
            // Next question received
            setTimeout(() => {
              const nextQuestionMessage = {
                id: `question_${Date.now()}`,
                type: 'question',
                content: responseData.next_question.question,
                timestamp: new Date().toISOString(),
                generationId: message.generationId,
                metadata: {
                  sessionId: sessionId, // Keep the same session ID
                  questionId: responseData.next_question.question_id,
                  questionType: responseData.next_question.question_type,
                  options: responseData.next_question.options,
                  required: responseData.next_question.required,
                  description: responseData.next_question.description
                }
              };
              setChatMessages(prev => [...prev, nextQuestionMessage]);
            }, 300);
          } else if (responseData.status === 'success' && responseData.question) {
            // Another question received (fallback for original structure)
            setTimeout(() => {
              const nextQuestionMessage = {
                id: `question_${Date.now()}`,
                type: 'question',
                content: responseData.question.question,
                timestamp: new Date().toISOString(),
                generationId: message.generationId,
                metadata: {
                  sessionId: sessionId, // Keep the same session ID
                  questionId: responseData.question.question_id,
                  questionType: responseData.question.question_type,
                  options: responseData.question.options,
                  required: responseData.question.required,
                  description: responseData.question.description
                }
              };
              setChatMessages(prev => [...prev, nextQuestionMessage]);
            }, 300);
          } else if (responseData.status === 'success' && responseData.message) {
            // Session completed - don't show completion message since we have progress tracking
            console.log('✅ Session completed:', responseData.message);
            // Note: We're not adding a completion message to chat since progress tracking handles the final state
          }
        } else {
          const errorText = await response.text();
          console.error('❌ Answer Response Error:', errorText);
          
          // Show error message in chat
          setTimeout(() => {
            const errorMessage = {
              id: `error_${Date.now()}`,
              type: 'ai',
              content: 'Sorry, there was an error processing your selection. Please try again.',
              timestamp: new Date().toISOString(),
              generationId: message.generationId
            };
            setChatMessages(prev => [...prev, errorMessage]);
          }, 300);
        }
      } catch (error) {
        console.error('🔥 Network Error sending answer:', error);
        
        // Show network error message in chat
        setTimeout(() => {
          const networkErrorMessage = {
            id: `network_error_${Date.now()}`,
            type: 'ai',
            content: 'Network error occurred. Please check your connection and try again.',
            timestamp: new Date().toISOString(),
            generationId: message.generationId
          };
          setChatMessages(prev => [...prev, networkErrorMessage]);
        }, 300);
      }
    };

    return (
      <div key={message.id} className="flex justify-start mb-4">
        <div className="max-w-[90%] w-full">
          <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg p-4`}>
            {/* Question Text */}
            <div className={`${colors.text} text-sm mb-3 leading-relaxed`}>
              {typeof message.content === 'string' ? message.content : 'Question'}
            </div>
            
            {/* Description */}
            {description && (
              <div className={`${colors.textSecondary} text-xs mb-4 italic`}>
                {description}
              </div>
            )}
            
            {/* Options as Chips/Tags */}
            {options && options.length > 0 && (
              <div className="flex flex-col gap-3">
                {options.map((option, index) => {
                  // Handle both string options and object options with label/description
                  const isObjectOption = typeof option === 'object' && option.label;
                  const optionValue = isObjectOption ? option.value : option;
                  const optionLabel = isObjectOption ? option.label : option;
                  const optionDescription = isObjectOption ? option.description : null;
                  
                  return (
                    <div key={index} className="w-full">
                      <button
                        onClick={() => handleOptionSelect(optionValue)}
                        className={`w-full px-4 py-3 rounded-lg text-left transition-all duration-200
                          bg-gray-700 text-gray-300 border border-gray-600
                          hover:bg-gray-600 hover:text-white hover:border-gray-500
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                          cursor-pointer`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-medium text-white">
                            {optionLabel}
                          </div>
                          {optionDescription && (
                            <div className="text-xs text-gray-400 leading-relaxed">
                              {optionDescription}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Timestamp */}
          <div className={`text-xs ${colors.textMuted} mt-1`}>
            Question • {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  const renderCodeMessage = (message) => {
    const { blockType, modelUsed, processingStrategy, completionMessage } = message.metadata || {};
    const isGeneratedSQL = completionMessage; // This indicates it's a final SQL result
    
    // Ensure completionMessage is a string
    const completionText = typeof completionMessage === 'string' 
      ? completionMessage 
      : typeof completionMessage === 'object' 
      ? JSON.stringify(completionMessage) 
      : 'Processing completed successfully';
    
    return (
      <div key={message.id} className="flex justify-start mb-4">
        <div className="max-w-[95%] w-full">
          {/* Completion message header for generated SQL */}
          {isGeneratedSQL && (
            <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg p-3 mb-3`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className={`${colors.text} text-sm font-medium`}>
                  🎉 {completionText}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                {modelUsed && (
                  <span>Model: <span className="text-blue-400">{String(modelUsed)}</span></span>
                )}
                {processingStrategy && (
                  <span>Strategy: <span className="text-green-400">{String(processingStrategy).replace('_', ' ')}</span></span>
                )}
              </div>
            </div>
          )}
          
          {/* SQL Code Block */}
          <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg overflow-hidden`}>
            <div className={`flex items-center justify-between px-4 py-2 ${colors.secondary} border-b ${colors.borderLight}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colors.successBg}`}></span>
                <span className={`${colors.text} text-xs font-mono`}>
                  {blockType?.replace('_', ' ').toUpperCase() || 'SQL'} 
                </span>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                  showToast('SQL copied to clipboard!', 'success');
                }}
                className={`${colors.textSecondary} hover:${colors.text} text-xs px-2 py-1 rounded transition-colors`}
              >
                Copy SQL
              </button>
            </div>
            <pre className={`p-4 text-sm font-mono overflow-x-auto leading-relaxed ${colors.text}`}>
              <code>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}</code>
            </pre>
          </div>
          <div className={`text-xs ${colors.textMuted} mt-1`}>
            {isGeneratedSQL ? 'Generated' : 'Code'} • {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  const renderMessage = (message) => {
    switch (message.type) {
      case 'user':
        return renderUserMessage(message);
      case 'ai':
        return renderAiMessage(message);
      case 'question':
        return renderQuestionMessage(message);
      case 'progress':
        return renderProgressMessage(message);
      case 'code':
        return renderCodeMessage(message);
      default:
        return null;
    }
  };

  // Cleanup effect for SSE
  useEffect(() => {
    return () => {
      if (sseRef.current) {
        console.log('🧹 Cleaning up SSE connection on unmount');
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, []);

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
