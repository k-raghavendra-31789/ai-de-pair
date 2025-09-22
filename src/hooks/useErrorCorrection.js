/**
 * useErrorCorrection Hook
 * Manages error correction state and interactions between TerminalPanel and MonacoEditor
 */

import { useState, useEffect, useCallback } from 'react';
import aiErrorCorrectionService from '../services/AIErrorCorrectionService';

export const useErrorCorrection = () => {
  const [isErrorCorrectionMode, setIsErrorCorrectionMode] = useState(false);
  const [currentError, setCurrentError] = useState(null);
  const [isProcessingCorrection, setIsProcessingCorrection] = useState(false);

  /**
   * Initialize error correction mode with error context
   * @param {Object} errorContext - Error context from terminal
   * @param {Function} onModeActivated - Callback when mode is activated
   */
  const initializeErrorCorrection = useCallback((errorContext, onModeActivated) => {
    if (errorContext?.hasError) {
      aiErrorCorrectionService.setErrorContext(errorContext);
      setCurrentError(errorContext);
      setIsErrorCorrectionMode(true);
      
      console.log('🎯 Error correction mode activated:', {
        errorType: errorContext.errorType,
        errorMessage: errorContext.errorMessage?.substring(0, 100) + '...'
      });

      // Callback to parent component
      if (onModeActivated) {
        onModeActivated(errorContext);
      }
    }
  }, []);

  /**
   * Exit error correction mode
   */
  const exitErrorCorrectionMode = useCallback(() => {
    aiErrorCorrectionService.clearErrorContext();
    setCurrentError(null);
    setIsErrorCorrectionMode(false);
    setIsProcessingCorrection(false);
    
    console.log('🚪 Error correction mode exited');
  }, []);

  /**
   * Process AI correction request
   * @param {string} userInstructions - User's correction instructions
   * @param {string} currentCode - Current code content
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Correction result
   */
  const processCorrection = useCallback(async (userInstructions, currentCode, language = 'sql') => {
    if (!isErrorCorrectionMode || !currentError) {
      throw new Error('Error correction mode not active');
    }

    setIsProcessingCorrection(true);
    
    try {
      console.log('🤖 Processing AI correction:', {
        instructionsLength: userInstructions?.length,
        codeLength: currentCode?.length,
        language
      });

      const result = await aiErrorCorrectionService.requestCorrection(
        userInstructions,
        currentCode,
        language
      );

      if (result.success) {
        console.log('✅ AI correction successful');
        return result;
      } else {
        console.error('❌ AI correction failed:', result.error);
        throw new Error(result.error || 'AI correction failed');
      }
    } catch (error) {
      console.error('❌ Error processing correction:', error);
      throw error;
    } finally {
      setIsProcessingCorrection(false);
    }
  }, [isErrorCorrectionMode, currentError]);

  /**
   * Check if we have an active error context
   */
  const hasActiveError = useCallback(() => {
    return currentError?.hasError && isErrorCorrectionMode;
  }, [currentError, isErrorCorrectionMode]);

  /**
   * Get formatted error message for display
   */
  const getFormattedErrorMessage = useCallback(() => {
    if (!currentError?.hasError) return null;
    
    return {
      type: currentError.errorType,
      message: currentError.errorMessage,
      source: currentError.source,
      timestamp: currentError.timestamp
    };
  }, [currentError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isErrorCorrectionMode) {
        exitErrorCorrectionMode();
      }
    };
  }, [isErrorCorrectionMode, exitErrorCorrectionMode]);

  return {
    // State
    isErrorCorrectionMode,
    currentError,
    isProcessingCorrection,
    
    // Actions
    initializeErrorCorrection,
    exitErrorCorrectionMode,
    processCorrection,
    
    // Helpers
    hasActiveError,
    getFormattedErrorMessage
  };
};
