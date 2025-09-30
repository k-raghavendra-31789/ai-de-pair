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
      primary: 'bg-gray-900',
      secondary: 'bg-gray-800',
      tertiary: 'bg-gray-700',
      quaternary: 'bg-gray-600',
      text: 'text-white',
      textSecondary: 'text-gray-300',
      textMuted: 'text-gray-500',
      border: 'border-gray-700',
      borderLight: 'border-gray-600',
      hover: 'hover:bg-gray-700',
      tooltip: 'bg-gray-700 border-gray-600 text-gray-200',
      active: 'bg-gray-700',
      accent: 'text-blue-400',
      accentBg: 'bg-blue-500',
      accentBgLight: 'bg-blue-500/20',
      chatUserBg: 'bg-blue-500/30',
      chatAiBg: 'bg-gray-700/30',
      error: 'text-red-400',
      errorBg: 'bg-red-900',
      errorBorder: 'border-red-500',
      warning: 'text-orange-400',
      success: 'text-green-400',
      successBg: 'bg-green-500',
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
