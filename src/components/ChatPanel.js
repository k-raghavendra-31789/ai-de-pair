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
    addMemoryFilePlaceholder,
    updateTabs,
    updateMemoryFile,
    startMemoryFileStreaming,
    endMemoryFileStreaming
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
  
  // Debug: Track all chat message changes
  const prevChatMessagesRef = useRef([]);
  useEffect(() => {
    const prev = prevChatMessagesRef.current;
    const current = chatMessages;
    
    if (prev.length !== current.length) {
      console.log(`🔄 CHAT MESSAGES CHANGED: ${prev.length} → ${current.length}`);
      if (current.length < prev.length) {
        console.log('🚨 MESSAGES DECREASED! This suggests messages were removed or cleared');
        console.log('🚨 Previous messages:', prev.map(m => ({ id: m.id, type: m.type })));
        console.log('🚨 Current messages:', current.map(m => ({ id: m.id, type: m.type })));
      } else {
        console.log('✅ Messages increased (normal)');
      }
    }
    
    prevChatMessagesRef.current = [...chatMessages];
  }, [chatMessages]);
  
  const [activeGenerationId, setActiveGenerationId] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null); // Track active session
  const [sqlGenerated, setSqlGenerated] = useState(false); // Track if SQL has been generated
  const [sseConnection, setSseConnection] = useState(null);
  const [progressData, setProgressData] = useState(null);
  
  // Handle force close SSE connection messages from MainEditor stop button
  useEffect(() => {
    const handleForceCloseSSE = (event) => {
      if (event.data?.type === 'FORCE_CLOSE_SSE_CONNECTION') {
        console.log('🛑 Received force close SSE message from MainEditor');
        if (sseConnection) {
          console.log('🔌 Closing active SSE connection...');
          sseConnection.close();
          setSseConnection(null);
          console.log('✅ SSE connection forcibly closed');
        } else {
          console.log('ℹ️ No active SSE connection to close');
        }
      }
    };
    
    window.addEventListener('message', handleForceCloseSSE);
    return () => window.removeEventListener('message', handleForceCloseSSE);
  }, [sseConnection]);
  const [completedProgressMessages, setCompletedProgressMessages] = useState(new Set()); // Track completed progress messages
  const [processingStrategy, setProcessingStrategy] = useState(null); // Store strategy selection
  const [sessionStrategy, setSessionStrategy] = useState(null); // Persist strategy for entire session
  const [outputFormat, setOutputFormat] = useState(null); // Store user's preferred output format (SQL, PySpark, Spark, Pandas)
  const [sessionOutputFormat, setSessionOutputFormat] = useState(null); // Persist output format for entire session
  
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const sseRef = useRef(null);

  // Drag and drop state (removed visual feedback)
  const [dragOver, setDragOver] = useState(false); // Keep state but don't change it to prevent blue flash
  
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
        console.log('📱 Loading messages from localStorage:', parsedMessages.length, 'messages');
        setChatMessages(parsedMessages);
      }
    } catch (error) {
      console.warn('Failed to load chat messages from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      console.log('💾 Saving messages to localStorage:', chatMessages.length, 'messages');
      console.log('💾 Message types breakdown:', chatMessages.reduce((acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1;
        return acc;
      }, {}));
      console.log('💾 All message IDs:', chatMessages.map(m => ({ id: m.id, type: m.type })));
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
    
    // Debug: Track any sudden message count changes
    if (chatMessages.length === 0 && localStorage.getItem('ai-de-chat-messages')) {
      console.log('🚨 WARNING: Messages array is empty but localStorage has data!');
      console.log('🚨 This suggests messages were cleared unexpectedly');
    }
  }, [chatMessages]);

  // Helper function to generate appropriate completion message based on strategy/content
  const generateCompletionMessage = (strategy, content) => {
    // Check for PySpark-specific indicators
    if (strategy?.toLowerCase().includes('pyspark') ||
        strategy?.toLowerCase().includes('python') ||
        content?.includes('pyspark') ||
        content?.includes('from pyspark') ||
        content?.includes('import pyspark')) {
      return 'PySpark code generation completed';
    }
    
    // Check for other Python/Pandas indicators
    if (strategy?.toLowerCase().includes('pandas') ||
        content?.includes('import pandas') ||
        content?.includes('pd.')) {
      return 'Pandas code generation completed';
    }
    
    // Check for Spark/Scala indicators
    if (strategy?.toLowerCase().includes('spark') ||
        content?.includes('import org.apache.spark')) {
      return 'Spark code generation completed';
    }
    
    // Default to SQL
    return 'SQL generation completed';
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const droppedData = e.dataTransfer.getData('text/plain');
      console.log('🎯 Dropped data:', droppedData);
      
      if (droppedData) {
        // Try to parse as JSON (from FileExplorer)
        try {
          const fileData = JSON.parse(droppedData);
          console.log('📁 Parsed file data:', fileData);
          
          await handleDroppedFile(fileData);
        } catch (parseError) {
          // Not JSON, treat as plain text
          console.log('📝 Plain text drop:', droppedData);
          showToast('Plain text drops are not supported yet. Please drag files from File Explorer.', 'warning');
        }
      }
    } catch (error) {
      console.error('❌ Error handling drop:', error);
      showToast('Error processing dropped file', 'error');
    }
  };

  const handleDroppedFile = async (fileData) => {
    try {
      console.log('🔍 Processing dropped file:', fileData);
      
      // Create a mention object from the dropped file data
      let mention = {
        id: `${fileData.name}-file-${Date.now()}-${Math.random()}`,
        name: fileData.name,
        type: 'file', // Default to @file mention
        source: fileData.isGitHubFile ? 'github' : fileData.isCloudFile ? 'cloud' : 'local',
        isGitHub: fileData.isGitHubFile || false,
        isCloud: fileData.isCloudFile || false
      };

      // Handle different file sources
      if (fileData.isGitHubFile) {
        // GitHub file
        mention.path = fileData.path;
        mention.repoInfo = fileData.repoInfo;
        mention.downloadUrl = fileData.downloadUrl;
        
        // Add file content if available
        if (fileData.content) {
          if (isExcelFile(fileData.name)) {
            // For Excel files, we need to parse and structure the content properly
            try {
              // Parse Excel content using XLSX
              const workbook = XLSX.read(fileData.content, { type: 'binary' });
              const sheetNames = workbook.SheetNames;
              const fullExcelContent = {
                fileName: fileData.name,
                sheets: {}
              };
              
              // Extract all sheets and their data
              sheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length > 0) {
                  const headers = jsonData[0] || [];
                  const rows = jsonData.slice(1);
                  
                  fullExcelContent.sheets[sheetName] = {
                    headers: headers,
                    rows: rows,
                    totalRows: rows.length
                  };
                }
              });
              
              mention.fileContent = {
                type: 'excel',
                content: fullExcelContent,
                contentString: JSON.stringify(fullExcelContent, null, 2)
              };
            } catch (error) {
              console.warn('Failed to parse Excel content for dropped GitHub file:', error);
              mention.fileContent = {
                type: 'text',
                content: fileData.content
              };
            }
          } else {
            mention.fileContent = {
              type: 'text',
              content: fileData.content
            };
          }
        }
      } else if (fileData.isCloudFile) {
        // Cloud file
        mention.path = fileData.path;
        mention.provider = fileData.provider;
        mention.downloadUrl = fileData.downloadUrl;
        
        // Add file content if available
        if (fileData.content) {
          if (isExcelFile(fileData.name)) {
            // For Excel files, we need to parse and structure the content properly
            try {
              // Parse Excel content using XLSX
              const workbook = XLSX.read(fileData.content, { type: 'binary' });
              const sheetNames = workbook.SheetNames;
              const fullExcelContent = {
                fileName: fileData.name,
                sheets: {}
              };
              
              // Extract all sheets and their data
              sheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length > 0) {
                  const headers = jsonData[0] || [];
                  const rows = jsonData.slice(1);
                  
                  fullExcelContent.sheets[sheetName] = {
                    headers: headers,
                    rows: rows,
                    totalRows: rows.length
                  };
                }
              });
              
              mention.fileContent = {
                type: 'excel',
                content: fullExcelContent,
                contentString: JSON.stringify(fullExcelContent, null, 2)
              };
            } catch (error) {
              console.warn('Failed to parse Excel content for dropped cloud file:', error);
              mention.fileContent = {
                type: 'text',
                content: fileData.content
              };
            }
          } else {
            mention.fileContent = {
              type: 'text',
              content: fileData.content
            };
          }
        }
      } else if (fileData.isLocalFile) {
        // Local file
        mention.path = fileData.fullPath;
        
        // Get file content from file handle
        if (fileData.fileId && window.fileHandleRegistry.has(fileData.fileId)) {
          const fileHandle = window.fileHandleRegistry.get(fileData.fileId);
          try {
            const file = await fileHandle.getFile();
            
            if (isExcelFile(fileData.name)) {
              // For Excel files, read as array buffer and parse
              const arrayBuffer = await file.arrayBuffer();
              const workbook = XLSX.read(arrayBuffer, { type: 'array' });
              const sheetNames = workbook.SheetNames;
              const fullExcelContent = {
                fileName: fileData.name,
                sheets: {}
              };
              
              // Extract all sheets and their data
              sheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length > 0) {
                  const headers = jsonData[0] || [];
                  const rows = jsonData.slice(1);
                  
                  fullExcelContent.sheets[sheetName] = {
                    headers: headers,
                    rows: rows,
                    totalRows: rows.length
                  };
                }
              });
              
              mention.fileContent = {
                type: 'excel',
                content: fullExcelContent,
                contentString: JSON.stringify(fullExcelContent, null, 2)
              };
            } else {
              // For non-Excel files, read as text
              const content = await file.text();
              mention.fileContent = {
                type: 'text',
                content: content
              };
            }
          } catch (error) {
            console.warn('Failed to read local file content:', error);
          }
        }
      }

      // Fallback: If no content was extracted but it's an Excel file, try to get from memory
      if (!mention.fileContent && isExcelFile(fileData.name)) {
        const excelData = getExcelDataForFile(fileData.name);
        if (excelData) {
          // Convert Excel data to JSON format with full content (same as @mention system)
          const fullExcelContent = {
            fileName: fileData.name,
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
          console.log('✅ Used Excel data from memory for dropped file');
        }
      }

      // Check for duplicates
      const isDuplicate = selectedMentions.some(existingMention => 
        existingMention.name === mention.name && 
        existingMention.type === mention.type &&
        existingMention.source === mention.source
      );
      
      if (isDuplicate) {
        showToast(`"${mention.name}" is already selected`, 'warning');
        return;
      }

      // Add the mention
      setSelectedMentions(prev => [...prev, mention]);
      
      // Show success message
      showToast(`Added "${fileData.name}" as attachment`, 'success');
      
      console.log('✅ Successfully added dropped file as mention:', mention);
      
    } catch (error) {
      console.error('❌ Error processing dropped file:', error);
      showToast(`Error processing dropped file: ${error.message}`, 'error');
    }
  };


  // SSE Connection Management
  const startSSEConnection = (sessionId, generationId) => {
    console.log(`🔥 Starting SSE connection for session: ${sessionId}`);
    console.log(`🔥 Current sessionStrategy when starting SSE: ${sessionStrategy}`);
    console.log(`🔥 Current processingStrategy when starting SSE: ${processingStrategy}`);
    
    // Store the session ID for later use - DON'T reset session strategy if same session
    if (currentSessionId !== sessionId) {
      console.log('🔄 New session detected, but PRESERVING session strategy for strategy continuity');
      // DON'T reset: setSessionStrategy(null); - This was causing the strategy to be lost!
    }
    setCurrentSessionId(sessionId);
    
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
            console.log('⏰ Cleared completion timeout on connection closing');
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
        
        // Handle completion event with code result - check multiple completion indicators
        // Check for nested message structure first (your backend format)
        const extractedCode = data.message?.data?.extracted_sql ||     // Legacy SQL field
                             data.message?.data?.extracted_code ||     // New generic field  
                             data.message?.data?.generated_python ||   // PySpark specific
                             data.message?.data?.generated_code ||     // Generic code field
                             data.data?.extracted_sql ||               // Legacy SQL field
                             data.data?.extracted_code ||              // New generic field
                             data.data?.generated_python ||            // PySpark specific  
                             data.data?.generated_code ||              // Generic code field
                             data.extracted_sql ||                     // Legacy SQL field
                             data.extracted_code ||                    // New generic field
                             data.generated_python ||                  // PySpark specific
                             data.generated_code;                      // Generic code field
        
        // Check completion indicators in nested structure
        const isCompleted = extractedCode || 
                           data.message?.status === 'success' ||
                           data.message?.event_type === 'completion' ||
                           data.message?.processing_status === 'completed' ||
                           data.data?.status === 'completed' || 
                           data.status === 'completed' ||
                           data.event_type === 'completion' ||
                           data.event_type === 'single_pass_processing_complete' ||
                           data.event_type === 'single_pass_complete' ||
                           (data.event_type === 'progress' && data.data?.stage === 'complete') ||
                           (typeof data.message === 'string' && data.message?.includes('completed successfully')) ||
                           (typeof data.message?.message === 'string' && data.message?.message?.includes('completed successfully'));
        
        console.log('🎯 Completion check - extractedCode:', !!extractedCode, 'isCompleted:', isCompleted);
        console.log('🔍 Processing strategy check:', processingStrategy);
        console.log('🔍 Event type check for single_pass:', data.event_type);
        console.log('🔍 Detailed completion check:');
        console.log('  - data.message?.data?.extracted_sql:', data.message?.data?.extracted_sql ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.message?.data?.extracted_code:', data.message?.data?.extracted_code ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.message?.data?.generated_python:', data.message?.data?.generated_python ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.message?.data?.generated_code:', data.message?.data?.generated_code ? 'FOUND (✅ PREFERRED)' : 'NOT FOUND');
        console.log('  - data.data?.extracted_sql:', data.data?.extracted_sql ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.data?.extracted_code:', data.data?.extracted_code ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.data?.generated_python:', data.data?.generated_python ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.data?.generated_code:', data.data?.generated_code ? 'FOUND (✅ PREFERRED)' : 'NOT FOUND');
        console.log('  - data.extracted_sql:', data.extracted_sql ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.extracted_code:', data.extracted_code ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.generated_python:', data.generated_python ? 'FOUND' : 'NOT FOUND');
        console.log('  - data.generated_code:', data.generated_code ? 'FOUND (✅ PREFERRED)' : 'NOT FOUND'); 
        console.log('  - data.message?.status:', data.message?.status);
        console.log('  - data.message?.event_type:', data.message?.event_type);
        console.log('  - data.message?.processing_status:', data.message?.processing_status);
        console.log('  - data.event_type:', data.event_type);
        console.log('  - message object type:', typeof data.message);
        
        if (isCompleted && extractedCode) {
          console.log('🎉 Code extraction completed:', extractedCode);
          console.log('🔄 Updating progress to complete and adding SQL result...');
          
          // Clear the completion timeout since we received the actual completion event
          if (eventSource.completionTimeoutId) {
            clearTimeout(eventSource.completionTimeoutId);
            console.log('⏰ Cleared completion timeout - received natural completion');
          }
          
          // DEBUG: Log strategy values for file creation
          console.log('🔍 STRATEGY DEBUG - sessionStrategy:', sessionStrategy);
          console.log('🔍 STRATEGY DEBUG - processingStrategy:', processingStrategy);
          console.log('🔍 STRATEGY DEBUG - data contains strategy?:', data.data?.processing_strategy || data.processing_strategy);
          
          // Mark that SQL has been generated successfully
          setSqlGenerated(true);
          console.log('✅ SQL generation flag set to true');
          
          // Update progress to completed state first
          setChatMessages(prev => {
            console.log('🏁 BEFORE updating progress to complete - message count:', prev.length);
            console.log('🏁 BEFORE progress update - all messages:', prev.map(m => ({ id: m.id, type: m.type, generationId: m.generationId })));
            
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
              console.log('🏁 AFTER updating progress to complete - message count:', newMessages.length);
              console.log('🏁 AFTER progress update - all messages:', newMessages.map(m => ({ id: m.id, type: m.type, generationId: m.generationId })));
              return newMessages;
            }
            console.log('⚠️ No progress message found to update');
            return prev;
          });
          
          // Create code file immediately and start streaming (strategy-aware)
          // Get strategy from multiple sources including the completion event data
          const eventStrategy = data.data?.processing_strategy || data.processing_strategy;
          
          // Also detect strategy from content if not explicitly provided
          const isPySparkContent = extractedCode && typeof extractedCode === 'string' && (
            extractedCode.includes('pyspark') || 
            extractedCode.includes('spark.') ||
            extractedCode.includes('SparkSession') ||
            extractedCode.includes('from pyspark') ||
            extractedCode.includes('import pyspark') ||
            extractedCode.includes('.appName(') ||
            extractedCode.includes('.getOrCreate()') ||
            extractedCode.startsWith('# python') ||
            extractedCode.startsWith('"""python')
          );
          
          let currentStrategy = eventStrategy || sessionStrategy || processingStrategy;
          
          // If no explicit strategy but content looks like PySpark, assume pyspark
          if (!currentStrategy && isPySparkContent) {
            currentStrategy = 'pyspark';
            console.log('🎯 Detected PySpark strategy from content analysis');
          }
          
          // Default to sql if still no strategy
          currentStrategy = currentStrategy || 'sql';
          
          const isPySparkStrategy = currentStrategy === 'pyspark' || isPySparkContent;
          const fileExtension = isPySparkStrategy ? 'py' : 'sql';
          const fileType = isPySparkStrategy ? 'python' : 'sql';
          const filePrefix = isPySparkStrategy ? 'pyspark' : 'sql';
          
          console.log('➕ Creating in-memory code file and streaming to MainEditor');
          console.log('🔍 Strategy for file creation - eventStrategy:', eventStrategy);
          console.log('🔍 Strategy for file creation - sessionStrategy:', sessionStrategy);
          console.log('🔍 Strategy for file creation - processingStrategy:', processingStrategy);
          console.log('🔍 Strategy for file creation - isPySparkContent:', isPySparkContent);
          console.log('🔍 Strategy for file creation - FINAL currentStrategy:', currentStrategy);
          console.log('🔍 File details - Extension:', fileExtension, '| Type:', fileType, '| Prefix:', filePrefix);
          
          // Create unique identifiers
          const timestamp = Date.now();
          const memoryFileId = `${filePrefix}_chat_${generationId}_${timestamp}`;
          const fileName = `chat-generated-${filePrefix}-${timestamp}.${fileExtension}`;
          
          console.log('📄 Creating memory file with ID:', memoryFileId, 'name:', fileName);
          console.log('📝 Code content length:', extractedCode.length);
          console.log('📝 Code content preview:', extractedCode.substring(0, 100) + '...');
          
          // Create in-memory file placeholder (no initial version - streaming will create the version)
          addMemoryFilePlaceholder(memoryFileId, fileName, fileType, false);
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
              completionMessage: data.message?.message || data.message || generateCompletionMessage(currentStrategy, extractedCode)
            }
          };
          
          console.log('📑 Creating new tab:', newTab);
          
          // Add tab and set it as active
          addTab(newTab);
          console.log('✅ Tab added to state');
          
          setActiveTab(newTab.id);
          console.log('✅ Active tab set to:', newTab.id);
          
          // Start streaming the code content
          streamSQLContent(memoryFileId, extractedCode);
          
          console.log('✅ SQL file created and streaming initiated:', fileName);
          
          // Note: Don't close SSE here - wait for connection_closing event
          return;
        } else if (isCompleted && !extractedCode) {
          console.log('⚠️ Completion detected but no extracted code found');
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
            
            // Mark that SQL has been generated successfully
            setSqlGenerated(true);
            console.log('✅ SQL generation flag set to true (alternative path)');
            
            // Use the found code and create the file with streaming (strategy-aware)
            const eventStrategy = data.data?.processing_strategy || data.processing_strategy;
            
            // Also detect strategy from content if not explicitly provided
            const isPySparkContent = possibleSQL && typeof possibleSQL === 'string' && (
              possibleSQL.includes('pyspark') || 
              possibleSQL.includes('spark.') ||
              possibleSQL.includes('SparkSession') ||
              possibleSQL.includes('from pyspark') ||
              possibleSQL.includes('import pyspark') ||
              possibleSQL.includes('.appName(') ||
              possibleSQL.includes('.getOrCreate()') ||
              possibleSQL.startsWith('# python') ||
              possibleSQL.startsWith('"""python')
            );
            
            let currentStrategy = eventStrategy || sessionStrategy || processingStrategy;
            
            // If no explicit strategy but content looks like PySpark, assume pyspark
            if (!currentStrategy && isPySparkContent) {
              currentStrategy = 'pyspark';
              console.log('🎯 ALTERNATIVE PATH - Detected PySpark strategy from content analysis');
            }
            
            // Default to sql if still no strategy
            currentStrategy = currentStrategy || 'sql';
            
            const isPySparkStrategy = currentStrategy === 'pyspark' || isPySparkContent;
            const fileExtension = isPySparkStrategy ? 'py' : 'sql';
            const fileType = isPySparkStrategy ? 'python' : 'sql';
            const filePrefix = isPySparkStrategy ? 'pyspark' : 'sql';
            
            console.log('📄 ALTERNATIVE PATH - Strategy detection:');
            console.log('📄 - eventStrategy:', eventStrategy);
            console.log('📄 - sessionStrategy:', sessionStrategy);
            console.log('📄 - processingStrategy:', processingStrategy);
            console.log('📄 - isPySparkContent:', isPySparkContent);
            console.log('📄 - FINAL currentStrategy:', currentStrategy);
            
            const timestamp = Date.now();
            const memoryFileId = `${filePrefix}_chat_${generationId}_${timestamp}`;
            const fileName = `chat-generated-${filePrefix}-${timestamp}.${fileExtension}`;
            
            console.log('📄 Creating strategy-aware file:', fileName, '| Strategy:', currentStrategy, '| Type:', fileType);
            
            // Create placeholder memory file for streaming
            addMemoryFilePlaceholder(memoryFileId, fileName, fileType, false);
            
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
                completionMessage: data.message?.message || data.message || generateCompletionMessage(currentStrategy, possibleSQL)
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
              
              // Add an error message about no code being generated
              newMessages.push({
                id: `error_${Date.now()}`,
                type: 'text',
                content: 'Processing completed but no code was generated. Please try rephrasing your question.',
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
          console.log('🔍 Looking for existing progress message with generationId:', generationId);
          console.log('🔍 All current messages:', prev.map(m => ({ id: m.id, type: m.type, generationId: m.generationId, strategy: m.metadata?.processingStrategy })));
          
          // Find existing progress message for this generation
          const existingIndex = prev.findIndex(msg => 
            msg.type === 'progress' && msg.generationId === generationId
          );
          
          console.log('🔍 Existing progress message index:', existingIndex);
          if (existingIndex >= 0) {
            console.log('🔍 Found existing progress message:', prev[existingIndex]);
            console.log('🔍 Existing message strategy:', prev[existingIndex].metadata?.processingStrategy);
          } else {
            console.log('🔍 NO existing progress message found - will create new one');
          }
          
          // Determine current stage based on status - MOVED UP to fix reference error
          let currentStage = data.data?.stage || data.event_type;
          let stageStatus = data.data?.status || 'in_progress';
          
          console.log('🔍 Raw backend event:', data.event_type, 'stage:', currentStage, 'status:', stageStatus);
          
          // Get processing strategy from multiple sources with session persistence
          // SESSION STRATEGY HAS ABSOLUTE PRIORITY - if set, use it unconditionally
          let currentStrategy;
          console.log('🔧 STRATEGY DETECTION START');
          console.log('🔧 sessionStrategy:', sessionStrategy);
          console.log('🔧 processingStrategy (component):', processingStrategy);
          console.log('🔧 data.data?.processing_strategy:', data.data?.processing_strategy);
          console.log('🔧 data.processing_strategy:', data.processing_strategy);
          console.log('🔧 existing message strategy:', existingIndex >= 0 ? prev[existingIndex].metadata?.processingStrategy : 'N/A');
          
          if (sessionStrategy) {
            console.log('🎯 Using SESSION STRATEGY (highest priority):', sessionStrategy);
            currentStrategy = sessionStrategy;
          } else {
            console.log('🔧 No sessionStrategy, checking other sources...');
            // Try other sources if no session strategy
            currentStrategy = processingStrategy || 
                             data.data?.processing_strategy || 
                             data.processing_strategy ||
                             (existingIndex >= 0 ? prev[existingIndex].metadata?.processingStrategy : null) ||
                             // Detect strategy from event names if not explicitly set - MORE COMPREHENSIVE
                             (currentStage?.includes('single_pass') || 
                              currentStage === 'analysis_starting' || 
                              currentStage === 'analysis_complete' ||
                              currentStage === 'questions_complete' ||
                              data.event_type?.includes('single_pass') ||
                              data.event_type === 'analysis_starting' ||
                              data.event_type === 'analysis_complete' ||
                              data.event_type === 'questions_complete' ? 'single_pass' : null);
            console.log('🔧 Fallback strategy detection result:', currentStrategy);
          }
          
          // Additional fallback: if we still don't have strategy but see specific events, detect strategy
          // Also check the message content for PySpark indicators
          const messageIndicatesPySpark = data.message && typeof data.message === 'string' && (
            data.message.includes('PySpark') || 
            data.message.includes('pyspark') ||
            data.message.includes('Python code') ||
            data.message.includes('python code')
          );
          
          console.log('🔍 Strategy detection - sessionStrategy (ABSOLUTE PRIORITY):', sessionStrategy);
          console.log('🔍 Strategy detection - processingStrategy state:', processingStrategy);
          console.log('🔍 Strategy detection - data.data.processing_strategy:', data.data?.processing_strategy);
          console.log('🔍 Strategy detection - data.processing_strategy:', data.processing_strategy);
          console.log('🔍 Strategy detection - existing message strategy:', existingIndex >= 0 ? prev[existingIndex].metadata?.processingStrategy : 'no existing message');
          console.log('🔍 Strategy detection - event name for detection:', currentStage);
          console.log('🔍 Strategy detection - message content:', data.message);
          console.log('🔍 Strategy detection - messageIndicatesPySpark:', messageIndicatesPySpark);
          console.log('🔍 Strategy detection - final currentStrategy:', currentStrategy);
          
          const finalStrategy = currentStrategy || 
                               (currentStage?.includes('pyspark') || 
                                data.event_type?.includes('pyspark') ||
                                currentStage?.includes('python') ||
                                data.event_type?.includes('python') ||
                                messageIndicatesPySpark ? 'pyspark' :
                                currentStage?.includes('single_pass') || 
                                currentStage?.includes('analysis_') || 
                                currentStage === 'questions_complete' ||
                                data.event_type?.includes('single_pass') ||
                                data.event_type?.includes('analysis_') ||
                                data.event_type === 'questions_complete' ? 'single_pass' : 'multi_pass');
          
          // SESSION STRATEGY IS ABSOLUTE - if set, always use it
          const actualStrategy = sessionStrategy ? sessionStrategy : finalStrategy;
          
          console.log('🔍 Strategy detection - final strategy with fallback:', finalStrategy);
          console.log('🔍 Strategy detection - ACTUAL strategy (SESSION ABSOLUTE):', actualStrategy);
          console.log('🔍 Strategy detection - sessionStrategy state:', sessionStrategy);
          
          // Don't overwrite session strategy if it's already set
          if ((actualStrategy === 'single_pass' || actualStrategy === 'pyspark') && !sessionStrategy) {
            console.log('💾 Persisting strategy for entire session:', actualStrategy);
            setSessionStrategy(actualStrategy);
          }
          
          // Map backend stage names to frontend stage names
          const stageMapping = {
            // Multi-pass events
            'parsing': 'parsing_file',
            'generating_joins': 'generating_joins',
            'generating_filters': 'generating_filters', 
            'generating_select': 'generating_select',
            'combining': 'combining',
            'complete': 'complete',
            
            // Single-pass backend events → frontend stages
            'questions_complete': 'analyzing',
            'analysis_starting': 'analyzing', 
            'analysis_complete': 'analyzing',
            'single_pass_processing_start': 'generating_sql',
            'analyzing': 'analyzing',
            'analyzing_complete': 'analyzing',
            'generating_sql': 'generating_sql',
            'generating_sql_complete': 'generating_sql',
            'single_pass_processing_complete': 'complete',
            
            // PySpark-specific events → frontend stages
            'pyspark_analysis_starting': 'analyzing',
            'pyspark_analysis_complete': 'analyzing',
            'pyspark_processing_start': 'generating_code',
            'generating_pyspark': 'generating_code',
            'generating_python': 'generating_code',
            'pyspark_processing_complete': 'complete',
            'python_processing_complete': 'complete'
          };
          
          let mappedStage = stageMapping[currentStage] || currentStage;
          
          // Post-process stage mapping based on strategy context
          // If strategy is pyspark, convert SQL generation stages to code generation stages
          if (actualStrategy === 'pyspark') {
            if (mappedStage === 'generating_sql') {
              mappedStage = 'generating_code';
              console.log('🔧 Converting SQL stage to code stage for PySpark strategy');
            }
            // Also handle any backend events that might not be PySpark-specific
            if (currentStage === 'single_pass_processing_start' || currentStage === 'generating_sql') {
              mappedStage = 'generating_code';
              console.log('🔧 Converting generic processing stage to code generation for PySpark');
            }
          }
          
          console.log('🎯 Backend→Frontend stage mapping:', currentStage, '→', mappedStage);
          console.log('🎯 Final mapped stage:', mappedStage, 'Status:', stageStatus, 'Strategy:', actualStrategy);
          
          console.log('🏗️ CREATING PROGRESS MESSAGE:');
          console.log('🏗️ - generationId:', generationId);
          console.log('🏗️ - currentStage:', mappedStage);
          console.log('🏗️ - actualStrategy:', actualStrategy);
          console.log('🏗️ - sessionStrategy:', sessionStrategy);
          
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
              processingStrategy: actualStrategy
            }
          };
          
          console.log('🏗️ CREATED PROGRESS MESSAGE:', progressMessage);
          console.log('🏗️ CREATED MESSAGE STRATEGY:', progressMessage.metadata.processingStrategy);
          
          if (existingIndex >= 0) {
            console.log('✏️ Updating existing progress message at index:', existingIndex);
            console.log('✏️ Previous message count:', prev.length);
            console.log('✏️ Previous message IDs:', prev.map(m => ({ id: m.id, type: m.type })));
            // Update existing progress message
            const newMessages = [...prev];
            newMessages[existingIndex] = progressMessage;
            console.log('✏️ New message count after update:', newMessages.length);
            console.log('✏️ New message IDs:', newMessages.map(m => ({ id: m.id, type: m.type })));
            console.log('✏️ Updated message:', progressMessage);
            return newMessages;
          } else {
            console.log('➕ Creating new progress message');
            console.log('➕ Previous message count:', prev.length);
            console.log('➕ Previous message IDs:', prev.map(m => ({ id: m.id, type: m.type })));
            // Create new progress message
            const newMessages = [...prev, progressMessage];
            console.log('➕ New message count after addition:', newMessages.length);
            console.log('➕ New message IDs:', newMessages.map(m => ({ id: m.id, type: m.type })));
            console.log('➕ Added message:', progressMessage);
            return newMessages;
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
      console.log('⏰ TIMEOUT TRIGGERED: 30-second safety timeout reached');
      console.log('⏰ This indicates natural completion events may have been missed');
      
      // Check if there were any code messages generated for this generation
      setChatMessages(prev => {
        const hasCodeMessage = prev.some(msg => 
          msg.generationId === generationId && msg.type === 'code'
        );
        
        if (hasCodeMessage) {
          console.log('✅ TIMEOUT: Found code message, assuming completion is handled naturally');
          return prev;
        }
        
        // Check if progress is still showing
        const progressIndex = prev.findIndex(msg => 
          msg.type === 'progress' && msg.generationId === generationId
        );
        
        if (progressIndex >= 0 && prev[progressIndex].metadata?.currentStage !== 'complete') {
          console.log('⚠️ TIMEOUT: Progress still showing, forcing completion...');
          console.log('⚠️ TIMEOUT: Current stage was:', prev[progressIndex].metadata?.currentStage);
          console.log('⚠️ TIMEOUT: This should be rare if backend events are working properly');
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
        } else {
          console.log('✅ TIMEOUT: Progress already complete or not found, no action needed');
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
    
    // Start streaming state for this file
    startMemoryFileStreaming(memoryFileId);
    
    // Split content into manageable chunks (words or lines)
    const lines = fullSQLContent.split('\n');
    let currentContent = '';
    let lineIndex = 0;
    
    const streamNextLine = () => {
      if (lineIndex < lines.length) {
        // Add the next line
        currentContent += (lineIndex > 0 ? '\n' : '') + lines[lineIndex];
        
        // Update memory file with current content (no version creation during streaming)
        updateMemoryFile(memoryFileId, currentContent, false);
        
        console.log(`📝 Streamed line ${lineIndex + 1}/${lines.length}:`, lines[lineIndex]);
        
        lineIndex++;
        
        // Schedule next line with a slight delay for streaming effect
        setTimeout(streamNextLine, 50); // 50ms delay between lines
      } else {
        // Streaming completed - end streaming state and create final version
        endMemoryFileStreaming(memoryFileId, currentContent, '🤖 Generated SQL from ChatPanel');
        console.log('✅ SQL streaming completed and final version created');
      }
    };
    
    // Start streaming after a small initial delay
    setTimeout(streamNextLine, 100);
  }, [updateMemoryFile, startMemoryFileStreaming, endMemoryFileStreaming]);

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

  // Helper function to filter out blank/empty rows from Excel data
  const filterBlankRows = (rows) => {
    return rows.filter(row => {
      // Check if row is completely empty or only contains empty/whitespace values
      if (!row || row.length === 0) return false;
      
      // Check if all cells in the row are empty/null/whitespace
      const hasNonEmptyCell = row.some(cell => {
        if (cell === null || cell === undefined) return false;
        if (typeof cell === 'string') return cell.trim().length > 0;
        if (typeof cell === 'number') return !isNaN(cell);
        return true; // Other types (boolean, date, etc.) are considered non-empty
      });
      
      return hasNonEmptyCell;
    });
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't set dragOver to true to prevent blue flash
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't modify dragOver state to prevent blue flash
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't modify dragOver state to prevent blue flash

    // Get the dropped file data
    const data = e.dataTransfer.getData('text/plain');
    
    if (data) {
      try {
        // Try to parse as JSON (from FileExplorer local files or GitHub files)
        const fileData = JSON.parse(data);
        
        console.log('🗂️ ChatPanel received dropped file:', fileData);
        
        // Process the dropped file and add it as a mention
        await handleDroppedFile(fileData);
        
      } catch (error) {
        console.warn('Failed to parse dropped data as JSON:', error);
        // If not JSON, might be plain text or other format
        // Could handle other drop formats here if needed
      }
    }
  };

  const handleDroppedFile = async (fileData) => {
    try {
      let mention = null;

      if (fileData.isGitHubFile) {
        // Handle GitHub files
        mention = {
          id: `${fileData.name}-file-${Date.now()}-${Math.random()}`,
          name: fileData.name,
          path: fileData.path || fileData.name,
          type: 'file',
          source: 'github',
          isGitHub: true,
          isCloud: false,
          fileContent: null // Will be set below based on file type
        };
        
        // For Excel files, set up fileContent with Excel type
        if (isExcelFile(fileData.name) && fileData.content) {
          // For GitHub Excel files, we need to ensure the proper structure
          // Check if the content is already in the expected format
          if (fileData.content.sheets) {
            // Already processed - just ensure we have contentString
            mention.fileContent = {
              type: 'excel',
              content: fileData.content,
              contentString: JSON.stringify(fileData.content, null, 2)
            };
          } else {
            // Raw Excel data - need to process it
            mention.fileContent = {
              type: 'excel',
              content: fileData.content,
              contentString: JSON.stringify(fileData.content, null, 2)
            };
          }
        } else {
          // For non-Excel files, use the content directly
          mention.fileContent = fileData.content || null;
        }
        
        console.log('📁 Adding GitHub file mention:', mention.name);
        
      } else if (fileData.isLocalFile && fileData.fileId) {
        // Handle local files
        const fileHandle = window.fileHandleRegistry?.get(fileData.fileId);
        
        if (fileHandle) {
          try {
            const fileObj = await fileHandle.getFile();
            
            mention = {
              id: `${fileData.name}-file-${Date.now()}-${Math.random()}`,
              name: fileData.name,
              path: fileData.fullPath || fileData.name,
              type: 'file',
              source: 'local',
              isGitHub: false,
              isCloud: false,
              fileContent: null // Will be loaded when needed
            };
            
            // For Excel files, process the content
            if (isExcelFile(fileData.name)) {
              const arrayBuffer = await fileObj.arrayBuffer();
              
              // Parse Excel content
              if (typeof XLSX !== 'undefined') {
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheetNames = workbook.SheetNames;
                const sheetsData = {};
                
                sheetNames.forEach(sheetName => {
                  const worksheet = workbook.Sheets[sheetName];
                  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1, 
                    defval: '', 
                    raw: false 
                  });
                  
                  const headers = jsonData[0] || [];
                  const dataRows = jsonData.slice(1);
                  const filteredRows = filterBlankRows(dataRows);
                  
                  sheetsData[sheetName] = {
                    headers,
                    rows: filteredRows,
                    totalRows: filteredRows.length
                  };
                });
                
                // Create the full Excel content structure that matches @mention system
                const fullExcelContent = {
                  fileName: fileData.name,
                  sheets: {}
                };
                
                // Convert sheetsData to the expected format
                sheetNames.forEach(sheetName => {
                  const sheetData = sheetsData[sheetName];
                  fullExcelContent.sheets[sheetName] = {
                    headers: sheetData.headers,
                    rows: sheetData.rows,
                    totalRows: sheetData.totalRows
                  };
                });
                
                // Set fileContent in the same format as @mention system
                mention.fileContent = {
                  type: 'excel',
                  content: fullExcelContent,
                  contentString: JSON.stringify(fullExcelContent, null, 2)
                };
              }
            } else {
              // For non-Excel files, read text content
              mention.fileContent = await fileObj.text();
            }
            
            console.log('💻 Adding local file mention:', mention.name);
            
          } catch (error) {
            console.error('Error reading dropped file:', error);
            showToast(`Failed to read file: ${fileData.name}`, 'error');
            return;
          }
        } else {
          console.warn('File handle not found for:', fileData.fileId);
          showToast(`File handle not found for: ${fileData.name}`, 'error');
          return;
        }
      } else {
        // Unknown file format
        console.warn('Unknown file format:', fileData);
        showToast('Unknown file format', 'error');
        return;
      }

      if (mention) {
        // Add the mention to selected mentions
        setSelectedMentions(prev => {
          // Check for duplicates
          const isDuplicate = prev.some(m => 
            m.name === mention.name && m.type === mention.type && m.source === mention.source
          );
          
          if (isDuplicate) {
            showToast(`File ${mention.name} is already attached`, 'warning');
            return prev;
          }
          
          return [...prev, mention];
        });
        
        // Show success toast - Disabled per user request
        // showToast(`Added ${mention.name} to attachments`, 'success');
        
        // Focus the textarea
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
      
    } catch (error) {
      console.error('Error processing dropped file:', error);
      showToast('Failed to process dropped file', 'error');
    }
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
        
        // Filter out blank rows
        const filteredRows = filterBlankRows(dataRows);
        
        sheetsData[sheetName] = {
          headers,
          rows: filteredRows,
          totalRows: filteredRows.length
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

  // ✅ MODULAR HELPER FUNCTIONS FOR OUTPUT FORMAT HANDLING
  
  // Helper function to get file configuration based on output format
  const getFileConfigForFormat = (format) => {
    const normalizedFormat = format?.toLowerCase();
    console.log('🔧 Getting file config for format:', format, '→', normalizedFormat);
    
    switch (normalizedFormat) {
      case 'pyspark':
        return {
          extension: 'py',
          type: 'python',
          prefix: 'pyspark',
          displayName: 'PySpark',
          streamingMessage: 'Streaming PySpark code',
          completionMessage: 'AI-generated PySpark code',
          fileDescription: 'PySpark code file'
        };
      case 'spark':
        return {
          extension: 'scala',
          type: 'scala',
          prefix: 'spark',
          displayName: 'Spark',
          streamingMessage: 'Streaming Spark code',
          completionMessage: 'AI-generated Spark code',
          fileDescription: 'Spark code file'
        };
      case 'pandas':
        return {
          extension: 'py',
          type: 'python',
          prefix: 'pandas',
          displayName: 'Pandas',
          streamingMessage: 'Streaming Pandas code',
          completionMessage: 'AI-generated Pandas code',
          fileDescription: 'Pandas code file'
        };
      case 'sql':
      default:
        return {
          extension: 'sql',
          type: 'sql',
          prefix: 'sql',
          displayName: 'SQL',
          streamingMessage: 'Streaming SQL code',
          completionMessage: 'AI-generated SQL code',
          fileDescription: 'SQL file'
        };
    }
  };

  // Helper function to get format indicators for file searching
  const getFormatIndicators = (format) => {
    const normalizedFormat = format?.toLowerCase();
    console.log('🔍 Getting format indicators for:', format, '→', normalizedFormat);
    
    switch (normalizedFormat) {
      case 'pyspark':
        return ['pyspark', '.py'];
      case 'spark':
        return ['spark', '.scala'];
      case 'pandas':
        return ['pandas', '.py'];
      case 'sql':
      default:
        return ['sql', '.sql'];
    }
  };

  const handleSendMessage = async () => {
    if (chatInput.trim() || selectedMentions.length > 0) {
      // Generate unique generation ID
      const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Set as active generation ID for follow-up requests
      setActiveGenerationId(generationId);
      console.log('🎯 Set active generation ID:', generationId);
      // If no current session, this is a fresh start - reset SQL generation state
      if (!currentSessionId) {
        setSqlGenerated(false);
        console.log('🔄 Fresh conversation started - reset SQL generation state');
      }
      
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
        console.log('🚀 Sending Excel data to backend for NEW code generation...');
        if (sqlGenerated) {
          console.log('📝 Note: Existing code files will be preserved, new code will be generated separately');
        }
        
        excelAttachments.forEach(async (attachment, index) => {
          try {
            // Send the Excel content directly as JSON string
            const payload = attachment.fileContent.contentString;

            console.log(`📤 Sending Excel file ${index + 1}: ${attachment.name}`);
            console.log('📦 JSON Payload Length:', payload.length, 'characters');
            console.log('📋 JSON Content Preview:', payload.substring(0, 500) + '...');
            console.log('🎯 Target: upload-excel-json endpoint (fresh generation, not modification)');

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
                // Update session tracking for new Excel upload
                if (responseData.session_id) {
                  console.log('📝 Updating session ID from Excel upload:', responseData.session_id);
                  console.log('📝 Previous session ID:', currentSessionId);
                  setCurrentSessionId(responseData.session_id);
                  
                  // Reset SQL generated flag for new generation process
                  if (responseData.session_id !== currentSessionId) {
                    console.log('🔄 New session detected - resetting generation flags');
                    setSqlGenerated(false);
                  }
                }
                
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
      
      // Check if SQL has been generated and send to single-pass endpoint
      // BUT NOT if there are Excel attachments (which should trigger a fresh upload flow)
      if (sqlGenerated && currentSessionId && chatInput.trim() && excelAttachments.length === 0) {
        console.log('🚀 SQL already generated, sending message to single-pass endpoint...');
        console.log('📋 Session ID:', currentSessionId);
        console.log('💬 Message:', chatInput.trim());
        console.log('🔍 No Excel attachments - proceeding with single-pass flow');
        
        try {
          const response = await fetch(`http://localhost:8000/api/v1/data/session/${currentSessionId}/single-pass`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: chatInput.trim()
            })
          });

          console.log(`📡 Single-pass Response Status: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            const responseData = await response.json();
            console.log('✅ Single-pass Response Success:', responseData);
            
            // Handle the response (could be updated SQL, questions, etc.)
            if (responseData.status === 'success') {
              console.log('✅ Single-pass request processed successfully');
              
              // Check if we received updated code content (SQL/PySpark/Spark/Pandas)
              if (responseData.message && (responseData.mode === 'sql_modification' || responseData.mode === 'code_modification')) {
                console.log('🔄 Received updated code from backend:', responseData.message);
                console.log('📊 Current memory files:', Object.keys(memoryFiles));
                console.log('📊 Memory files details:', Object.entries(memoryFiles).map(([id, file]) => ({
                  id, 
                  name: file.name, 
                  type: file.type,
                  hasContent: !!file.content,
                  isCodeFile: file.name?.includes('sql') || file.name?.includes('py') || file.name?.includes('scala')
                })));
                console.log('🎯 Current generation ID:', sqlGeneration?.generationId);
                console.log('🎯 Active generation ID:', activeGenerationId);
                
                // Find the code memory file to update
                // First priority: find file related to current generation or active generation
                let targetFileId = null;
                let targetFile = null;
                
                const effectiveGenerationId = sqlGeneration?.generationId || activeGenerationId;
                console.log('🎯 Using effective generation ID:', effectiveGenerationId);
                
                if (effectiveGenerationId) {
                  console.log('🔍 Searching for files with generation ID:', effectiveGenerationId);
                  
                  // Log all memory files for debugging
                  Object.entries(memoryFiles).forEach(([fileId, file]) => {
                    console.log(`📁 File ID: ${fileId}, Name: ${file.name}, Type: ${file.type}, HasSQL: ${file.name?.includes('sql')}`);
                  });
                  
                  // Look for a file with the current generation ID in its name or ID
                  // Priority 1: Look for the exact pattern used by MainEditor (format-aware)
                  const effectiveOutputFormat = sessionOutputFormat || outputFormat || sessionStrategy || processingStrategy || 'SQL';
                  const fileConfig = getFileConfigForFormat(effectiveOutputFormat);
                  const exactPattern = `${fileConfig.prefix}_gen_${effectiveGenerationId}`;
                  console.log('🔍 Looking for exact pattern:', exactPattern, 'for format:', effectiveOutputFormat);
                  
                  const exactGenerationFiles = Object.entries(memoryFiles).filter(([fileId, file]) => 
                    fileId === exactPattern && file.name && file.name.includes(fileConfig.extension)
                  );
                  
                  if (exactGenerationFiles.length > 0) {
                    [targetFileId, targetFile] = exactGenerationFiles[0];
                    console.log('🎯 Found code file by exact generation ID pattern:', targetFile.name);
                  } else {
                    console.log('⚠️ No exact pattern match found, trying broader search...');
                    
                    // Priority 2: Look for files containing the generation ID
                    // ✅ MODULAR: Look for files by current output format, not just SQL
                    const formatIndicators = getFormatIndicators(effectiveOutputFormat);
                    console.log('🔍 Searching for files with format indicators:', formatIndicators, 'for format:', effectiveOutputFormat);
                    
                    const generationBasedFiles = Object.entries(memoryFiles).filter(([fileId, file]) => 
                      file.name && (
                        file.name.includes(effectiveGenerationId) ||
                        fileId.includes(effectiveGenerationId)
                      ) && formatIndicators.some(indicator => file.name.includes(indicator)) && file.content
                    );
                    
                    if (generationBasedFiles.length > 0) {
                      [targetFileId, targetFile] = generationBasedFiles[0];
                      console.log('🎯 Found code file by generation ID pattern:', targetFile.name);
                    } else {
                      console.log('⚠️ No generation-based files found either');
                    }
                  }
                }
                
                // Fallback: find the most recent code memory file matching current output format
                if (!targetFileId) {
                  const effectiveOutputFormat = sessionOutputFormat || outputFormat || sessionStrategy || processingStrategy || 'SQL';
                  const formatIndicators = getFormatIndicators(effectiveOutputFormat);
                  console.log('🔍 Fallback: searching for any code memory files with format indicators:', formatIndicators);
                  
                  const codeMemoryFiles = Object.entries(memoryFiles).filter(([fileId, file]) => {
                    const hasFormatIndicator = formatIndicators.some(indicator => file.name && file.name.includes(indicator));
                    const hasContent = file.content || (file.versions && file.versions.length > 0);
                    console.log(`📁 Checking file ${fileId}: name=${file.name}, hasFormatIndicator=${hasFormatIndicator}, hasContent=${hasContent}, structure:`, {
                      hasDirectContent: !!file.content,
                      hasVersions: !!(file.versions && file.versions.length > 0),
                      versionsCount: file.versions?.length || 0
                    });
                    return hasFormatIndicator && hasContent;
                  });
                  
                  console.log('📁 Found code memory files:', codeMemoryFiles.map(([id, file]) => ({id, name: file.name})));
                  
                  if (codeMemoryFiles.length > 0) {
                    // Get the most recent code file (assuming they're sorted by creation time)
                    [targetFileId, targetFile] = codeMemoryFiles[codeMemoryFiles.length - 1];
                    console.log('📝 Using most recent code file:', targetFile.name);
                  }
                }
                
                if (targetFileId && targetFile) {
                  // ✅ MODULAR: Get file config for proper messaging
                  const effectiveOutputFormat = sessionOutputFormat || outputFormat || sessionStrategy || processingStrategy || 'SQL';
                  const fileConfig = getFileConfigForFormat(effectiveOutputFormat);
                  console.log(`📝 Streaming updated ${fileConfig.displayName} to file:`, targetFile.name, 'with ID:', targetFileId);
                  console.log(`📄 Old ${fileConfig.displayName} content length:`, targetFile.content?.length || 0);
                  console.log(`📄 New ${fileConfig.displayName} content length:`, responseData.message.length);
                  console.log('📊 Memory files before update:', Object.keys(memoryFiles));
                  
                  // Start streaming the updated content
                  startMemoryFileStreaming(targetFileId);
                  console.log(`🌊 Started streaming for ${fileConfig.displayName} update`);
                  
                  // Simulate streaming by breaking the content into chunks
                  const content = responseData.message;
                  const chunkSize = 50; // Characters per chunk
                  const chunks = [];
                  
                  for (let i = 0; i < content.length; i += chunkSize) {
                    chunks.push(content.substring(0, i + chunkSize));
                  }
                  
                  // Stream each chunk with a delay
                  let chunkIndex = 0;
                  const streamInterval = setInterval(() => {
                    if (chunkIndex < chunks.length) {
                      updateMemoryFile(targetFileId, chunks[chunkIndex], false, `🔄 ${fileConfig.streamingMessage}`);
                      chunkIndex++;
                    } else {
                      // Finish streaming
                      clearInterval(streamInterval);
                      endMemoryFileStreaming(targetFileId, content, `🔄 ${fileConfig.completionMessage}`);
                      console.log(`✅ ${fileConfig.displayName} update streaming completed`);
                    }
                  }, 50); // 50ms delay between chunks
                  
                  // Add a confirmation message to chat
                  const confirmationMessage = {
                    id: `confirm_${Date.now()}`,
                    type: 'ai',
                    content: `Updated ${fileConfig.displayName} in ${targetFile.name}`,
                    timestamp: new Date().toISOString(),
                    generationId,
                    metadata: {
                      mode: responseData.mode,
                      provider: responseData.provider,
                      model: responseData.model,
                      updatedFile: targetFile.name,
                      outputFormat: effectiveOutputFormat,
                      sessionId: responseData.session_id
                    }
                  };
                  setChatMessages(prev => [...prev, confirmationMessage]);
                  
                  console.log(`✅ ${fileConfig.displayName} file updated and confirmation message added`);
                } else {
                  console.log('⚠️ No existing code memory files found to update - creating new file with streaming');
                  
                  // ✅ MODULAR OUTPUT FORMAT DETECTION - Use session output format as primary source
                  const effectiveOutputFormat = sessionOutputFormat || outputFormat || sessionStrategy || processingStrategy || 'SQL';
                  console.log('🎯 Detected effective output format for new file creation:', effectiveOutputFormat);
                  console.log('🎯 Format hierarchy: sessionOutputFormat=', sessionOutputFormat, ', outputFormat=', outputFormat, ', sessionStrategy=', sessionStrategy, ', processingStrategy=', processingStrategy);
                  
                  const fileConfig = getFileConfigForFormat(effectiveOutputFormat);
                  console.log('📝 File configuration:', fileConfig);
                  
                  const timestamp = Date.now();
                  const memoryFileId = `${fileConfig.prefix}_updated_${timestamp}`;
                  const fileName = `updated-${fileConfig.prefix}-${timestamp}.${fileConfig.extension}`;
                  
                  console.log(`📝 Creating new ${fileConfig.displayName} file with streaming:`, fileName, 'with ID:', memoryFileId, '| Format:', effectiveOutputFormat);
                  
                  // Create empty memory file and start streaming
                  addMemoryFile(memoryFileId, fileName, '', fileConfig.type);
                  startMemoryFileStreaming(memoryFileId);
                  console.log(`🌊 Started streaming for new ${fileConfig.displayName} file`);
                  
                  // Simulate streaming by breaking the content into chunks
                  const content = responseData.message;
                  const chunkSize = 50; // Characters per chunk
                  const chunks = [];
                  
                  for (let i = 0; i < content.length; i += chunkSize) {
                    chunks.push(content.substring(0, i + chunkSize));
                  }
                  
                  // Stream each chunk with a delay
                  let chunkIndex = 0;
                  const streamInterval = setInterval(() => {
                    if (chunkIndex < chunks.length) {
                      updateMemoryFile(memoryFileId, chunks[chunkIndex], false, `🔄 ${fileConfig.streamingMessage}`);
                      chunkIndex++;
                    } else {
                      // Finish streaming
                      clearInterval(streamInterval);
                      endMemoryFileStreaming(memoryFileId, content, `🔄 ${fileConfig.completionMessage}`);
                      console.log(`✅ New ${fileConfig.displayName} file streaming completed`);
                    }
                  }, 50); // 50ms delay between chunks
                  
                  // Create new tab for the updated code file
                  const newTab = {
                    id: `tab_${timestamp}`,
                    name: fileName,
                    type: 'memory',
                    fileId: memoryFileId,
                    isGenerated: true,
                    isDirty: false,
                    metadata: {
                      source: 'single_pass_update',
                      generationId,
                      mode: responseData.mode,
                      provider: responseData.provider,
                      model: responseData.model,
                      sessionId: responseData.session_id,
                      outputFormat: effectiveOutputFormat
                    }
                  };
                  
                  updateTabs(tabs => [...tabs, newTab]);
                  
                  // Add a message about the new file
                  const newFileMessage = {
                    id: `new_file_${Date.now()}`,
                    type: 'ai',
                    content: `Created new ${fileConfig.displayName} file: ${fileName}`,
                    timestamp: new Date().toISOString(),
                    generationId,
                    metadata: {
                      mode: responseData.mode,
                      provider: responseData.provider,
                      model: responseData.model,
                      newFile: fileName,
                      outputFormat: effectiveOutputFormat,
                      sessionId: responseData.session_id
                    }
                  };
                  setChatMessages(prev => [...prev, newFileMessage]);
                  
                  console.log(`✅ New ${fileConfig.displayName} file created with updated content`);
                }
              } else if (responseData.message) {
                // If it's not SQL modification, show the message as an AI response
                const aiMessage = {
                  id: `ai_${Date.now()}`,
                  type: 'ai',
                  content: responseData.message,
                  timestamp: new Date().toISOString(),
                  generationId,
                  metadata: {
                    mode: responseData.mode,
                    provider: responseData.provider,
                    model: responseData.model
                  }
                };
                setChatMessages(prev => [...prev, aiMessage]);
              }
            }
          } else {
            const errorText = await response.text();
            console.error('❌ Single-pass Response Error:', errorText);
            
            // Show error message in chat
            const errorMessage = {
              id: `error_${Date.now()}`,
              type: 'ai',
              content: 'Sorry, there was an error processing your request. Please try again.',
              timestamp: new Date().toISOString(),
              generationId
            };
            setChatMessages(prev => [...prev, errorMessage]);
          }
        } catch (error) {
          console.error('🔥 Network Error sending to single-pass endpoint:', error);
          
          // Show network error message in chat
          const networkErrorMessage = {
            id: `network_error_${Date.now()}`,
            type: 'ai',
            content: 'Network error occurred. Please check your connection and try again.',
            timestamp: new Date().toISOString(),
            generationId
          };
          setChatMessages(prev => [...prev, networkErrorMessage]);
        }
      } else if (sqlGenerated && currentSessionId && chatInput.trim() && excelAttachments.length > 0) {
        // Excel file attached with existing session - new upload will generate fresh code
        console.log('📁 Excel file attached in existing session - skipping single-pass, using upload flow');
        console.log('🔍 sqlGenerated:', sqlGenerated, ', sessionId:', currentSessionId);
        console.log('🔍 Excel attachments:', excelAttachments.length);
        console.log('✅ Upload process will generate new code while preserving existing files');
        // Don't show any message - let the Excel upload process handle the flow
      } else if (excelAttachments.length > 0) {
        // Excel file is being uploaded - the upload process will handle the conversation flow
        console.log('📁 Excel file attached - upload process will handle conversation flow');
        console.log('🔍 Excel attachments:', excelAttachments.length);
        // Don't show any error message - let the Excel upload process continue
      } else {
        // Only show help message if no Excel attachments are present
        console.log('⚠️ No Excel file attached and no active session');
        console.log('🔍 Current state: sqlGenerated =', sqlGenerated, ', currentSessionId =', currentSessionId);
        console.log('🔍 Selected mentions:', selectedMentions.length);
        console.log('🔍 Excel attachments:', excelAttachments.length);
        
        // Show helpful message explaining the workflow
        const helpMessage = {
          id: `help_${Date.now()}`,
          type: 'ai',
          content: 'Please upload an Excel file first to start analyzing your data. Click the Excel icon above to upload your file, then ask questions about your data.',
          timestamp: new Date().toISOString(),
          generationId
        };
        setChatMessages(prev => [...prev, helpMessage]);
      }
      
      // Clear input and mentions
      setChatInput('');
      setSelectedMentions([]);
      
      // Reset textarea height to initial size
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = '36px'; // Reset to minimum height
      }
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
        <div className={`${colors.chatUserBg} ${colors.text} border ${colors.borderLight} rounded-lg px-4 py-2`}>
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
        <div className={`${colors.chatAiBg} border ${colors.borderLight} rounded-lg px-4 py-2`}>
          <div className={`text-sm ${colors.text}`}>{typeof message.content === 'string' ? message.content : 'AI Response'}</div>
        </div>
        <div className={`text-xs ${colors.textMuted} mt-1`}>
          AI Assistant • {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );

  const renderProgressMessage = (message) => {
    // Helper function to determine completion message based on code type
    const getCompletionMessage = (eventType, strategy) => {
      console.log('� getCompletionMessage called with:', { eventType, strategy });
      console.log('🔍 Session output format:', sessionOutputFormat);
      console.log('🔍 Component output format:', outputFormat);
      
      // PRIORITY 1: Check session output format (highest priority)
      if (sessionOutputFormat) {
        const normalizedSessionFormat = sessionOutputFormat.toLowerCase();
        console.log('🎯 Using session output format for completion message:', normalizedSessionFormat);
        
        const sessionTitle = generateCompletionMessage(normalizedSessionFormat, '');
        
        if (normalizedSessionFormat === 'pyspark' || normalizedSessionFormat.includes('pyspark')) {
          console.log('✅ Session format is PySpark - returning PySpark completion message');
          return {
            title: sessionTitle,
            description: 'PySpark code has been generated and added to the editor.'
          };
        }
        
        if (normalizedSessionFormat === 'spark' || normalizedSessionFormat.includes('spark')) {
          console.log('✅ Session format is Spark - returning Spark completion message');
          return {
            title: sessionTitle,
            description: 'Spark code has been generated and added to the editor.'
          };
        }
        
        if (normalizedSessionFormat === 'pandas' || normalizedSessionFormat.includes('pandas')) {
          console.log('✅ Session format is Pandas - returning Pandas completion message');
          return {
            title: sessionTitle,
            description: 'Pandas code has been generated and added to the editor.'
          };
        }
        
        if (normalizedSessionFormat === 'sql' || normalizedSessionFormat.includes('sql')) {
          console.log('✅ Session format is SQL - returning SQL completion message');
          return {
            title: sessionTitle,
            description: 'SQL query has been generated and added to the editor.'
          };
        }
      }
      
      // PRIORITY 2: Check component output format
      if (outputFormat) {
        const normalizedFormat = outputFormat.toLowerCase();
        console.log('🎯 Using component output format for completion message:', normalizedFormat);
        
        const componentTitle = generateCompletionMessage(normalizedFormat, '');
        
        if (normalizedFormat === 'pyspark' || normalizedFormat.includes('pyspark')) {
          console.log('✅ Component format is PySpark - returning PySpark completion message');
          return {
            title: componentTitle,
            description: 'PySpark code has been generated and added to the editor.'
          };
        }
        
        if (normalizedFormat === 'spark' || normalizedFormat.includes('spark')) {
          console.log('✅ Component format is Spark - returning Spark completion message');
          return {
            title: componentTitle,
            description: 'Spark code has been generated and added to the editor.'
          };
        }
        
        if (normalizedFormat === 'pandas' || normalizedFormat.includes('pandas')) {
          console.log('✅ Component format is Pandas - returning Pandas completion message');
          return {
            title: componentTitle,
            description: 'Pandas code has been generated and added to the editor.'
          };
        }
        
        if (normalizedFormat === 'sql' || normalizedFormat.includes('sql')) {
          console.log('✅ Component format is SQL - returning SQL completion message');
          return {
            title: componentTitle,
            description: 'SQL query has been generated and added to the editor.'
          };
        }
      }
      
      // PRIORITY 3: Check for PySpark-specific indicators in event/strategy
      if (eventType?.includes('pyspark') || 
          eventType?.includes('python') || 
          strategy?.toLowerCase().includes('pyspark') ||
          strategy?.toLowerCase().includes('python')) {
        console.log('✅ Detected PySpark from event/strategy - returning PySpark completion message');
        const pysparkTitle = generateCompletionMessage('pyspark', '');
        return {
          title: pysparkTitle,
          description: 'PySpark code has been generated and added to the editor.'
        };
      }
      
      // PRIORITY 4: Check for SQL-specific indicators in event/strategy
      if (eventType?.includes('sql') || 
          strategy?.toLowerCase().includes('sql') ||
          eventType?.includes('single_pass')) {
        console.log('✅ Detected SQL from event/strategy - returning SQL completion message');
        const sqlTitle = generateCompletionMessage('sql', '');
        return {
          title: sqlTitle,
          description: 'SQL query has been generated and added to the editor.'
        };
      }
      
      // Default fallback message
      console.log('⚠️ No specific format detected - returning generic completion message');
      console.log('⚠️ Available data - eventType:', eventType, 'strategy:', strategy, 'sessionOutputFormat:', sessionOutputFormat, 'outputFormat:', outputFormat);
      return {
        title: 'Code generation completed',
        description: 'Code has been generated and added to the editor.'
      };
    };

    // Check if this progress message is already completed FIRST to prevent any processing
    if (completedProgressMessages.has(message.id)) {
      console.log('🏁 Rendering completed progress message:', message.id);
      const { currentStage, processingStrategy: metadataStrategy } = message.metadata || {};
      const completionMessage = getCompletionMessage(currentStage, metadataStrategy);
      console.log('🏁 Completion message for completed progress:', completionMessage);
      
      return (
        <div key={`completion-${message.id}`} className={`${colors.tertiary} ${colors.border} border rounded-lg p-4 my-2`}>
          <div className="flex items-center gap-2">
            <span className={`${colors.text} font-medium`}>{completionMessage.title}</span>
          </div>
          <p className={`${colors.textSecondary} text-sm mt-1`}>
            {completionMessage.description}
          </p>
        </div>
      );
    }

    const { eventType, processingStatus, totalFields, currentStage, stageStatus, columnTracking, fieldTracking, processingStrategy: metadataStrategy } = message.metadata || {};
    
    // Stop rendering progress if completed to prevent infinite loops
    if (currentStage === 'complete' && stageStatus === 'completed') {
      console.log('🛑 Progress is complete - marking as completed and stopping render for message:', message.id);
      
      // Only add to completed set if not already there to prevent repeated state updates
      if (!completedProgressMessages.has(message.id)) {
        console.log('🛑 Adding message to completedProgressMessages Set');
        console.log('🛑 Current completedProgressMessages size before:', completedProgressMessages.size);
        
        // Use setTimeout to defer state update to next tick to avoid update during render
        setTimeout(() => {
          setCompletedProgressMessages(prev => {
            if (!prev.has(message.id)) {
              const newSet = new Set(prev).add(message.id);
              console.log('🛑 New completedProgressMessages size:', newSet.size);
              return newSet;
            }
            return prev;
          });
        }, 0);
      }
      
      const completionMessage = getCompletionMessage(currentStage, metadataStrategy);
      console.log('🛑 Generated completion message:', completionMessage);
      
      return (
        <div key={`completion-${message.id}`} className={`${colors.primary} ${colors.border} border rounded-lg p-4 my-2`}>
          <div className="flex items-center gap-2">
            <div className="text-green-400 text-lg">✅</div>
            <span className={`${colors.text} font-medium`}>{completionMessage.title}</span>
          </div>
          <p className={`${colors.textSecondary} text-sm mt-1`}>
            {completionMessage.description}
          </p>
        </div>
      );
    }
    
    // Use currentStage from metadata
    const activeStage = currentStage;
    
    // Define progress stages based on output format preference
    const getStagesForStrategy = (outputFormat) => {
      console.log('🎯 getStagesForStrategy called with output format:', outputFormat);
      
      // Normalize the format for comparison
      const normalizedFormat = outputFormat?.toLowerCase();
      
      // Handle different output formats
      if (normalizedFormat === 'sql') {
        console.log('🎯 Returning SQL stages (3 stages)');
        return [
          { id: "analyzing", label: "Analyzing", number: 1 },
          { id: "generating_sql", label: "Generating SQL", number: 2 },
          { id: "complete", label: "Complete", number: 3 }
        ];
      } else if (normalizedFormat === 'pyspark') {
        console.log('🎯 Returning PySpark stages (3 stages)');
        return [
          { id: "analyzing", label: "Analyzing", number: 1 },
          { id: "generating_code", label: "Generating PySpark Code", number: 2 },
          { id: "complete", label: "Complete", number: 3 }
        ];
      } else if (normalizedFormat === 'spark') {
        console.log('🎯 Returning Spark stages (3 stages)');
        return [
          { id: "analyzing", label: "Analyzing", number: 1 },
          { id: "generating_code", label: "Generating Spark Code", number: 2 },
          { id: "complete", label: "Complete", number: 3 }
        ];
      } else if (normalizedFormat === 'pandas') {
        console.log('🎯 Returning Pandas stages (3 stages)');
        return [
          { id: "analyzing", label: "Analyzing", number: 1 },
          { id: "generating_code", label: "Generating Pandas Code", number: 2 },
          { id: "complete", label: "Complete", number: 3 }
        ];
      } else if (normalizedFormat === 'single_pass') {
        // Legacy support for processing strategy - try to detect output format from session state
        const effectiveOutputFormat = sessionOutputFormat || outputFormat;
        if (effectiveOutputFormat && effectiveOutputFormat.toLowerCase() !== 'single_pass') {
          console.log('🎯 Single_pass detected, but using effective output format:', effectiveOutputFormat);
          // Recursively call with the effective output format
          return getStagesForStrategy(effectiveOutputFormat);
        } else {
          console.log('🎯 Returning single_pass stages (3 stages) - legacy support with SQL default');
          return [
            { id: "analyzing", label: "Analyzing", number: 1 },
            { id: "generating_sql", label: "Generating SQL", number: 2 },
            { id: "complete", label: "Complete", number: 3 }
          ];
        }
      } else if (normalizedFormat === 'multi_pass') {
        console.log('🎯 Returning multi_pass stages (7 stages)');
        return [
          { id: "analyzing", label: "Analyzing", number: 1 },
          { id: "parsing_file", label: "Parsing file", number: 2 },
          { id: "generating_joins", label: "Generating joins", number: 3 },
          { id: "generating_filters", label: "Generating filters", number: 4 },
          { id: "generating_select", label: "Generating select", number: 5 },
          { id: "combining", label: "Combining", number: 6 },
          { id: "complete", label: "Complete", number: 7 }
        ];
      } else {
        // Unknown format - try to determine from context or default to SQL
        console.log('🎯 Unknown format:', outputFormat, '- trying to determine from session context');
        const effectiveOutputFormat = sessionOutputFormat || 'SQL';
        if (effectiveOutputFormat && effectiveOutputFormat.toLowerCase() !== normalizedFormat) {
          console.log('🎯 Using session output format:', effectiveOutputFormat);
          return getStagesForStrategy(effectiveOutputFormat);
        } else {
          console.log('🎯 Defaulting to SQL stages (3 stages) for unknown format:', outputFormat);
          return [
            { id: "analyzing", label: "Analyzing", number: 1 },
            { id: "generating_sql", label: "Generating SQL", number: 2 },
            { id: "complete", label: "Complete", number: 3 }
          ];
        }
      }
    };
    
    // Use output format for determining progress stages, fallback to processing strategy for legacy support
    const currentOutputFormat = sessionOutputFormat || outputFormat || metadataStrategy;
    const stages = getStagesForStrategy(currentOutputFormat);
    console.log('🎯 RENDER - Using stages for OUTPUT FORMAT:', currentOutputFormat, '- Stages count:', stages.length);
    console.log('🎯 RENDER - sessionOutputFormat:', sessionOutputFormat);
    console.log('🎯 RENDER - outputFormat state:', outputFormat);
    console.log('🎯 RENDER - metadataStrategy (fallback):', metadataStrategy);
    console.log('🎯 RENDER - Component state processingStrategy (IGNORED):', processingStrategy);
    console.log('🎯 RENDER - Final format used for stages:', currentOutputFormat);
    console.log('🎯 RENDER - Generated stages:', stages.map(s => s.label));
    
    const getStageStatus = (stageId) => {
      const currentIndex = stages.findIndex(s => s.id === activeStage);
      const stageIndex = stages.findIndex(s => s.id === stageId);
      
      // Debug logging
      console.log(`🔍 Stage ${stageId}: currentStage=${activeStage}, stageStatus=${stageStatus}, currentIndex=${currentIndex}, stageIndex=${stageIndex}`);
      
      // Special handling for 'complete' stage
      if (stageId === 'complete') {
        // Complete stage is only active/complete if we're actually at the complete stage
        if (activeStage === 'complete') {
          const status = stageStatus === 'completed' ? 'complete' : 'active';
          console.log(`🏁 Complete stage status: ${status}`);
          return status;
        } else {
          console.log(`⏳ Complete stage: pending (not at complete yet)`);
          return 'pending';
        }
      }
      
      if (stageId === activeStage) {
        // Current active stage - check if completed or in progress
        const status = stageStatus === 'completed' ? 'complete' : 'active';
        console.log(`🎯 Current stage ${stageId} status: ${status}`);
        return status;
      } else if (stageIndex < currentIndex && currentIndex !== -1) {
        // Only mark previous stages as complete if we have a valid current stage
        // and we've actually progressed past them
        console.log(`✅ Previous stage ${stageId}: complete`);
        return 'complete';
      } else if (stageIndex === currentIndex && stageStatus === 'completed') {
        // Current stage is completed
        console.log(`🏁 Current completed stage ${stageId}: complete`);
        return 'complete';
      } else {
        // Future stages are pending, or we don't have a valid current stage
        console.log(`⏳ Future/unknown stage ${stageId}: pending`);
        return 'pending';
      }
    };

    // Calculate overall progress percentage based on actually completed stages
    const currentStageIndex = stages.findIndex(s => s.id === activeStage);
    let progressPercentage = 0;
    
    // Count actually completed stages
    let completedStagesCount = 0;
    stages.forEach((stage, index) => {
      const status = getStageStatus(stage.id);
      if (status === 'complete') {
        completedStagesCount++;
      } else if (status === 'active' && stageStatus === 'in_progress') {
        // Add partial progress for active in-progress stage
        completedStagesCount += 0.5;
      }
    });
    
    progressPercentage = Math.round((completedStagesCount / stages.length) * 100);
    
    console.log(`📊 Progress calculation: ${completedStagesCount}/${stages.length} stages completed = ${progressPercentage}%`);

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
        <div className={`max-w-[90%] w-full border ${colors.borderLight} rounded-lg p-3 ${colors.secondary}`}>
          {/* Progress indicator with stages */}
          <div className="mb-3">
            <div className="relative flex items-center justify-between mb-2 px-2 sm:px-4" style={{ height: '70px' }}>
              {/* Background connection line */}
              <div className={`absolute top-1/2 left-4 right-4 sm:left-6 sm:right-6 h-0.5 bg-gray-300 dark:bg-gray-600 transform -translate-y-1/2`}></div>
              
              {stages.map((stage, index) => {
                const status = getStageStatus(stage.id);
                const isTop = index % 2 === 0;
                
                return (
                  <div key={stage.id} className="relative flex flex-col items-center z-10">
                    {/* Label on top for even indices */}
                    {isTop && (
                      <span className={`text-xs mb-3 ${colors.text} font-normal text-center leading-tight ${
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
                        : 'bg-gray-300 text-gray-600 border-gray-400 dark:bg-gray-600 dark:text-gray-300 dark:border-gray-500'
                    }`}>
                      {status === 'complete' ? '✓' : stage.number}
                    </div>
                    
                    {/* Label on bottom for odd indices */}
                    {!isTop && (
                      <span className={`text-xs mt-3 ${colors.text} font-normal text-center leading-tight ${
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
            <div className={`${colors.text} text-sm leading-relaxed`}>
              {typeof message.content === 'string' ? message.content : 'Processing...'}
            </div>
            
            {/* Field Level Progress */}
            {processingStatus && (
              <div className={`${colors.textMuted} text-xs mt-2`}>
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
                            : `${colors.tertiary}/20 ${colors.textMuted}`
                        }`}>
                          {column.status}
                        </span>
                      </div>
                    ))}
                    {columnStats.columns.length > 5 && (
                      <div className={`text-xs ${colors.textMuted} mt-1`}>
                        ... and {columnStats.columns.length - 5} more columns
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className={`${colors.textMuted} text-xs mt-1`}>
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
      console.log('🎯 Option selected:', selectedOption);
      console.log('📝 Question metadata:', message.metadata);
      console.log('🔢 Question ID:', message.metadata?.questionId);
      console.log('📋 Question type:', message.metadata?.questionType);
      console.log('📋 Question options:', message.metadata?.options);
      
      // Extract variables from metadata
      const questionId = message.metadata?.questionId;
      const questionType = message.metadata?.questionType;
      const options = message.metadata?.options;
      const sessionId = message.metadata?.sessionId;
      
      // Check if this is a strategy selection question
      const isStrategyQuestion = questionType === 'strategy_selection' || 
                                (selectedOption === 'single_pass' || selectedOption === 'multi_pass' || selectedOption === 'pyspark') ||
                                (options && options.some(opt => 
                                  (typeof opt === 'string' && (opt === 'single_pass' || opt === 'multi_pass' || opt === 'pyspark')) ||
                                  (typeof opt === 'object' && (opt.value === 'single_pass' || opt.value === 'multi_pass' || opt.value === 'pyspark'))
                                ));
      
      // Check if this is an output format selection question
      const isOutputFormatQuestion = questionType === 'output_format_selection' ||
                                    (selectedOption === 'SQL' || selectedOption === 'PySpark' || selectedOption === 'Spark' || selectedOption === 'Pandas') ||
                                    (options && options.some(opt => 
                                      (typeof opt === 'string' && (opt === 'SQL' || opt === 'PySpark' || opt === 'Spark' || opt === 'Pandas')) ||
                                      (typeof opt === 'object' && (opt.value === 'SQL' || opt.value === 'PySpark' || opt.value === 'Spark' || opt.value === 'Pandas'))
                                    ));
      
      console.log('🔍 Is strategy question?', isStrategyQuestion);
      console.log('🔍 Is output format question?', isOutputFormatQuestion);
      console.log('🔍 questionType === strategy_selection:', questionType === 'strategy_selection');
      console.log('🔍 questionType === output_format_selection:', questionType === 'output_format_selection');
      console.log('🔍 selectedOption is strategy:', selectedOption === 'single_pass' || selectedOption === 'multi_pass' || selectedOption === 'pyspark');
      console.log('🔍 selectedOption is output format:', selectedOption === 'SQL' || selectedOption === 'PySpark' || selectedOption === 'Spark' || selectedOption === 'Pandas');
      console.log('🔍 selectedOption value:', selectedOption);
      console.log('🔍 options contain strategy:', options && options.some(opt => 
        (typeof opt === 'string' && (opt === 'single_pass' || opt === 'multi_pass' || opt === 'pyspark')) ||
        (typeof opt === 'object' && (opt.value === 'single_pass' || opt.value === 'multi_pass' || opt.value === 'pyspark'))
      ));
      
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
      // Variables already extracted above: sessionId, questionId, questionType
      
      // Store output format preference for progress stage customization
      if (isOutputFormatQuestion) {
        console.log('💾 Storing output format (DETECTED OUTPUT FORMAT QUESTION):', selectedOption);
        console.log('💾 Question ID:', questionId, 'Type:', questionType);
        console.log('💾 Output format detected by:', {
          questionType: questionType === 'output_format_selection',
          selectedOptionIsFormat: selectedOption === 'SQL' || selectedOption === 'PySpark' || selectedOption === 'Spark' || selectedOption === 'Pandas',
          optionsContainFormat: options && options.some(opt => 
            (typeof opt === 'string' && (opt === 'SQL' || opt === 'PySpark' || opt === 'Spark' || opt === 'Pandas')) ||
            (typeof opt === 'object' && (opt.value === 'SQL' || opt.value === 'PySpark' || opt.value === 'Spark' || opt.value === 'Pandas'))
          )
        });
        console.log('💾 Previous outputFormat state:', outputFormat);
        console.log('💾 Previous sessionOutputFormat state:', sessionOutputFormat);
        setOutputFormat(selectedOption);
        setSessionOutputFormat(selectedOption); // Also persist at session level
        console.log('💾 setOutputFormat called with:', selectedOption);
        console.log('💾 setSessionOutputFormat called with:', selectedOption);
      }
      
      // Store processing strategy for SSE stage customization
      // NOTE: Strategy question moved to be LAST question in backend
      // Check for strategy selection by multiple criteria since backend may not set questionType
      if (isStrategyQuestion) {
        console.log('💾 Storing processing strategy (DETECTED STRATEGY QUESTION):', selectedOption);
        console.log('💾 Question ID:', questionId, 'Type:', questionType);
        console.log('💾 Strategy detected by:', {
          questionType: questionType === 'strategy_selection',
          selectedOptionIsStrategy: selectedOption === 'single_pass' || selectedOption === 'multi_pass',
          optionsContainStrategy: options && options.some(opt => 
            (typeof opt === 'string' && (opt === 'single_pass' || opt === 'multi_pass')) ||
            (typeof opt === 'object' && (opt.value === 'single_pass' || opt.value === 'multi_pass'))
          )
        });
        console.log('💾 Previous processingStrategy state:', processingStrategy);
        console.log('💾 Previous sessionStrategy state:', sessionStrategy);
        setProcessingStrategy(selectedOption);
        setSessionStrategy(selectedOption); // Also persist at session level
        console.log('💾 setProcessingStrategy called with:', selectedOption);
        console.log('💾 setSessionStrategy called with:', selectedOption);
        
        // Also log after a small delay to see if state updated
        setTimeout(() => {
          console.log('💾 Strategy state after 100ms:', processingStrategy);
          console.log('💾 Session strategy state after 100ms:', sessionStrategy);
        }, 100);
        
        // Log immediately to see current state
        console.log('💾 Immediate check - processingStrategy:', processingStrategy);
        console.log('💾 Immediate check - sessionStrategy:', sessionStrategy);
        
        // Since this is the LAST question, SSE should start immediately after
        console.log('🚀 Strategy set on LAST question - SSE will start next');
        
        // Since strategy question is now LAST, start SSE immediately after strategy selection
        console.log('🔥 Starting SSE for processing after STRATEGY SELECTION (last question)');
        console.log('🎯 Strategy question answered:', selectedOption);
        
        // FORCE strategy update immediately when selected on last question
        console.log('🔧 FORCING strategy state update to:', selectedOption);
        setProcessingStrategy(selectedOption);
        setSessionStrategy(selectedOption);
        
        // Get the processing strategy - use selectedOption directly since it was just selected
        const currentProcessingStrategy = selectedOption; // Force use selectedOption since it was just chosen
        console.log('🔍 FORCED processing strategy for SSE:', currentProcessingStrategy);
        console.log('🔍 Session strategy (will be set):', selectedOption);
        console.log('🔍 Component strategy (will be set):', selectedOption);
        console.log('🔍 Selected option (direct):', selectedOption);
        
        // Create initial progress message WITH STRATEGY SET TO SELECTED OPTION
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
            processingStrategy: currentProcessingStrategy // This will be selectedOption directly
          }
        };
        
        console.log('🏗️ INITIAL PROGRESS MESSAGE CREATED:', initialProgressMessage);
        console.log('🏗️ INITIAL MESSAGE STRATEGY:', initialProgressMessage.metadata.processingStrategy);
        console.log('🏗️ INITIAL MESSAGE GENERATION ID:', initialProgressMessage.generationId);
        
        setChatMessages(prev => [...prev, initialProgressMessage]);
        
        // Start SSE connection immediately after strategy selection
        console.log('🚀 About to start SSE connection after STRATEGY selection...');
        console.log('🚀 Session ID:', sessionId);
        console.log('🚀 Generation ID:', message.generationId);
        console.log('🚀 Strategy for SSE:', currentProcessingStrategy || selectedOption);
        startSSEConnection(sessionId, message.generationId);
        console.log('🚀 SSE connection start call completed');
        
        // Small delay to ensure SSE connection is ready
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Legacy: Only start SSE connection after the 4th question is answered AND it's not a strategy question
      if (questionId === 4 && !isStrategyQuestion) {
        console.log('🔥 Starting SSE for processing after fourth question submission (LEGACY)');
        console.log('🎯 Fourth question answered:', selectedOption);
        console.log('🎯 NOT a strategy question, using legacy flow');
        
        // Get the processing strategy - it should be stored from question 3
        const currentProcessingStrategy = sessionStrategy || processingStrategy;
        console.log('🔍 Current processing strategy for SSE:', currentProcessingStrategy);
        console.log('🔍 Session strategy:', sessionStrategy);
        console.log('🔍 Component strategy:', processingStrategy);
        
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
            processingStrategy: currentProcessingStrategy
          }
        };
        setChatMessages(prev => [...prev, initialProgressMessage]);
        
        // Start SSE connection and wait a bit for it to establish
        console.log('🚀 About to start SSE connection after 4th question...');
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
            console.log('📋 Next question received:', responseData.next_question);
            console.log('🔢 Next question ID:', responseData.next_question.question_id);
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
              console.log('➕ Adding next question to chat:', nextQuestionMessage);
              setChatMessages(prev => [...prev, nextQuestionMessage]);
            }, 300);
          } else if (responseData.status === 'success' && responseData.question) {
            // Another question received (fallback for original structure)
            console.log('📋 Fallback question received:', responseData.question);
            console.log('🔢 Fallback question ID:', responseData.question.question_id);
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
              console.log('➕ Adding fallback question to chat:', nextQuestionMessage);
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
                          ${colors.tertiary} ${colors.text} border ${colors.borderLight}
                          ${colors.hover} hover:${colors.text} hover:border-${colors.border}
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                          cursor-pointer`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className={`text-sm font-medium ${colors.text}`}>
                            {optionLabel}
                          </div>
                          {optionDescription && (
                            <div className={`text-xs ${colors.textMuted} leading-relaxed`}>
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
    const { blockType, modelUsed, processingStrategy, completionMessage, language } = message.metadata || {};
    const isGeneratedCode = completionMessage; // This indicates it's a final code result
    
    // Detect language/code type from multiple sources
    const codeLanguage = language || blockType || 'sql';
    const isPython = codeLanguage?.toLowerCase().includes('python') || 
                     codeLanguage?.toLowerCase().includes('pyspark') ||
                     processingStrategy?.toLowerCase().includes('pyspark');
    const isSQL = codeLanguage?.toLowerCase().includes('sql') || !isPython;
    
    // Language-specific configuration
    const getLanguageConfig = () => {
      if (isPython) {
        return {
          displayName: codeLanguage?.toLowerCase().includes('pyspark') ? 'PySpark' : 'Python',
          copyButtonText: codeLanguage?.toLowerCase().includes('pyspark') ? 'Copy PySpark Code' : 'Copy Python Code',
          icon: '🐍',
          colorClass: 'text-yellow-400'
        };
      } else {
        return {
          displayName: 'SQL',
          copyButtonText: 'Copy SQL',
          icon: '🗃️',
          colorClass: 'text-blue-400'
        };
      }
    };
    
    const langConfig = getLanguageConfig();
    
    // Ensure completionMessage is a string
    const completionText = typeof completionMessage === 'string' 
      ? completionMessage 
      : typeof completionMessage === 'object' 
      ? JSON.stringify(completionMessage) 
      : `${langConfig.displayName} code generated successfully`;
    
    return (
      <div key={message.id} className="flex justify-start mb-4">
        <div className="max-w-[95%] w-full">
          {/* Completion message header for generated code */}
          {isGeneratedCode && (
            <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg p-3 mb-3`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className={`${colors.text} text-sm font-medium`}>
                  {completionText}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                {modelUsed && (
                  <span>Model: <span className="text-blue-400">{String(modelUsed)}</span></span>
                )}
                {processingStrategy && (
                  <span>Strategy: <span className="text-green-400">{String(processingStrategy).replace('_', ' ')}</span></span>
                )}
                <span>Language: <span className={langConfig.colorClass}>{langConfig.displayName}</span></span>
              </div>
            </div>
          )}
          
          {/* Code Block */}
          <div className={`${colors.tertiary} border ${colors.borderLight} rounded-lg overflow-hidden`}>
            <div className={`flex items-center justify-between px-4 py-2 ${colors.secondary} border-b ${colors.borderLight}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colors.successBg}`}></span>
                <span className={`${colors.text} text-xs font-mono flex items-center gap-1`}>
                  <span>{langConfig.icon}</span>
                  {blockType?.replace('_', ' ').toUpperCase() || langConfig.displayName.toUpperCase()} 
                </span>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                  showToast(`${langConfig.displayName} code copied to clipboard!`, 'success');
                }}
                className={`${colors.textSecondary} hover:${colors.text} text-xs px-2 py-1 rounded transition-colors`}
              >
                {langConfig.copyButtonText}
              </button>
            </div>
            <pre className={`p-4 text-sm font-mono overflow-x-auto leading-relaxed ${colors.text}`}>
              <code className={isPython ? 'language-python' : 'language-sql'}>
                {typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}
              </code>
            </pre>
          </div>
          <div className={`text-xs ${colors.textMuted} mt-1`}>
            {isGeneratedCode ? 'Generated' : 'Code'} • {langConfig.displayName} • {new Date(message.timestamp).toLocaleTimeString()}
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
      className={`${colors.secondary} ${colors.border} border-l flex flex-col h-full relative`}
      style={{ width }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {/* Chat Header */}
      <div className={`p-4 ${colors.border} border-b flex items-center justify-between`}>
        <h3 className={`text-sm font-medium ${colors.text}`}>CHAT</h3>
        {chatMessages.length > 0 && (
          <button
            onClick={() => {
              console.log('🧹🚨 CLEAR BUTTON CLICKED - This will clear all messages!');
              console.log('🧹 Messages before clear:', chatMessages.length);
              console.log('🧹 Message types before clear:', chatMessages.reduce((acc, msg) => {
                acc[msg.type] = (acc[msg.type] || 0) + 1;
                return acc;
              }, {}));
              setChatMessages([]);
              setCurrentSessionId(null);
              setSqlGenerated(false);
              console.log('🧹 Chat cleared - reset session and SQL generation state');
            }}
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
                      title={mention.excelData && mention.type === 'context' ? 
                        `@context[${mention.name}:${mention.excelData.sheetName}:Row${mention.excelData.rowIndex + 1}]` :
                        mention.codeData ?
                        `@code[${mention.name}:line${mention.codeData.startLine === mention.codeData.endLine ? '' : 's'} ${mention.codeData.startLine === mention.codeData.endLine ? mention.codeData.startLine : `${mention.codeData.startLine}-${mention.codeData.endLine}`}]` :
                        `@${mention.type}[${mention.name}]`
                      }
                    >
                      {mention.excelData && mention.type === 'context' ? 
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
            <div className={`p-2 text-xs ${colors.text} border-b ${colors.borderLight}`}>
              @{mentionType} suggestions ({mentionSuggestions.length} files):
            </div>
            {mentionSuggestions.length > 0 ? (
              mentionSuggestions.map((suggestion, index) => (
                <div 
                  key={suggestion.id || index}
                  className={`p-2 text-sm ${colors.text} hover:${colors.hover} cursor-pointer border-b ${colors.borderLight} last:border-b-0`}
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
                    <span className={`text-xs ${colors.textSecondary} ml-2`}>
                      {suggestion.source === 'github' ? '📁' : 
                       suggestion.source === 'cloud' ? '☁️' : '💻'}
                    </span>
                  </div>
                  {suggestion.path !== suggestion.name && (
                    <div className={`text-xs ${colors.textSecondary} truncate mt-1`}>
                      {suggestion.path}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className={`p-3 text-sm ${colors.textMuted} text-center`}>
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
