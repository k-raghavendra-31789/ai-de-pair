import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';

const Tooltip = ({ children, content, delay = 500 }) => {
  const { colors } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef(null);
  const elementRef = useRef(null);
  const tooltipRef = useRef(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (elementRef.current) {
        const rect = elementRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 8,
          left: rect.left + rect.width / 2
        });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Adjust tooltip position to stay within viewport
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      const tooltip = tooltipRef.current;
      const rect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newTop = position.top;
      let newLeft = position.left - rect.width / 2;

      // Adjust horizontal position with more padding from edges
      if (newLeft < 16) {
        newLeft = 16;
      } else if (newLeft + rect.width > viewportWidth - 16) {
        newLeft = viewportWidth - rect.width - 16;
      }

      // If tooltip is still too wide, position it from the left edge
      if (rect.width > viewportWidth - 32) {
        newLeft = 16;
      }

      // Adjust vertical position if tooltip goes below viewport
      if (position.top + rect.height > viewportHeight - 16) {
        newTop = position.top - rect.height - 16; // Show above instead
      }

      // Ensure tooltip doesn't go above viewport
      if (newTop < 16) {
        newTop = position.top + 24; // Show below with some spacing
      }

      setPosition({ top: newTop, left: newLeft });
    }
  }, [isVisible, position.top, position.left]);

  return (
    <>
      <div
        ref={elementRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="relative"
      >
        {children}
      </div>
      
      {isVisible && content && (
        <div
          ref={tooltipRef}
          className={`fixed z-50 px-3 py-2 text-xs rounded shadow-lg border pointer-events-none transition-opacity duration-200 ${colors.tooltip || `${colors.secondary} ${colors.border} ${colors.text}`}`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            maxWidth: '300px',
            minWidth: '120px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '11px',
            lineHeight: '1.4'
          }}
        >
          {content}
          {/* Tooltip arrow */}
          <div
            className={`absolute w-2 h-2 transform rotate-45 ${colors.secondary} ${colors.border} border-t border-l`}
            style={{
              top: '-4px',
              left: '50%',
              marginLeft: '-4px'
            }}
          />
        </div>
      )}
    </>
  );
};

export default Tooltip;
