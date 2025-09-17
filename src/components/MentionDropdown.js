import React, { useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';

/**
 * Reusable MentionDropdown component for @mentions functionality
 * Displays suggestions for @file, @context, and @code mentions
 */
const MentionDropdown = ({
  showMentionDropdown,
  mentionType,
  mentionSuggestions,
  selectedMentionIndex,
  onMentionSelect,
  position = 'bottom', // 'top' | 'bottom'
  className = '',
  style = {}
}) => {
  const { colors } = useTheme();
  const dropdownRef = useRef(null);
  const selectedItemRef = useRef(null);

  // Auto-scroll to selected item when selectedMentionIndex changes
  useEffect(() => {
    if (selectedItemRef.current && dropdownRef.current && selectedMentionIndex >= 0) {
      const selectedElement = selectedItemRef.current;
      const container = dropdownRef.current;
      
      const elementTop = selectedElement.offsetTop;
      const elementBottom = elementTop + selectedElement.offsetHeight;
      const containerTop = container.scrollTop;
      const containerBottom = containerTop + container.clientHeight;
      
      // Scroll down if element is below visible area
      if (elementBottom > containerBottom) {
        container.scrollTop = elementBottom - container.clientHeight;
      }
      // Scroll up if element is above visible area
      else if (elementTop < containerTop) {
        container.scrollTop = elementTop;
      }
    }
  }, [selectedMentionIndex]);

  if (!showMentionDropdown) {
    return null;
  }

  const positionStyles = position === 'top' ? {
    top: 'auto',
    bottom: '100%',
    marginBottom: '0.5rem'
  } : {
    top: '100%',
    marginTop: '0.5rem'
  };

  return (
    <div 
      ref={dropdownRef}
      data-mention-dropdown="true"
      className={`absolute z-[100000] ${colors.secondary} ${colors.border} border rounded-lg shadow-lg min-w-[250px] max-h-[200px] overflow-y-auto ${className}`}
      style={{
        left: '0',
        ...positionStyles,
        ...style
      }}
    >
      <div className={`p-2 text-xs ${colors.text} border-b ${colors.borderLight}`}>
        @{mentionType} suggestions ({mentionSuggestions.length} files):
      </div>
      {mentionSuggestions.length > 0 ? (
        mentionSuggestions.map((suggestion, index) => (
          <div 
            key={suggestion.id || index}
            ref={index === selectedMentionIndex ? selectedItemRef : null}
            className={`p-2 text-sm ${colors.text} cursor-pointer border-b ${colors.borderLight} last:border-b-0 ${
              index === selectedMentionIndex ? `${colors.accent} ${colors.hover}` : `hover:${colors.hover}`
            }`}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent input from losing focus
              onMentionSelect(suggestion);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMentionSelect(suggestion);
            }}
          >
            <div className="flex items-center justify-between">
              <span className="truncate flex-1">{suggestion.name}</span>
              <span className={`text-xs ${colors.textSecondary} ml-2`}>
                {suggestion.source === 'github' ? '📁' : 
                 suggestion.source === 'cloud' ? '☁️' : 
                 suggestion.source === 'memory' ? '🧠' : '💻'}
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
  );
};

export default MentionDropdown;
