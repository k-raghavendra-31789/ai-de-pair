import React, { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
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
      error: 'text-red-400',
      errorBg: 'bg-red-900',
      errorBorder: 'border-red-500',
      warning: 'text-orange-400',
      success: 'text-green-400',
      successBg: 'bg-green-500',
    },
    light: {
      primary: 'bg-white',
      secondary: 'bg-gray-100',
      tertiary: 'bg-gray-200',
      quaternary: 'bg-gray-300',
      text: 'text-gray-900',
      textSecondary: 'text-gray-700',
      textMuted: 'text-gray-500',
      border: 'border-gray-300',
      borderLight: 'border-gray-200',
      hover: 'hover:bg-gray-200',
      active: 'bg-gray-200',
      accent: 'text-blue-600',
      accentBg: 'bg-blue-500',
      tooltip: 'bg-gray-800 border-gray-600 text-gray-100',
      error: 'text-red-600',
      errorBg: 'bg-red-100',
      errorBorder: 'border-red-300',
      warning: 'text-orange-600',
      success: 'text-green-600',
      successBg: 'bg-green-500',
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      colors: themes[theme] 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
