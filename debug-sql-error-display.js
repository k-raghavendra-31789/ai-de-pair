// Test script to debug SQL error display
// Run this in browser console to test error handling

console.log('Testing SQL error handling...');

// Test case 1: Check if we can see the current state
const testCurrentState = () => {
  console.log('Current SQL execution state:', window.appState?.sqlExecution);
  console.log('Result tabs:', window.appState?.sqlExecution?.resultTabs);
  console.log('Active tab:', window.appState?.sqlExecution?.activeTabId);
};

// Test case 2: Simulate an error response
const testErrorResponse = () => {
  const mockError = {
    detail: "[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `orderkey` cannot be resolved..."
  };
  
  console.log('Mock error:', mockError);
  console.log('Error message:', mockError.detail);
};

// Test case 3: Check terminal panel visibility
const checkTerminalPanel = () => {
  const terminalPanel = document.querySelector('[data-testid="terminal-panel"]') || 
                       document.querySelector('.terminal-panel') ||
                       document.querySelector('[class*="terminal"]');
  
  console.log('Terminal panel element:', terminalPanel);
  
  const errorElements = document.querySelectorAll('[class*="error"], [class*="red"]');
  console.log('Error elements on page:', errorElements);
};

console.log('Run testCurrentState(), testErrorResponse(), or checkTerminalPanel() to debug');
