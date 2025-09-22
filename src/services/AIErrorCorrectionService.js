/**
 * AI Error Correction Service
 * Handles error detection, context extraction, and AI-powered code correction
 */

class AIErrorCorrectionService {
  constructor() {
    this.isActive = false;
    this.currentError = null;
    this.currentContext = null;
  }

  /**
   * Extract error context from terminal panel data
   * @param {Object} displayData - The terminal panel display data
   * @returns {Object} Extracted error context
   */
  extractErrorContext(displayData) {
    if (!displayData) return null;

    // Check for top-level error
    if (displayData.error) {
      return {
        hasError: true,
        errorType: 'execution_error',
        errorMessage: typeof displayData.error === 'string' ? displayData.error : JSON.stringify(displayData.error),
        source: 'terminal_execution',
        timestamp: new Date().toISOString()
      };
    }

    // Check for results-level error
    if (displayData.results?.status === 'error') {
      const resultError = displayData.results.error;
      let errorMessage = 'Unknown error occurred';

      if (resultError) {
        // Handle different error formats
        if (resultError.detail) {
          errorMessage = resultError.detail;
        } else if (resultError.message) {
          errorMessage = resultError.message;
        } else if (typeof resultError === 'string') {
          errorMessage = resultError;
        } else {
          errorMessage = JSON.stringify(resultError);
        }
      }

      return {
        hasError: true,
        errorType: 'query_error',
        errorMessage,
        source: 'sql_execution',
        timestamp: new Date().toISOString(),
        rawError: resultError
      };
    }

    return {
      hasError: false,
      errorType: null,
      errorMessage: null,
      source: null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Set the current error context for AI correction
   * @param {Object} errorContext - The error context to set
   */
  setErrorContext(errorContext) {
    this.currentError = errorContext;
    this.isActive = errorContext?.hasError || false;
    console.log('🎯 AIErrorCorrectionService: Error context set:', {
      isActive: this.isActive,
      errorType: errorContext?.errorType,
      hasError: errorContext?.hasError
    });
  }

  /**
   * Get the current error context
   * @returns {Object} Current error context
   */
  getErrorContext() {
    return this.currentError;
  }

  /**
   * Check if error correction mode is active
   * @returns {boolean} True if active
   */
  isErrorCorrectionActive() {
    return this.isActive && this.currentError?.hasError;
  }

  /**
   * Generate AI prompt with error context and user instructions
   * @param {string} userInstructions - User provided correction instructions
   * @param {string} currentCode - The current code that has errors
   * @param {string} codeLanguage - The programming language (sql, python, etc.)
   * @returns {Object} Formatted prompt for AI service
   */
  generateAIPrompt(userInstructions, currentCode, codeLanguage = 'sql') {
    if (!this.currentError || !this.currentError.hasError) {
      throw new Error('No error context available for AI correction');
    }

    const prompt = {
      system: `You are an expert code assistant specializing in fixing ${codeLanguage.toUpperCase()} errors. 
      You will be provided with code that has an error, the error message, and user instructions for fixing it.
      Your task is to provide a corrected version of the code that resolves the error while following the user's instructions.
      
      Guidelines:
      1. Analyze the error message carefully to understand the root cause
      2. Apply the user's correction instructions
      3. Ensure the corrected code is syntactically correct and follows best practices
      4. Maintain the original intent and logic of the code where possible
      5. Only return the corrected code, no explanations unless specifically requested`,
      
      user: `Please fix the following ${codeLanguage.toUpperCase()} code:

**Error Information:**
- Error Type: ${this.currentError.errorType}
- Error Message: ${this.currentError.errorMessage}
- Source: ${this.currentError.source}

**Current Code:**
\`\`\`${codeLanguage}
${currentCode}
\`\`\`

**User Instructions:**
${userInstructions}

**Please provide the corrected code:**`,
      
      context: {
        errorType: this.currentError.errorType,
        errorMessage: this.currentError.errorMessage,
        codeLanguage,
        timestamp: this.currentError.timestamp
      }
    };

    console.log('🤖 Generated AI prompt:', {
      hasError: this.currentError.hasError,
      errorType: this.currentError.errorType,
      codeLength: currentCode?.length,
      instructionsLength: userInstructions?.length
    });

    return prompt;
  }

  /**
   * Create an onCodeCorrection callback that integrates with existing Monaco correction flow
   * @param {string} codeLanguage - The programming language (sql, python, etc.)
   * @returns {Function} Callback function for Monaco Editor
   */
  createCorrectionCallback(codeLanguage = 'sql') {
    return async (selectedText, context, customInstructions, selectedMentions) => {
      try {
        console.log('🤖 AIErrorCorrectionService: Creating correction callback for:', {
          language: codeLanguage,
          hasError: this.currentError?.hasError,
          hasInstructions: !!customInstructions,
          codeLength: selectedText?.length
        });

        // If we have error context, use it; otherwise use the provided instructions
        let correctionInstructions = customInstructions;
        
        if (this.currentError?.hasError) {
          // Combine error context with user instructions
          const errorContext = `Error: ${this.currentError.errorMessage}`;
          correctionInstructions = customInstructions 
            ? `${errorContext}\n\nUser Instructions: ${customInstructions}`
            : errorContext;
        }

        const result = await this.requestCorrection(
          correctionInstructions,
          selectedText,
          codeLanguage
        );

        if (result.success) {
          console.log('✅ AIErrorCorrectionService: Correction successful');
          console.log('🔍 Returning corrected code:', {
            hasCorrectedCode: !!result.correctedCode,
            codeLength: result.correctedCode?.length,
            codePreview: result.correctedCode?.substring(0, 100) + '...'
          });
          return result.correctedCode;
        } else {
          console.error('❌ AIErrorCorrectionService: Correction failed:', result.error);
          throw new Error(result.error || 'AI correction failed');
        }
      } catch (error) {
        console.error('❌ AIErrorCorrectionService: Callback error:', error);
        throw error;
      }
    };
  }

  /**
   * Send correction request to AI backend
   * @param {string} userInstructions - User instructions for correction
   * @param {string} currentCode - Current code with errors
   * @param {string} codeLanguage - Programming language
   * @returns {Promise<Object>} AI correction response
   */
  async requestCorrection(userInstructions, currentCode, codeLanguage = 'sql') {
    try {
      const prompt = this.generateAIPrompt(userInstructions, currentCode, codeLanguage);
      
      console.log('🤖 AIErrorCorrectionService: Sending correction request to backend...');
      
      // Use existing backend endpoint for code transformation
      const transformRequest = {
        code: currentCode,
        fileName: `error_correction.${codeLanguage}`,
        language: codeLanguage,
        userInstructions: userInstructions,
        errorContext: this.currentError,
        timestamp: new Date().toISOString(),
        sessionId: `error_fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      console.log('🚀 Sending to transform-code endpoint:', {
        endpoint: 'http://localhost:8000/api/v1/data/transform-code',
        hasErrorContext: !!this.currentError?.hasError,
        codeLength: currentCode?.length
      });

      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000); // 30 second timeout

      try {
        const response = await fetch('http://localhost:8000/api/v1/data/transform-code', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transformRequest),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Backend error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        console.log('🔍 Full backend response:', result);
        console.log('✅ AI correction received from backend:', {
          hasTransformedCode: !!result.transformedCode,
          hasCorrectedCode: !!result.correctedCode,
          hasCode: !!result.code,
          hasData: !!result.data,
          hasDataTransformedCode: !!result.data?.transformedCode,
          transformedCodeLength: result.transformedCode?.length,
          correctedCodeLength: result.correctedCode?.length,
          codeLength: result.code?.length,
          dataTransformedCodeLength: result.data?.transformedCode?.length,
          responseKeys: Object.keys(result)
        });

        // Handle different response formats from backend
        // Check if corrected code is in data.transformedCode (new backend format)
        const correctedCode = result.data?.transformedCode || result.transformedCode || result.correctedCode || result.code;
        
        console.log('🎯 Extracted corrected code:', {
          hasCorrectedCode: !!correctedCode,
          codeLength: correctedCode?.length,
          codePreview: correctedCode?.substring(0, 100) + '...'
        });
        
        if (!correctedCode) {
          console.error('❌ No corrected code found in response:', result);
          throw new Error('No corrected code received from backend');
        }

        return {
          success: true,
          correctedCode: correctedCode,
          explanation: result.explanation || 'AI-powered error correction applied',
          confidence: result.confidence || 0.9,
          timestamp: new Date().toISOString()
        };

      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('AI correction request timed out. Please try again.');
        }
        
        throw fetchError;
      }
      
    } catch (error) {
      console.error('❌ AI correction failed:', error);
      
      // Fallback to mock for development if backend is not available
      if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
        console.log('🧪 Backend unavailable, falling back to mock correction...');
        const mockResult = await this.mockAICorrection({}, currentCode, codeLanguage);
        return {
          success: true,
          correctedCode: mockResult.correctedCode,
          explanation: mockResult.explanation + ' (Mock fallback - backend unavailable)',
          confidence: 0.5,
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Mock AI correction for testing purposes
   * TODO: Replace with actual AI service integration
   */
  async mockAICorrection(prompt, currentCode, codeLanguage) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🧪 Mock AI correction processing:', {
      language: codeLanguage,
      codeLength: currentCode?.length,
      hasErrorContext: !!this.currentError?.hasError
    });

    // Simple mock corrections based on common error patterns
    let correctedCode = currentCode;
    
    if (codeLanguage === 'sql' || codeLanguage === 'SQL') {
      // Common SQL error corrections
      correctedCode = this.mockSQLCorrections(currentCode);
    } else if (codeLanguage === 'python' || codeLanguage === 'Python') {
      // Common Python error corrections
      correctedCode = this.mockPythonCorrections(currentCode);
    }
    
    return {
      correctedCode,
      explanation: `Mock correction applied for ${codeLanguage} code`,
      confidence: 0.85
    };
  }

  /**
   * Mock SQL corrections for common error patterns
   */
  mockSQLCorrections(code) {
    let corrected = code;
    
    // Fix missing semicolons
    if (!corrected.trim().endsWith(';')) {
      corrected = corrected.trim() + ';';
    }
    
    // Fix common SQL syntax issues
    corrected = corrected
      .replace(/\bselect\b/gi, 'SELECT')
      .replace(/\bfrom\b/gi, 'FROM')
      .replace(/\bwhere\b/gi, 'WHERE')
      .replace(/\border by\b/gi, 'ORDER BY')
      .replace(/\bgroup by\b/gi, 'GROUP BY')
      .replace(/\blimit\b/gi, 'LIMIT');
    
    // Add comment indicating this is a mock correction
    corrected = `-- Mock AI correction applied\n${corrected}`;
    
    return corrected;
  }

  /**
   * Mock Python corrections for common error patterns
   */
  mockPythonCorrections(code) {
    let corrected = code;
    
    // Fix common indentation issues (basic)
    const lines = corrected.split('\n');
    const fixedLines = lines.map(line => {
      // Simple indentation fix - ensure proper spacing
      if (line.trim().startsWith('if ') || line.trim().startsWith('for ') || 
          line.trim().startsWith('while ') || line.trim().startsWith('def ')) {
        return line.trimStart();
      }
      return line;
    });
    
    corrected = fixedLines.join('\n');
    
    // Add comment indicating this is a mock correction
    corrected = `# Mock AI correction applied\n${corrected}`;
    
    return corrected;
  }

  /**
   * Clear the current error context
   */
  clearErrorContext() {
    this.currentError = null;
    this.isActive = false;
    console.log('🧹 AIErrorCorrectionService: Error context cleared');
  }

  /**
   * Reset the service state
   */
  reset() {
    this.clearErrorContext();
  }
}

// Create singleton instance
const aiErrorCorrectionService = new AIErrorCorrectionService();

export default aiErrorCorrectionService;
