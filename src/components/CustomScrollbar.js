import React from 'react';
import { useTheme } from './ThemeContext';

const CustomScrollbar = ({ 
  children, 
  className = '', 
  height = 'auto',
  maxHeight = 'none',
  showHorizontal = true,
  showVertical = true,
  scrollbarSize = 8  // New prop to control scrollbar size
}) => {
  const { theme } = useTheme();
  
  // VS Code style scrollbar colors based on theme
  const scrollbarStyles = {
    dark: {
      track: '#2d2d30',
      thumb: '#424245',
      thumbHover: '#4f4f55',
      thumbActive: '#6c6c70'
    },
    light: {
      track: '#f3f3f3',
      thumb: '#c1c1c1',
      thumbHover: '#a8a8a8',
      thumbActive: '#787878'
    }
  };

  const colors = scrollbarStyles[theme];

  const scrollbarCSS = `
    .vs-code-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: ${colors.thumb} ${colors.track};
    }

    .vs-code-scrollbar::-webkit-scrollbar {
      width: ${scrollbarSize}px;
      height: ${scrollbarSize}px;
    }

    .vs-code-scrollbar::-webkit-scrollbar-track {
      background: ${colors.track};
      border-radius: 0;
    }

    .vs-code-scrollbar::-webkit-scrollbar-thumb {
      background: ${colors.thumb};
      border-radius: ${scrollbarSize / 2}px;
      border: 1px solid ${colors.track};
      transition: background-color 0.2s ease;
    }

    .vs-code-scrollbar::-webkit-scrollbar-thumb:hover {
      background: ${colors.thumbHover};
    }

    .vs-code-scrollbar::-webkit-scrollbar-thumb:active {
      background: ${colors.thumbActive};
    }

    .vs-code-scrollbar::-webkit-scrollbar-corner {
      background: ${colors.track};
    }

    /* Hide scrollbars when not needed */
    ${!showHorizontal ? `
      .vs-code-scrollbar::-webkit-scrollbar:horizontal {
        display: none;
      }
    ` : ''}

    ${!showVertical ? `
      .vs-code-scrollbar::-webkit-scrollbar:vertical {
        display: none;
      }
    ` : ''}

    /* Custom scrollbar animation */
    .vs-code-scrollbar::-webkit-scrollbar-thumb {
      opacity: 0.7;
    }

    .vs-code-scrollbar:hover::-webkit-scrollbar-thumb {
      opacity: 1;
    }
  `;

  return (
    <>
      <style>{scrollbarCSS}</style>
      <div 
        className={`vs-code-scrollbar overflow-auto ${className}`}
        style={{ 
          height: height,
          maxHeight: maxHeight
        }}
      >
        {children}
      </div>
    </>
  );
};

export default CustomScrollbar;
