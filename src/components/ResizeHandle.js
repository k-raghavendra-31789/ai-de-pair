import React from 'react';
import { useTheme } from './ThemeContext';

const ResizeHandle = ({ onMouseDown, className = "", orientation = "vertical" }) => {
  const { colors } = useTheme();
  
  const isVertical = orientation === "vertical";
  const baseClasses = isVertical 
    ? `w-1 cursor-col-resize` 
    : `h-1 cursor-row-resize`;
  
  return (
    <div 
      className={`${baseClasses} ${colors.tertiary} hover:${colors.accentBg} flex-shrink-0 transition-colors ${className}`}
      onMouseDown={onMouseDown}
    />
  );
};

export default ResizeHandle;
