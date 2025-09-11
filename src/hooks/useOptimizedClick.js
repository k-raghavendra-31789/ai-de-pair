import { useCallback, useRef } from 'react';

/**
 * Custom hook to optimize click performance and prevent rapid-fire clicks
 * @param {Function} onClick - The click handler function
 * @param {number} delay - Minimum delay between clicks in milliseconds (default: 100)
 * @returns {Function} - Optimized click handler
 */
export const useOptimizedClick = (onClick, delay = 100) => {
  const lastClickTime = useRef(0);
  
  const optimizedClick = useCallback((...args) => {
    const now = Date.now();
    
    // Prevent rapid clicks
    if (now - lastClickTime.current < delay) {
      return;
    }
    
    lastClickTime.current = now;
    
    // Execute the click handler immediately for UI responsiveness
    if (onClick) {
      onClick(...args);
    }
  }, [onClick, delay]);
  
  return optimizedClick;
};

/**
 * Custom hook for async operations that need immediate UI feedback
 * @param {Function} asyncOperation - The async operation to perform
 * @param {Function} immediateCallback - Immediate callback for UI updates
 * @returns {Function} - Optimized async handler
 */
export const useOptimizedAsync = (asyncOperation, immediateCallback) => {
  const optimizedHandler = useCallback((...args) => {
    // Execute immediate callback first for responsive UI
    if (immediateCallback) {
      immediateCallback(...args);
    }
    
    // Execute async operation without blocking UI
    if (asyncOperation) {
      requestAnimationFrame(() => {
        asyncOperation(...args);
      });
    }
  }, [asyncOperation, immediateCallback]);
  
  return optimizedHandler;
};

export default { useOptimizedClick, useOptimizedAsync };
