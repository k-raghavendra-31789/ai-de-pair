import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage for saved theme, default to 'light'
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Update HTML class and localStorage when theme changes
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
      document.documentElement.classList.remove('dark-mode');
    } else {
      document.documentElement.classList.add('dark-mode');
      document.documentElement.classList.remove('light-mode');
    }
    
    // Save theme to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setIsTransitioning(true);
    
    // Add CSS class to disable transitions
    document.body.classList.add('theme-transitioning');
    
    // Change theme immediately
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    
    // Re-enable transitions after a short delay
    setTimeout(() => {
      document.body.classList.remove('theme-transitioning');
      setIsTransitioning(false);
    }, 100);
  };

  const themes = {
    dark: {
      primary: 'bg-[#1e1e1e]',        // Very dark background like VS Code
      secondary: 'bg-[#252526]',      // Slightly lighter panels
      tertiary: 'bg-[#2d2d30]',       // Sidebar/panel backgrounds
      quaternary: 'bg-[#383838]',     // Input/button backgrounds
      text: 'text-[#cccccc]',         // Soft white text, easier on eyes
      textSecondary: 'text-[#9d9d9d]', // Muted text for labels
      textMuted: 'text-[#6a6a6a]',    // Very muted text for hints
      border: 'border-[#3e3e42]',     // Subtle borders
      borderLight: 'border-[#464647]', // Slightly more visible borders
      hover: 'hover:bg-[#2a2a2b]',    // Subtle hover state
      tooltip: 'bg-[#1e1e1e] border-[#464647] text-[#cccccc]',
      active: 'bg-[#37373d]',         // Active/selected state
      accent: 'text-[#4fc3f7]',       // Nice blue accent color
      accentBg: 'bg-[#0e639c]',       // Blue background
      accentBgLight: 'bg-[#4fc3f7]/20', // Light blue background
      chatUserBg: 'bg-[#0e639c]/25',  // User message background
      chatAiBg: 'bg-[#252526]/60',    // AI message background
      error: 'text-[#f44747]',        // Red error color
      errorBg: 'bg-[#5a1d1d]',        // Dark red background
      errorBorder: 'border-[#be1100]', // Red border
      warning: 'text-[#ffcc02]',      // Yellow warning
      success: 'text-[#89d185]',      // Green success
      successBg: 'bg-[#0e639c]',      // Use accent for success bg
    },
    light: {
      primary: 'bg-white',
      secondary: 'bg-gray-50',
      tertiary: 'bg-gray-100',
      quaternary: 'bg-gray-200',
      text: 'text-gray-800 font-medium', // Darker and medium weight
      textSecondary: 'text-gray-600 font-medium', // Darker and medium weight  
      textMuted: 'text-gray-700 font-normal', // Much darker muted text for better visibility
      border: 'border-gray-400',
      borderLight: 'border-gray-300', // Darker borders for table cells
      hover: 'hover:bg-gray-100',
      active: 'bg-gray-100',
      accent: 'text-blue-700 font-medium', // Darker blue with medium weight
      accentBg: 'bg-blue-500',
      accentBgLight: 'bg-blue-500/20',
      chatUserBg: 'bg-blue-500/20',
      chatAiBg: 'bg-gray-100/80',
      tooltip: 'bg-gray-800 border-gray-600 text-gray-100',
      error: 'text-red-700 font-medium', // Darker red with medium weight
      errorBg: 'bg-red-50',
      errorBorder: 'border-red-300',
      warning: 'text-orange-700 font-medium', // Darker orange with medium weight
      success: 'text-green-700 font-medium', // Darker green with medium weight
      successBg: 'bg-green-500',
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      colors: themes[theme],
      isTransitioning
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
