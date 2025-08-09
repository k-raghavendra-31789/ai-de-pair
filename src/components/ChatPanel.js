import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import CustomScrollbar from './CustomScrollbar';

const ChatPanel = ({ width, getAllAvailableFiles }) => {
  const { colors } = useTheme();
  const { state, actions } = useAppState();
  
  const { chatInput, selectedLLM, availableFiles, openTabs, excelFiles } = state;
  const { setChatInput, setSelectedLLM } = actions;
  
  // @mention detection state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionType, setMentionType] = useState(''); // 'file', 'context', 'code'
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedMentions, setSelectedMentions] = useState([]); // Array of selected files/mentions
  const textareaRef = useRef(null);
  
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
    // Check for duplicates
    const isDuplicate = selectedMentions.some(mention => 
      mention.name === selectedFile.name && mention.type === selectedFile.type
    );
    
    if (isDuplicate) {
      // Subtle notification for duplicate
      const tempAlert = document.createElement('div');
      tempAlert.textContent = `"${selectedFile.name}" is already selected`;
      tempAlert.className = 'fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-sm z-[9999]';
      document.body.appendChild(tempAlert);
      
      // Remove notification after 2 seconds
      setTimeout(() => {
        if (document.body.contains(tempAlert)) {
          document.body.removeChild(tempAlert);
        }
      }, 2000);
      
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

  // Remove a selected mention
  const removeMention = (mentionId) => {
    setSelectedMentions(prev => prev.filter(m => m.id !== mentionId));
  };

  // Generate suggestions based on mention type
  const generateSuggestions = (type) => {
    // Get fresh files from FileExplorer
    const allFiles = getAllAvailableFiles ? getAllAvailableFiles() : (availableFiles || []);
    
    switch (type) {
      case 'file':
        // Return all files from FileExplorer
        return allFiles.map(file => ({
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
        return allFiles
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
        return allFiles
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
      // Prepare message with attachments
      const messageData = {
        message: chatInput.trim(),
        attachments: selectedMentions.map(mention => ({
          fileType: mention.type,
          name: mention.name,
          path: mention.path,
          source: mention.source,
          isGitHub: mention.isGitHub,
          isCloud: mention.isCloud
        })),
        timestamp: new Date().toISOString()
      };
      
      // Handle message sending logic here
      console.log('Sending message with data:', messageData);
      
      // Clear input and mentions
      setChatInput('');
      setSelectedMentions([]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape' && showMentionDropdown) {
      setShowMentionDropdown(false);
      return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMentionDropdown) {
        setShowMentionDropdown(false);
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
        if (!dropdown) {
          setShowMentionDropdown(false);
        }
      }
    };

    if (showMentionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMentionDropdown]);

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

  return (
    <div 
      className={`${colors.secondary} ${colors.border} border-l flex flex-col h-full`}
      style={{ width }}
    >
      {/* Chat Header */}
      <div className={`p-4 ${colors.border} border-b`}>
        <h3 className={`text-sm font-medium ${colors.text}`}>CHAT</h3>
      </div>

      {/* Chat Messages */}
      <CustomScrollbar 
        className="flex-1"
        showHorizontal={false}
        showVertical={true}
      >
        <div className="p-4 h-full flex items-center justify-center">
          {/* Placeholder when no messages */}
          <div className="text-center max-w-md">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${colors.tertiary}`}>
              <svg className={`w-8 h-8 ${colors.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className={`text-lg font-semibold ${colors.text} mb-2`}>
              AI-Powered Development Assistant
            </h3>
            <p className={`text-sm ${colors.textMuted} leading-relaxed mb-4`}>
              Upload files, analyze Excel data, manage folders, and get AI assistance for your development tasks. 
              Use @DocumentName to reference uploaded files in your conversations.
            </p>
            <div className={`text-xs ${colors.textSecondary} space-y-1`}>
              <div>• Excel file analysis and visualization</div>
              <div>• File and folder management with persistence</div>
              <div>• Code generation and documentation</div>
              <div>• Multi-model AI assistance</div>
            </div>
          </div>
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
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colors.accent} border ${colors.border}`}
                    style={{
                      fontStyle: 'italic',
                      background: 'rgba(30, 41, 59, 0.85)', // dark slate with opacity
                      color: 'inherit',
                      marginRight: '0.4rem',
                      marginBottom: '0.2rem',
                      transition: 'background 0.2s'
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap' }}>
                      @{mention.type}[{mention.name}]
                    </span>
                    <button
                      onClick={() => removeMention(mention.id)}
                      className="ml-2 hover:bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold"
                      style={{ color: 'inherit', background: 'none', border: 'none', padding: 0, marginLeft: 6, cursor: 'pointer' }}
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
                      ? `${colors.accent} hover:opacity-80 text-white` 
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
            <div className={`p-2 text-xs ${colors.textSecondary} border-b ${colors.borderLight}`}>
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
                    <span className={`text-xs ${colors.textMuted} ml-2`}>
                      {suggestion.source === 'github' ? '📁' : 
                       suggestion.source === 'cloud' ? '☁️' : '💻'}
                    </span>
                  </div>
                  {suggestion.path !== suggestion.name && (
                    <div className={`text-xs ${colors.textMuted} truncate mt-1`}>
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
      </div>
    </div>
  );
};

export default ChatPanel;
