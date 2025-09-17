import { useState, useCallback } from 'react';

/**
 * Custom hook for @mentions functionality
 * Provides mention detection, suggestions, and dropdown management
 * 
 * @param {string} inputValue - Current input value
 * @param {function} setInputValue - Function to update input value
 * @param {Object} inputRef - Reference to the input/textarea element
 * @param {function} getAllAvailableFiles - Function to get available files
 * @param {Object} additionalFiles - Additional files (like memoryFiles, excelFiles)
 * @param {function} showToast - Toast notification function (optional)
 * @returns {Object} Mention state and handlers
 */
export const useMentions = (
  inputValue, 
  setInputValue, 
  inputRef, 
  getAllAvailableFiles, 
  additionalFiles = {}, 
  showToast = null
) => {
  // @mention detection state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionType, setMentionType] = useState(''); // 'file', 'context', 'code'
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedMentions, setSelectedMentions] = useState([]); // Array of selected files/mentions
  
  // Excel-specific state
  const [excelRowsDropdown, setExcelRowsDropdown] = useState(null);
  const [selectedExcelFile, setSelectedExcelFile] = useState(null);
  
  // Code-specific state
  const [codeLinesDropdown, setCodeLinesDropdown] = useState(null);
  const [selectedCodeFile, setSelectedCodeFile] = useState(null);
  const [selectedLines, setSelectedLines] = useState([]);
  const [lastSelectedLine, setLastSelectedLine] = useState(null);

  // Helper function to detect mentions in text
  const detectMention = useCallback((text, cursorPosition) => {
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
  }, []);

  // Helper function to check if file is Excel
  const isExcelFile = useCallback((fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['xlsx', 'xls', 'xlsm', 'csv'].includes(ext);
  }, []);

  // Helper function to check if file is code file
  const isCodeFile = useCallback((fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['py', 'sql', 'ipynb', 'dbc', 'js', 'ts', 'jsx', 'tsx'].includes(ext);
  }, []);

  // Generate suggestions based on mention type
  const generateSuggestions = useCallback((type) => {
    // Get fresh files from FileExplorer
    const allFiles = getAllAvailableFiles ? getAllAvailableFiles() : [];
    
    console.log('🔍 generateSuggestions debug:', {
      type,
      getAllAvailableFiles: typeof getAllAvailableFiles,
      allFilesCount: allFiles.length,
      allFiles: allFiles.slice(0, 3), // Show first 3 files
      additionalFiles
    });
    
    // Get memory files and convert them to the expected format
    const memoryFilesList = additionalFiles.memoryFiles ? 
      Object.entries(additionalFiles.memoryFiles).map(([fileId, fileData]) => ({
        name: fileData.name,
        path: fileData.name,
        source: 'memory',
        isGitHub: false,
        isCloud: false,
        id: `memory-${fileId}`
      })) : [];
    
    // Combine file explorer files with memory files
    const combinedFiles = [...allFiles, ...memoryFilesList];
    
    console.log('🔍 Combined files:', combinedFiles.length, combinedFiles.slice(0, 3));
    
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
            return ['xlsx', 'xls', 'xlsm', 'csv', 'py', 'sql', 'ipynb', 'dbc', 'js', 'ts', 'jsx', 'tsx'].includes(ext);
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
        // Filter to code files: .py, .sql, .ipynb, .dbc, .js, .ts, .jsx, .tsx
        return combinedFiles
          .filter(file => {
            const ext = file.name.split('.').pop()?.toLowerCase();
            return ['py', 'sql', 'ipynb', 'dbc', 'js', 'ts', 'jsx', 'tsx'].includes(ext);
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
  }, [getAllAvailableFiles, additionalFiles]);

  // Handle mention selection from dropdown
  const handleMentionSelect = useCallback((selectedFile) => {
    // Check for duplicates
    const isDuplicate = selectedMentions.some(mention => 
      mention.name === selectedFile.name && mention.type === selectedFile.type
    );
    
    if (isDuplicate) {
      // Show toast notification for duplicate
      if (showToast) {
        showToast(`"${selectedFile.name}" is already selected`, 'warning');
      }
      setShowMentionDropdown(false);
      return;
    }
    
    // Add the selected file to mentions array
    const mention = {
      id: `${selectedFile.name}-${selectedFile.type}-${Date.now()}-${Math.random()}`,
      name: selectedFile.name,
      path: selectedFile.path,
      type: selectedFile.type,
      source: selectedFile.source,
      isGitHub: selectedFile.isGitHub,
      isCloud: selectedFile.isCloud
    };
    
    setSelectedMentions(prev => [...prev, mention]);
    
    // Remove the @mention text from input and close dropdown
    const currentInput = inputRef.current;
    if (currentInput) {
      const cursorPosition = currentInput.selectionStart || inputValue.length;
      const beforeCursor = inputValue.substring(0, cursorPosition);
      const afterCursor = inputValue.substring(cursorPosition);
      
      // Find the @ symbol before cursor and replace the mention text
      const mentionStart = beforeCursor.lastIndexOf('@');
      if (mentionStart !== -1) {
        const newValue = 
          inputValue.substring(0, mentionStart) + 
          `@${selectedFile.type}:${selectedFile.name} ` + 
          afterCursor;
        
        setInputValue(newValue);
        
        // Set cursor position after the mention
        setTimeout(() => {
          const newCursorPos = mentionStart + `@${selectedFile.type}:${selectedFile.name} `.length;
          if (currentInput.setSelectionRange) {
            currentInput.setSelectionRange(newCursorPos, newCursorPos);
            currentInput.focus();
          }
        }, 0);
      }
    }
    
    setShowMentionDropdown(false);
    setMentionType('');
    setSelectedMentionIndex(0);
  }, [selectedMentions, showToast, inputRef, inputValue, setInputValue]);

  // Handle input changes to detect mentions
  const handleInputChange = useCallback((newValue, cursorPosition = null) => {
    setInputValue(newValue);
    
    // Use provided cursor position or get it from input element
    const position = cursorPosition !== null ? cursorPosition : 
      (inputRef.current ? inputRef.current.selectionStart : newValue.length);
    
    const mention = detectMention(newValue, position);
    
    console.log('🔍 useMentions handleInputChange:', {
      newValue,
      position,
      mention,
      getAllAvailableFilesType: typeof getAllAvailableFiles
    });
    
    if (mention) {
      setMentionType(mention.type);
      const suggestions = generateSuggestions(mention.type);
      console.log('🔍 Generated suggestions:', suggestions.length, suggestions);
      setMentionSuggestions(suggestions);
      setShowMentionDropdown(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentionDropdown(false);
      setMentionType('');
      setMentionSuggestions([]);
    }
  }, [setInputValue, inputRef, detectMention, generateSuggestions, getAllAvailableFiles]);

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = useCallback((e) => {
    if (!showMentionDropdown) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev < mentionSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev > 0 ? prev - 1 : mentionSuggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mentionSuggestions[selectedMentionIndex]) {
        handleMentionSelect(mentionSuggestions[selectedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentionDropdown(false);
      setMentionType('');
      setMentionSuggestions([]);
    }
  }, [showMentionDropdown, selectedMentionIndex, mentionSuggestions, handleMentionSelect]);

  // Clear mentions
  const clearMentions = useCallback(() => {
    setSelectedMentions([]);
  }, []);

  // Remove specific mention
  const removeMention = useCallback((mentionId) => {
    // Find the mention to remove
    const mentionToRemove = selectedMentions.find(mention => mention.id === mentionId);
    
    if (mentionToRemove) {
      // Remove from selected mentions
      setSelectedMentions(prev => prev.filter(mention => mention.id !== mentionId));
      
      // Remove the @mention text from the input
      const mentionPattern = `@${mentionToRemove.type}:${mentionToRemove.name}`;
      const updatedInput = inputValue.replace(mentionPattern, '').replace(/\s+/g, ' ').trim();
      
      // Update the input through the setInputValue function
      setInputValue(updatedInput);
    }
  }, [selectedMentions, inputValue, setInputValue]);

  // Get mention text for display
  const getMentionText = useCallback(() => {
    return selectedMentions.map(mention => `@${mention.type}:${mention.name}`).join(' ');
  }, [selectedMentions]);

  return {
    // State
    showMentionDropdown,
    mentionType,
    mentionSuggestions,
    selectedMentionIndex,
    dropdownPosition,
    selectedMentions,
    excelRowsDropdown,
    selectedExcelFile,
    codeLinesDropdown,
    selectedCodeFile,
    selectedLines,
    lastSelectedLine,
    
    // Actions
    handleInputChange,
    handleKeyDown,
    handleMentionSelect,
    clearMentions,
    removeMention,
    getMentionText,
    
    // Setters for advanced use cases
    setShowMentionDropdown,
    setMentionType,
    setMentionSuggestions,
    setSelectedMentionIndex,
    setSelectedMentions,
    setExcelRowsDropdown,
    setCodeLinesDropdown,
    setDropdownPosition
  };
};
