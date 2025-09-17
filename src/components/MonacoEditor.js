import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import * as XLSX from 'xlsx';
import { useTheme } from './ThemeContext';
import { HiSparkles } from 'react-icons/hi2';
import { useMentions } from '../hooks/useMentions';
import MentionDropdown from './MentionDropdown';

// Self-host Monaco workers using CDN
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'sass') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

const MonacoEditor = ({ 
  value, 
  onChange, 
  language = 'plaintext', 
  fileName = '',
  onSave,
  onGitCommit, // New prop for Git commit callback
  onCodeCorrection, // New prop for AI code correction callback
  wordWrap = false,
  // New props for @mentions support
  getAllAvailableFiles, // Function to get available files
  additionalFiles = {}, // Additional files (memoryFiles, excelFiles, etc.)
  showToast // Toast notification function
}) => {
  const { theme } = useTheme() || { theme: 'dark' }; // Fallback to dark theme if context is unavailable
  
  // Early return if theme context is not available
  if (!theme) {
    console.warn('MonacoEditor: Theme context not available, using default theme');
  }
  
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const monacoInstance = useRef(null);
  const resizeObserver = useRef(null);
  
  // State for inline correction feature
  const [showCorrectionToolbar, setShowCorrectionToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [selectedCode, setSelectedCode] = useState('');
  const [selectionRange, setSelectionRange] = useState(null);
  const [isRequestingCorrection, setIsRequestingCorrection] = useState(false);
  const [correctionSpinnerWidget, setCorrectionSpinnerWidget] = useState(null);
  const [userInstructions, setUserInstructions] = useState('');
  const [showInstructionsArea, setShowInstructionsArea] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false); // Loading state for AI processing
  const [isStreamingCode, setIsStreamingCode] = useState(false); // Streaming state for code insertion
  // UI state for the correction toolbar - now instruction-based
  const [localSelectedExcelFile, setLocalSelectedExcelFile] = useState(null); // Local Excel file state
  
  // State for Monaco diff editor (keep for potential future use, but use inline approach)
  const [showDiffEditor, setShowDiffEditor] = useState(false);
  const [diffEditorRef, setDiffEditorRef] = useState(null);
  const [originalCode, setOriginalCode] = useState('');
  const [correctedCode, setCorrectedCode] = useState('');
  const [diffSelection, setDiffSelection] = useState(null);
  
  // State for inline diff
  const [inlineDiffActive, setInlineDiffActive] = useState(false);
  const [inlineDiffDecorations, setInlineDiffDecorations] = useState([]);
  const [inlineDiffWidget, setInlineDiffWidget] = useState(null);
  
  // State for smart selection handling
  const [selectionTimeout, setSelectionTimeout] = useState(null);
  const [isUserSelecting, setIsUserSelecting] = useState(false);

  // Add useRef for the textarea in the correction toolbar
  const instructionsTextareaRef = useRef(null);

  // Add @mentions functionality to the instructions textarea
  const {
    showMentionDropdown,
    mentionType,
    mentionSuggestions,
    selectedMentionIndex,
    selectedMentions,
    excelRowsDropdown,
    selectedExcelFile,
    setExcelRowsDropdown,
    setSelectedMentions,
    setShowMentionDropdown,
    handleInputChange,
    handleKeyDown,
    handleMentionSelect,
    clearMentions,
    removeMention,
    getMentionText
  } = useMentions(
    userInstructions,
    setUserInstructions,
    instructionsTextareaRef,
    getAllAvailableFiles,
    additionalFiles,
    showToast
  );

  // Debug: Log mentions state when it changes (simplified)
  useEffect(() => {
    if (selectedMentions.length > 0) {
      console.log('🔍 Selected mentions updated:', selectedMentions);
      selectedMentions.forEach((mention, index) => {
        console.log(`🔍 Mention ${index}:`, {
          name: mention.name, 
          type: mention.type, 
          hasExcelData: !!mention.excelData,
          excelData: mention.excelData,
          fullMention: mention
        });
      });
    }
  }, [selectedMentions]);

  // Helper function to check if file is Excel
  const isExcelFile = useCallback((fileName) => {
    const excelExtensions = ['.xlsx', '.xls', '.csv'];
    return excelExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }, []);

  // Helper function to get Excel data from AppState
  const getExcelDataForFile = useCallback((fileName) => {
    try {
      // Check if we have excelFiles
      if (!additionalFiles?.excelFiles) {
        return null;
      }

      // Look for Excel file by searching through all excelFiles keys
      const excelFileKey = Object.keys(additionalFiles.excelFiles).find(key => {
        return key.includes(fileName);
      });

      if (!excelFileKey) {
        return null;
      }

      // Get the Excel file data directly
      const fileData = additionalFiles.excelFiles[excelFileKey];
      
      if (!fileData || !fileData.content) {
        return null;
      }
      
      // Parse Excel content (assuming XLSX library is available)
      if (typeof XLSX === 'undefined') {
        console.warn('XLSX library not available for Excel parsing');
        return null;
      }
      
      const workbook = XLSX.read(fileData.content, { type: 'array' });
      const sheetNames = workbook.SheetNames;
      const sheetsData = {};
      
      // Process each sheet
      sheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '', 
          raw: false 
        });
        
        // Get header row and data rows
        const headers = jsonData[0] || [];
        const dataRows = jsonData.slice(1);
        
        sheetsData[sheetName] = {
          headers,
          rows: dataRows,
          totalRows: dataRows.length
        };
      });
      
      const result = {
        fileName,
        tabId: excelFileKey, // Use the excel file key as the tab ID
        sheetNames,
        sheetsData,
        activeSheet: fileData.activeSheet || sheetNames[0]
      };
      
      return result;
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      return null;
    }
  }, [additionalFiles]);

  // Handle Excel row selection
  const handleExcelRowSelect = useCallback((rowData, rowIndex, sheetName) => {
    console.log('🔍 Excel row clicked:', { rowData, rowIndex, sheetName });
    
    const currentExcelFile = localSelectedExcelFile || selectedExcelFile;
    
    if (!currentExcelFile) {
      console.error('No Excel file selected');
      return;
    }

    if (!excelRowsDropdown || !excelRowsDropdown.sheetsData || !excelRowsDropdown.sheetsData[sheetName]) {
      console.error('Excel sheet data not found');
      return;
    }
    
    const mention = {
      id: `${currentExcelFile.name}-${sheetName}-row${rowIndex}-${Date.now()}-${Math.random()}`,
      name: currentExcelFile.name,
      path: currentExcelFile.path,
      type: 'context',
      source: currentExcelFile.source,
      isGitHub: currentExcelFile.isGitHub || false,
      isCloud: currentExcelFile.isCloud || false,
      excelData: {
        sheetName: sheetName,
        rowIndex: rowIndex,
        rowData: rowData,
        headers: excelRowsDropdown.sheetsData[sheetName].headers || []
      }
    };
    
    console.log('🔍 Adding Excel mention with excelData:', mention);
    console.log('🔍 ExcelData structure:', mention.excelData);
    
    // Add directly to selected mentions using the setter from useMentions hook
    // This bypasses any processing that might strip the excelData
    setSelectedMentions(prev => {
      const updated = [...prev, mention];
      console.log('🔍 Updated selectedMentions after Excel mention:', updated);
      return updated;
    });
    
    // Update the textarea content to show the mention
    const mentionText = `@context:${currentExcelFile.name} `;
    setUserInstructions(prev => prev + mentionText);
    
    // Close all dropdowns but keep the main toolbar open
    setExcelRowsDropdown(null);
    setLocalSelectedExcelFile(null);
    setShowMentionDropdown(false); // Close the @mention dropdown too
    
    // Ensure the toolbar stays visible and textarea is focused
    setTimeout(() => {
      if (instructionsTextareaRef.current) {
        instructionsTextareaRef.current.focus();
        // Move cursor to end
        const length = instructionsTextareaRef.current.value.length;
        instructionsTextareaRef.current.setSelectionRange(length, length);
      }
    }, 100);
  }, [localSelectedExcelFile, selectedExcelFile, excelRowsDropdown, setSelectedMentions, setUserInstructions, setExcelRowsDropdown, setShowMentionDropdown]);

  // Handle Excel sheet change in dropdown
  const handleExcelSheetChange = useCallback((sheetName) => {
    console.log('🔍 Excel sheet clicked:', sheetName);
    
    if (excelRowsDropdown) {
      setExcelRowsDropdown({
        ...excelRowsDropdown,
        activeSheet: sheetName
      });
    }
  }, [excelRowsDropdown, setExcelRowsDropdown]);

  // Override mention select to handle Excel files
  const handleMentionSelectWithExcel = useCallback((selectedFile) => {
    // Check if this is a context mention with an Excel file
    if (selectedFile.type === 'context' && isExcelFile(selectedFile.name)) {
      // Store the selected Excel file
      setLocalSelectedExcelFile(selectedFile);
      
      // For Excel files in context mode, show Excel rows dropdown instead of adding directly
      const excelData = getExcelDataForFile(selectedFile.name);
      
      if (excelData) {
        setExcelRowsDropdown(excelData);
        return; // Don't call the original handleMentionSelect
      }
    }
    
    // For non-Excel files, use the original handler
    handleMentionSelect(selectedFile);
  }, [isExcelFile, getExcelDataForFile, setExcelRowsDropdown, handleMentionSelect]);

  // Function to detect language from file extension
  const getLanguageFromFileName = (fileName) => {
    if (!fileName) return 'plaintext';
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const languageMap = {
      'sql': 'sql',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sh': 'shell',
      'bat': 'bat',
      'ps1': 'powershell',
      'php': 'php',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rb': 'ruby',
      'r': 'r',
      'scala': 'scala',
      'kt': 'kotlin',
      'swift': 'swift',
      'dart': 'dart',
      'ipynb': 'json', // Jupyter Notebooks
      'dbc': 'json', // Databricks Archives (often contain JSON)
      'txt': 'plaintext'
    };
    
    return languageMap[extension] || 'plaintext';
  };

  useEffect(() => {
    if (!containerRef.current || monacoInstance.current) {
      return;
    }

    try {
      // Ensure Monaco is available
      if (!monaco || !monaco.editor) {
        console.error('Monaco editor is not available');
        return;
      }

      // Extend Monaco's built-in SQL language with additional keywords
      monaco.languages.setLanguageConfiguration('sql', {
        keywords: [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 
          'ON', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'IN', 'BETWEEN', 'WITH',
          'ORDER', 'BY', 'GROUP', 'HAVING', 'DISTINCT', 'UNION', 'ALL', 'INTERSECT', 
          'EXCEPT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'EXISTS', 'ANY', 'SOME',
          'CAST', 'CONCAT', 'COALESCE', 'ISNULL', 'NULLIF', 'COUNT', 'SUM', 'AVG', 
          'MAX', 'MIN', 'SUBSTRING', 'LEN', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 
          'LTRIM', 'RTRIM', 'REPLACE', 'CHARINDEX', 'DATEPART', 'DATEDIFF', 'GETDATE', 
          'CONVERT', 'TRY_CAST', 'TRY_CONVERT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 
          'OVER', 'PARTITION', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
          'STRING','CURRENT_TIMESTAMP','LIMIT',
        ]
      });

      // Override SQL tokenizer with comprehensive keyword matching
      monaco.languages.setMonarchTokensProvider('sql', {
        ignoreCase: true,
        keywords: [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 
          'ON', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'IN', 'BETWEEN', 'WITH',
          'ORDER', 'BY', 'GROUP', 'HAVING', 'DISTINCT', 'UNION', 'ALL', 'INTERSECT', 
          'EXCEPT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'EXISTS', 'ANY', 'SOME',
          'CAST', 'CONCAT', 'COALESCE', 'ISNULL', 'NULLIF', 'COUNT', 'SUM', 'AVG', 
          'MAX', 'MIN', 'SUBSTRING', 'LEN', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 
          'LTRIM', 'RTRIM', 'REPLACE', 'CHARINDEX', 'DATEPART', 'DATEDIFF', 'GETDATE', 
          'CONVERT', 'TRY_CAST', 'TRY_CONVERT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 
          'OVER', 'PARTITION', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
          'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC', 
          'FLOAT', 'REAL', 'VARCHAR', 'CHAR', 'NVARCHAR', 'NCHAR', 'TEXT', 'NTEXT', 
          'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'TIMESTAMP', 'BIT', 'BINARY', 
          'VARBINARY', 'UNIQUEIDENTIFIER','STRING','CURRENT_TIMESTAMP','LIMIT'
        ],
        tokenizer: {
          root: [
            // Keywords
            [/[a-zA-Z_$][\w$]*/, {
              cases: {
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }],
            
            // Comments
            [/--.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
            
            // Strings
            [/'([^'\\]|\\.)*'/, 'string'],
            [/"([^"\\]|\\.)*"/, 'string'],
            
            // Numbers
            [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
            
            // Operators and delimiters
            [/[+\-*/=<>!]+/, 'operator'],
            [/[(){}[\],;.]/, 'delimiter'],
            [/\s+/, 'white'],
          ],
          comment: [
            [/[^/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[/*]/, 'comment']
          ]
        }
      });

      // Define minimal custom themes - override ALL token types
      monaco.editor.defineTheme('simple-light', {
        base: 'vs',
        inherit: false,
        rules: [
          { token: '', foreground: '000000' },
          { token: 'keyword', foreground: '0066CC' },
          { token: 'keyword.sql', foreground: '0066CC' },
          { token: 'keyword.python', foreground: '0066CC' },
          { token: 'string', foreground: '008000' },
          { token: 'string.sql', foreground: '008000' },
          { token: 'string.python', foreground: '008000' },
          { token: 'comment', foreground: '999999' },
          { token: 'comment.sql', foreground: '999999' },
          { token: 'comment.python', foreground: '999999' },
          { token: 'number', foreground: '800080' },
          { token: 'number.sql', foreground: '800080' },
          { token: 'number.python', foreground: '800080' },
          { token: 'number.float.python', foreground: '800080' },
          { token: 'identifier', foreground: '000000' },
          { token: 'identifier.sql', foreground: '000000' },
          { token: 'identifier.python', foreground: '000000' },
          { token: 'type.identifier.python', foreground: '0066CC' },
          { token: 'annotation.python', foreground: '666666' },
          { token: 'operator', foreground: '000000' },
          { token: 'operator.sql', foreground: '000000' },
          { token: 'operator.python', foreground: '000000' },
          { token: 'delimiter', foreground: '000000' },
          { token: 'delimiter.sql', foreground: '000000' },
          { token: 'delimiter.python', foreground: '000000' },
          { token: 'type', foreground: '000000' },
          { token: 'type.sql', foreground: '000000' },
          { token: 'variable', foreground: '000000' },
          { token: 'variable.sql', foreground: '000000' },
          { token: 'function', foreground: '000000' },
          { token: 'function.sql', foreground: '000000' },
          { token: 'predefined', foreground: '000000' },
          { token: 'predefined.sql', foreground: '000000' },
          { token: 'constant', foreground: '000000' },
          { token: 'constant.sql', foreground: '000000' },
          { token: 'tag', foreground: '000000' },
          { token: 'attribute', foreground: '000000' },
          { token: 'regexp', foreground: '000000' },
          { token: 'annotation', foreground: '000000' },
          { token: 'metatag', foreground: '000000' },
          { token: 'key', foreground: '000000' },
          { token: 'value', foreground: '000000' },
        ],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#000000',
          'editor.lineHighlightBackground': '#f5f5f5',
          'editorCursor.foreground': '#000000',
          'editor.selectionBackground': '#add6ff',
        }
      });

      monaco.editor.defineTheme('simple-dark', {
        base: 'vs-dark',
        inherit: false,
        rules: [
          { token: '', foreground: 'd4d4d4' },
          { token: 'keyword', foreground: '569cd6' },
          { token: 'keyword.sql', foreground: '569cd6' },
          { token: 'keyword.python', foreground: '569cd6' },
          { token: 'string', foreground: 'ce9178' },
          { token: 'string.sql', foreground: 'ce9178' },
          { token: 'string.python', foreground: 'ce9178' },
          { token: 'comment', foreground: '6a9955' },
          { token: 'comment.sql', foreground: '6a9955' },
          { token: 'comment.python', foreground: '6a9955' },
          { token: 'number', foreground: 'b5cea8' },
          { token: 'number.sql', foreground: 'b5cea8' },
          { token: 'number.python', foreground: 'b5cea8' },
          { token: 'number.float.python', foreground: 'b5cea8' },
          { token: 'identifier', foreground: 'd4d4d4' },
          { token: 'identifier.sql', foreground: 'd4d4d4' },
          { token: 'identifier.python', foreground: 'd4d4d4' },
          { token: 'type.identifier.python', foreground: '4ec9b0' },
          { token: 'annotation.python', foreground: '9cdcfe' },
          { token: 'operator', foreground: 'd4d4d4' },
          { token: 'operator.sql', foreground: 'd4d4d4' },
          { token: 'operator.python', foreground: 'd4d4d4' },
          { token: 'delimiter', foreground: 'd4d4d4' },
          { token: 'delimiter.sql', foreground: 'd4d4d4' },
          { token: 'delimiter.python', foreground: 'd4d4d4' },
          { token: 'type', foreground: 'd4d4d4' },
          { token: 'type.sql', foreground: 'd4d4d4' },
          { token: 'variable', foreground: 'd4d4d4' },
          { token: 'variable.sql', foreground: 'd4d4d4' },
          { token: 'function', foreground: 'd4d4d4' },
          { token: 'function.sql', foreground: 'd4d4d4' },
          { token: 'predefined', foreground: 'd4d4d4' },
          { token: 'predefined.sql', foreground: 'd4d4d4' },
          { token: 'constant', foreground: 'd4d4d4' },
          { token: 'constant.sql', foreground: 'd4d4d4' },
          { token: 'tag', foreground: 'd4d4d4' },
          { token: 'attribute', foreground: 'd4d4d4' },
          { token: 'regexp', foreground: 'd4d4d4' },
          { token: 'annotation', foreground: 'd4d4d4' },
          { token: 'metatag', foreground: 'd4d4d4' },
          { token: 'key', foreground: 'd4d4d4' },
          { token: 'value', foreground: 'd4d4d4' },
        ],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.foreground': '#d4d4d4',
          'editor.lineHighlightBackground': '#2d2d2d',
          'editorCursor.foreground': '#d4d4d4',
          'editor.selectionBackground': '#264f78',
        }
      });

      // Enhanced Python language configuration for better syntax highlighting
      console.log('🐍 Configuring Python language support...');
      monaco.languages.setLanguageConfiguration('python', {
        comments: {
          lineComment: '#',
          blockComment: ['"""', '"""']
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"', notIn: ['string'] },
          { open: "'", close: "'", notIn: ['string', 'comment'] }
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        folding: {
          offSide: true,
          markers: {
            start: /^\s*#region\b/,
            end: /^\s*#endregion\b/
          }
        }
      });

      // Enhanced Python tokenizer with PySpark-specific keywords
      monaco.languages.setMonarchTokensProvider('python', {
        tokenPostfix: '.python',
        keywords: [
          'and', 'as', 'assert', 'break', 'class', 'continue', 'def',
          'del', 'elif', 'else', 'except', 'exec', 'finally',
          'for', 'from', 'global', 'if', 'import', 'in',
          'is', 'lambda', 'not', 'or', 'pass', 'print',
          'raise', 'return', 'try', 'while', 'with', 'yield',
          'async', 'await', 'nonlocal',
          // PySpark specific keywords and methods
          'spark', 'SparkSession', 'SparkContext', 'DataFrame', 'RDD',
          'select', 'filter', 'where', 'groupBy', 'agg', 'join',
          'union', 'distinct', 'orderBy', 'sort', 'limit',
          'collect', 'show', 'count', 'cache', 'persist',
          'read', 'write', 'table', 'parquet', 'json', 'csv',
          'withColumn', 'withColumnRenamed', 'drop', 'alias',
          'col', 'expr', 'when', 'otherwise', 'lit'
        ],
        builtins: [
          'True', 'False', 'None', 'NotImplemented', 'Ellipsis', '__debug__',
          '__name__', '__doc__', '__file__', '__builtins__', '__module__',
          '__dict__', '__class__', '__bases__', '__mro__', 'self', 'cls'
        ],
        operators: [
          '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=',
          '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '&',
          '|', '^', '%', '<<', '>>', '>>>', '+=', '-=', '*=',
          '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '>>>='
        ],
        symbols: /[=><!~?:&|+\-*/^%]+/,
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
        tokenizer: {
          root: [
            [/[a-zA-Z_$][\w$]*/, {
              cases: {
                '@keywords': 'keyword',
                '@builtins': 'type.identifier',
                '@default': 'identifier'
              }
            }],
            [/^\s*@\w+/, 'annotation'],
            { include: '@whitespace' },
            [/[{}()[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/@symbols/, {
              cases: {
                '@operators': 'operator',
                '@default': ''
              }
            }],
            [/\d*\.\d+([eE][+-]?\d+)?/, 'number.float'],
            [/\d+/, 'number'],
            [/[;,.]/, 'delimiter'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string_double'],
            [/'/, 'string', '@string_single'],
            [/"""/, 'string', '@string_triple_double'],
            [/'''/, 'string', '@string_triple_single'],
          ],
          whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/#.*$/, 'comment'],
          ],
          string_double: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, 'string', '@pop']
          ],
          string_single: [
            [/[^\\']+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/'/, 'string', '@pop']
          ],
          string_triple_double: [
            [/[^"]+/, 'string'],
            [/"""/, 'string', '@pop'],
            [/"/, 'string']
          ],
          string_triple_single: [
            [/[^']+/, 'string'],
            [/'''/, 'string', '@pop'],
            [/'/, 'string']
          ]
        }
      });

      // Enhanced Scala language support with Spark/Databricks keywords
      monaco.languages.setLanguageConfiguration('scala', {
        comments: {
          lineComment: '//',
          blockComment: ['/*', '*/']
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ]
      });

      // Enhanced Scala tokenizer with Spark/Databricks keywords
      monaco.languages.setMonarchTokensProvider('scala', {
        keywords: [
          // Standard Scala keywords
          'abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends',
          'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit',
          'import', 'lazy', 'match', 'new', 'null', 'object', 'override',
          'package', 'private', 'protected', 'return', 'sealed', 'super',
          'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var',
          'while', 'with', 'yield',
          // Spark/Databricks specific keywords
          'spark', 'sqlContext', 'sql', 'DataFrame', 'Dataset', 'RDD',
          'SparkSession', 'SparkContext', 'SQLContext', 'HiveContext',
          'createDataFrame', 'createTempView', 'createGlobalTempView',
          'read', 'write', 'load', 'save', 'format', 'option', 'options',
          'select', 'filter', 'where', 'groupBy', 'agg', 'join', 'union',
          'unionAll', 'intersect', 'except', 'distinct', 'dropDuplicates',
          'orderBy', 'sort', 'limit', 'collect', 'collectAsList', 'take',
          'first', 'head', 'count', 'cache', 'persist', 'unpersist',
          'repartition', 'coalesce', 'map', 'flatMap', 'reduceByKey',
          'broadcast', 'accumulator', 'parallelize', 'textFile', 'wholeTextFiles',
          'sequenceFile', 'saveAsTextFile', 'saveAsSequenceFile',
          // Databricks specific
          'dbutils', 'display', 'displayHTML', 'fs', 'notebook', 'widgets',
          'secrets', 'library', 'delta', 'DeltaTable', 'optimize', 'vacuum',
          'merge', 'when', 'whenMatched', 'whenNotMatched'
        ],
        typeKeywords: [
          'Boolean', 'Byte', 'Char', 'Double', 'Float', 'Int', 'Long', 'Short',
          'String', 'Unit', 'Any', 'AnyRef', 'AnyVal', 'Nothing', 'Null',
          'Option', 'Some', 'None', 'List', 'Array', 'Map', 'Set', 'Seq',
          'Vector', 'Buffer', 'Iterator', 'Future', 'Try', 'Either',
          'DataFrame', 'Dataset', 'RDD', 'Row', 'Column', 'SparkSession'
        ],
        operators: [
          '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
          '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
          '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
          '%=', '<<=', '>>=', '>>>='
        ],
        symbols: /[=><!~?:&|+\-*/^%]+/,
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
        tokenizer: {
          root: [
            [/[a-z_$][\w$]*/, { cases: { '@typeKeywords': 'keyword', '@keywords': 'keyword', '@default': 'identifier' } }],
            [/[A-Z][\w$]*/, 'type.identifier'],
            { include: '@whitespace' },
            [/[{}()[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
            [/\d*\.\d+([eE][+-]?\d+)?/, 'number.float'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\d+/, 'number'],
            [/[;,.]/, 'delimiter'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
            [/'[^\\']'/, 'string'],
            [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
            [/'/, 'string.invalid']
          ],
          comment: [
            [/[^/*]+/, 'comment'],
            [/\/\*/, 'comment', '@push'],
            ["\\*/", 'comment', '@pop'],
            [/[/*]/, 'comment']
          ],
          string: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
          ],
          whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
          ],
        },
      });

      // Create the editor
      const editor = monaco.editor.create(containerRef.current, {
        value: value || '',
        language: getLanguageFromFileName(fileName),
        theme: theme === 'dark' ? 'simple-dark' : 'simple-light',
        automaticLayout: true,
        fontSize: 15,
        fontWeight: '500',
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Mono', 'Roboto Mono', Consolas, 'Ubuntu Mono', monospace",
        lineHeight: 1.5,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,  // Disable to prevent layout issues
        scrollBeyondLastColumn: 20,   // Reduced padding for horizontal scroll
        wordWrap: wordWrap ? 'on' : 'off',  // Toggle word wrap based on prop
        wordWrapColumn: 120,  // Set word wrap column when enabled
        lineNumbers: 'on',
        renderLineHighlight: 'line',
        selectOnLineNumbers: true,
        roundedSelection: false,
        readOnly: false,
        cursorStyle: 'line',
        overviewRulerLanes: 0,  // Disable overview ruler to save space
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
          verticalHasArrows: false,
          horizontalHasArrows: false,
          vertical: 'visible',
          horizontal: 'visible',
          handleMouseWheel: true,
          alwaysConsumeMouseWheel: false,
          // Force horizontal scrollbar to always be rendered when content overflows
          horizontalSliderSize: 10,
          verticalSliderSize: 10
        },
        padding: {
          top: 10,
          bottom: 15  // Ensure enough space for horizontal scrollbar
        },
        // Enhanced horizontal scrolling options
        columnSelection: false,
        mouseWheelScrollSensitivity: 1,
        fastScrollSensitivity: 5,
        smoothScrolling: true
      });

      monacoInstance.current = editor;
      editorRef.current = editor;

      // Force layout update on container resize
      resizeObserver.current = new ResizeObserver(() => {
        if (editor) {
          setTimeout(() => {
            editor.layout();
          }, 100);
        }
      });
      
      if (containerRef.current) {
        resizeObserver.current.observe(containerRef.current);
      }

      // Also listen for window resize events
      const handleWindowResize = () => {
        if (editor) {
          setTimeout(() => {
            editor.layout();
          }, 50);
        }
      };
      
      window.addEventListener('resize', handleWindowResize);

      // Listen for content changes
      editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue();
        if (onChange) {
          onChange(currentValue);
        }
      });

      // Listen for selection changes to show/hide correction toolbar
      editor.onDidChangeCursorSelection((e) => {
        const selection = e.selection;
        
        console.log('🔧 Selection changed:', selection, 'isEmpty:', selection?.isEmpty());
        
        // Clear any existing timeout
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }

        // Clear any active inline diff when user makes new selection
        if (inlineDiffActive) {
          clearInlineDiff();
        }
        
        if (selection && !selection.isEmpty()) {
          const selectedText = editor.getModel().getValueInRange(selection);
          if (selectedText.trim().length > 0) {
            console.log('🔧 Storing selection - text length:', selectedText.length, 'range:', selection);
            setSelectedCode(selectedText);
            setSelectionRange(selection);
            setIsUserSelecting(true);
            
            // Hide toolbar immediately when user is actively selecting
            setShowCorrectionToolbar(false);
            
            // Wait 800ms after user stops selecting before showing toolbar
            const timeout = setTimeout(() => {
              setIsUserSelecting(false);
              
              // Calculate toolbar position
              const endPosition = selection.getEndPosition();
              const position = editor.getScrolledVisiblePosition(endPosition);
              if (position) {
                const container = containerRef.current;
                const containerRect = container.getBoundingClientRect();
                
                // Convert editor coordinates to viewport coordinates for fixed positioning
                const viewportX = containerRect.left + position.left;
                const viewportY = containerRect.top + position.top;
                
                let toolbarX = viewportX + 10; // 10px offset to the right
                const toolbarWidth = 300; // minWidth from CSS
                
                // Adjust if toolbar would overflow to the right
                if (toolbarX + toolbarWidth > window.innerWidth - 20) {
                  toolbarX = viewportX - toolbarWidth - 10; // Place to the left instead
                }
                
                setToolbarPosition({
                  x: toolbarX,
                  y: viewportY - 40   // Position above the selection end
                });
                setShowCorrectionToolbar(true);
              }
            }, 800); // Wait 800ms for user to finish selecting
            
            setSelectionTimeout(timeout);
          } else {
            setShowCorrectionToolbar(false);
            setIsUserSelecting(false);
          }
        } else {
          setShowCorrectionToolbar(false);
          setIsUserSelecting(false);
          if (selectionTimeout) {
            clearTimeout(selectionTimeout);
            setSelectionTimeout(null);
          }
        }
      });

      // Hide toolbar when clicking elsewhere - but preserve stored selection
      editor.onDidChangeCursorPosition(() => {
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
          // Only hide toolbar if we don't have stored selection data
          if (!selectedCode || !selectionRange) {
            setShowCorrectionToolbar(false);
          }
        }
      });

      // Add Ctrl+S save shortcut
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (onSave) {
          onSave(editor.getValue());
        }
      });

      // Add Shift+Alt+F format shortcut for SQL formatting
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        formatSQL(editor);
      });

      // Add Ctrl+K shortcut for AI inline editor
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
        const selection = editor.getSelection();
        if (selection && !selection.isEmpty()) {
          // If there's already a selection, show the AI toolbar directly
          const selectedText = editor.getModel().getValueInRange(selection);
          setSelectedCode(selectedText);
          setSelectionRange(selection);
          
          // Calculate toolbar position
          const endPosition = selection.getEndPosition();
          const position = editor.getScrolledVisiblePosition(endPosition);
          if (position) {
            const container = containerRef.current;
            const containerRect = container.getBoundingClientRect();
            
            const viewportX = containerRect.left + position.left;
            const viewportY = containerRect.top + position.top;
            
            const toolbarX = Math.max(10, Math.min(viewportX, window.innerWidth - 620));
            
            setToolbarPosition({
              x: toolbarX,
              y: viewportY - 40
            });
            setShowCorrectionToolbar(true);
          }
        } else {
          // If no selection, select current line first then show toolbar
          const position = editor.getPosition();
          const lineContent = editor.getModel().getLineContent(position.lineNumber);
          
          console.log('🔧 Ctrl+K with no selection - line content:', lineContent, 'length:', lineContent.length);
          
          // Create proper range for the line
          const fullLineRange = new monaco.Range(
            position.lineNumber, 1,
            position.lineNumber, Math.max(1, lineContent.length + 1)
          );
          
          console.log('🔧 Setting line selection:', fullLineRange);
          editor.setSelection(fullLineRange);
          
          // Wait a bit for selection to be processed, then trigger the AI toolbar
          setTimeout(() => {
            const selectedText = editor.getModel().getValueInRange(fullLineRange);
            console.log('🔧 Selected line text:', selectedText, 'length:', selectedText.length);
            
            setSelectedCode(selectedText);
            setSelectionRange(fullLineRange);
            
            // Calculate toolbar position for the selected line
            const endPos = fullLineRange.getEndPosition();
            const pos = editor.getScrolledVisiblePosition(endPos);
            if (pos) {
              const container = containerRef.current;
              const containerRect = container.getBoundingClientRect();
              
              const viewportX = containerRect.left + pos.left;
              const viewportY = containerRect.top + pos.top;
              
              const toolbarX = Math.max(10, Math.min(viewportX, window.innerWidth - 620));
              
              setToolbarPosition({
                x: toolbarX,
                y: viewportY - 40
              });
              setShowCorrectionToolbar(true);
            }
          }, 50);
        }
      });

      // Add context menu option for SQL formatting
      editor.addAction({
        id: 'format-sql',
        label: 'Format SQL (Uppercase Keywords)',
        contextMenuGroupId: 'modification',
        contextMenuOrder: 1,
        run: () => formatSQL(editor)
      });

      // Add context menu option for Git commit
      if (onGitCommit) {
        editor.addAction({
          id: 'git-commit',
          label: 'Git Commit',
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1,
          run: () => onGitCommit()
        });
      }

      // Add context menu option for AI code correction
      if (onCodeCorrection) {
        editor.addAction({
          id: 'ai-code-correction',
          label: '🤖 Fix/Improve with AI',
          contextMenuGroupId: 'modification',
          contextMenuOrder: 2,
          precondition: 'editorHasSelection',
          run: () => {
            const selection = editor.getSelection();
            if (selection && !selection.isEmpty()) {
              const selectedText = editor.getModel().getValueInRange(selection);
              handleCodeCorrection(selectedText, selection, '', []); // Pass empty mentions array for keyboard shortcut
            }
          }
        });
      }

      // Update language when filename changes
      const currentLanguage = getLanguageFromFileName(fileName);
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, currentLanguage);
      }

      // Cleanup function for this specific editor instance
      const cleanup = () => {
        window.removeEventListener('resize', handleWindowResize);
      };

      return cleanup;
    } catch (error) {
      console.error('Monaco Editor initialization failed:', error);
      // Return a simple cleanup function in case of error
      return () => {
        if (monacoInstance.current) {
          monacoInstance.current = null;
          editorRef.current = null;
        }
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update word wrap when prop changes
  useEffect(() => {
    if (monacoInstance.current) {
      monacoInstance.current.updateOptions({
        wordWrap: wordWrap ? 'on' : 'off'
      });
      // Force layout update to ensure horizontal scrollbar appears/disappears correctly
      setTimeout(() => {
        monacoInstance.current.layout();
      }, 10);
    }
  }, [wordWrap]);

  // SQL Formatter function
  const formatSQL = (editor) => {
    const model = editor.getModel();
    if (!model) return;

    const currentLanguage = model.getLanguageId();
    if (currentLanguage !== 'sql') return;

    const content = editor.getValue();
    const position = editor.getPosition();
    
    // Define all SQL keywords that should be uppercase
    const sqlKeywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 
      'ON', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'IN', 'BETWEEN', 
      'ORDER', 'BY', 'GROUP', 'HAVING', 'DISTINCT', 'UNION', 'ALL', 'INTERSECT', 
      'EXCEPT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'EXISTS', 'ANY', 'SOME',
      'CAST', 'CONCAT', 'COALESCE', 'ISNULL', 'NULLIF', 'COUNT', 'SUM', 'AVG', 
      'MAX', 'MIN', 'SUBSTRING', 'LEN', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 
      'LTRIM', 'RTRIM', 'REPLACE', 'CHARINDEX', 'DATEPART', 'DATEDIFF', 'GETDATE', 
      'CONVERT', 'TRY_CAST', 'TRY_CONVERT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 
      'OVER', 'PARTITION', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
      'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC', 
      'FLOAT', 'REAL', 'VARCHAR', 'CHAR', 'NVARCHAR', 'NCHAR', 'TEXT', 'NTEXT', 
      'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'TIMESTAMP', 'BIT', 'BINARY', 
      'VARBINARY', 'UNIQUEIDENTIFIER'
    ];

    // Format the SQL content
    let formattedContent = content;
    
    // Replace keywords with uppercase versions (case-insensitive)
    sqlKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formattedContent = formattedContent.replace(regex, keyword.toUpperCase());
    });

    // Apply the formatted content
    editor.setValue(formattedContent);
    
    // Restore cursor position
    if (position) {
      editor.setPosition(position);
    }
  };

  const handleCodeCorrection = async (selectedText, selection, customInstructions = '', selectedMentions = []) => {
    console.log('🤖 Monaco handleCodeCorrection called with:', {
      selectedText: selectedText?.substring(0, 50) + '...',
      customInstructions: customInstructions || 'NO CUSTOM INSTRUCTIONS',
      fileName: fileName,
      selectedMentions: selectedMentions.length > 0 ? selectedMentions.map(m => ({ type: m.type, name: m.name })) : 'None'
    });
    
    if (!onCodeCorrection || !selectedText.trim()) return;
    
    setIsRequestingCorrection(true);
    setShowCorrectionToolbar(false);
    
    // Show processing spinner
    if (selection) {
      showProcessingSpinner(selection);
    }
    
    try {
      // Call the parent component's correction handler
      console.log('📤 Calling onCodeCorrection with parameters:', {
        selectedText: selectedText?.substring(0, 50) + '...',
        context: { fileName, language: getLanguageFromFileName(fileName) },
        customInstructions: customInstructions || 'EMPTY'
      });
      
      const correctedCode = await onCodeCorrection(selectedText, {
        fileName,
        language: getLanguageFromFileName(fileName),
        startLine: selection.startLineNumber,
        endLine: selection.endLineNumber,
        startColumn: selection.startColumn,
        endColumn: selection.endColumn
      }, customInstructions, selectedMentions);
      
      // Hide spinner before showing diff
      hideProcessingSpinner();
      
      // If we get corrected code, show inline diff instead of modal
      if (correctedCode && correctedCode !== selectedText) {
        showInlineDiff(selectedText, correctedCode, selection);
      }
    } catch (error) {
      console.error('Code correction failed:', error);
      hideProcessingSpinner();
      
      // Show user-friendly error message via toast
      let errorMessage = 'Code transformation failed. Please try again.';
      
      if (error.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Code transformation timed out. Please try with a smaller selection.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          errorMessage = 'Unable to connect to AI service. Please check if the server is running on port 8000.';
        } else if (error.message.includes('API Error')) {
          errorMessage = `AI service error: ${error.message}`;
        } else {
          errorMessage = `Code transformation failed: ${error.message}`;
        }
      }
      
      // Show error to user via toast notification
      if (showToast) {
        showToast(errorMessage, 'error');
      } else {
        // Fallback to alert if showToast is not available
        alert(errorMessage);
      }
    } finally {
      setIsRequestingCorrection(false);
      setUserInstructions('');
      setShowInstructionsArea(false);
    }
  };

  // Handle correction toolbar actions
  const handleCorrectCode = async () => {
    // Provide default instruction if none given but mentions exist
    const finalInstructions = userInstructions.trim() || 
      (selectedMentions.length > 0 ? 'Transform this code using the provided context' : 'Improve this code');
    
    // Try to get current selection if stored ones are empty
    let currentSelectedCode = selectedCode;
    let currentSelectionRange = selectionRange;
    
    // Always try to get current selection first
    if (monacoInstance.current) {
      const editor = monacoInstance.current;
      const currentSelection = editor.getSelection();
      
      console.log('🔧 Current editor selection:', currentSelection);
      console.log('🔧 Stored selection range:', currentSelectionRange);
      
      // Always use current selection if it exists and is not empty
      if (currentSelection && !currentSelection.isEmpty()) {
        currentSelectedCode = editor.getModel().getValueInRange(currentSelection);
        currentSelectionRange = currentSelection;
        console.log('🔧 Using current editor selection, length:', currentSelectedCode?.length);
      }
    }
    
    // If we have a selectionRange but no selectedCode, get the text from the range
    if (!currentSelectedCode && currentSelectionRange && monacoInstance.current) {
      const editor = monacoInstance.current;
      currentSelectedCode = editor.getModel().getValueInRange(currentSelectionRange);
      console.log('🔧 Got text from stored selection range:', currentSelectedCode?.substring(0, 50) + '...');
      console.log('🔧 Full extracted text length:', currentSelectedCode?.length);
      console.log('🔧 Text is truthy:', !!currentSelectedCode);
    }
    
    if ((!currentSelectedCode || !currentSelectionRange) && monacoInstance.current) {
      const editor = monacoInstance.current;
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        currentSelectedCode = editor.getModel().getValueInRange(selection);
        currentSelectionRange = selection;
        console.log('� Using current editor selection');
      }
    }
    
    console.log('�🔧 Apply button clicked with:', {
      selectedCode: currentSelectedCode?.substring(0, 50) + '...',
      userInstructions: userInstructions || 'NO INSTRUCTIONS PROVIDED',
      finalInstructions: finalInstructions,
      showInstructionsArea: showInstructionsArea,
      selectedMentions: selectedMentions.map(m => ({ type: m.type, name: m.name })),
      hasSelectedCode: !!currentSelectedCode,
      hasSelectionRange: !!currentSelectionRange,
      selectionRange: currentSelectionRange
    });
    
    console.log('🔍 Checking condition - selectedCode:', !!currentSelectedCode, 'selectionRange:', !!currentSelectionRange);
    console.log('🔍 currentSelectedCode type:', typeof currentSelectedCode, 'value:', currentSelectedCode?.substring(0, 20) + '...');
    console.log('🔍 currentSelectionRange type:', typeof currentSelectionRange, 'value:', currentSelectionRange);
    console.log('🔍 selectedMentions length:', selectedMentions.length);
    
    // Allow processing if we have selected code OR mentions OR user instructions
    if ((currentSelectedCode && currentSelectionRange) || selectedMentions.length > 0 || (finalInstructions && finalInstructions.trim())) {
      console.log('✅ Proceeding with handleCodeCorrection call');
      
      // For empty selection but with mentions/instructions, use empty string and current cursor position
      if (!currentSelectedCode && (selectedMentions.length > 0 || finalInstructions.trim()) && monacoInstance.current) {
        const editor = monacoInstance.current;
        const position = editor.getPosition();
        currentSelectionRange = new monaco.Range(
          position.lineNumber, position.column,
          position.lineNumber, position.column
        );
        currentSelectedCode = ''; // Empty string for insertion
        console.log('🔧 Using cursor position for code generation:', currentSelectionRange);
      }
      
      // Call with individual parameters as expected by handleCodeCorrection
      console.log('🔧 About to call onCodeCorrection:', {
        hasFunction: !!onCodeCorrection,
        functionType: typeof onCodeCorrection
      });
      
      if (onCodeCorrection) {
        try {
          console.log('🔧 Calling onCodeCorrection and awaiting result...');
          setIsProcessingAI(true); // Start loading
          
          const transformedCode = await onCodeCorrection(
            currentSelectedCode,
            {
              fileName,
              language: getLanguageFromFileName(fileName),
              startLine: currentSelectionRange.startLineNumber,
              endLine: currentSelectionRange.endLineNumber,
              startColumn: currentSelectionRange.startColumn,
              endColumn: currentSelectionRange.endColumn
            },
            finalInstructions, // Pass the final instructions (user provided or default)
            selectedMentions // Pass the @mentions data
          );
          
          console.log('✅ Received transformed code:', transformedCode?.substring(0, 100) + '...');
          
          // Switch from API loading to processing mode
          setIsProcessingAI(false);
          
          // Determine if this is code transformation (has selected code) or generation (empty selection)
          const isCodeTransformation = currentSelectedCode && currentSelectedCode.trim().length > 0;
          
          if (isCodeTransformation) {
            console.log('✅ Code transformation detected - using inline diff');
            console.log('🔧 Setting diff states:', {
              originalCode: currentSelectedCode.substring(0, 50) + '...',
              correctedCode: transformedCode.substring(0, 50) + '...',
              diffSelection: currentSelectionRange
            });
            
            // For code transformation, use the showInlineDiff function
            showInlineDiff(currentSelectedCode, transformedCode, currentSelectionRange);
            
            console.log('🔧 showInlineDiff called');
            
            // Close the AI toolbar since we're switching to diff mode
            setShowCorrectionToolbar(false);
            setUserInstructions('');
            clearMentions();
            
          } else {
            console.log('✅ Code generation detected - using streaming insertion');
            setIsStreamingCode(true);
            
            // Insert the transformed code into the editor with streaming effect
            if (transformedCode && monacoInstance.current) {
              const editor = monacoInstance.current;
              
              console.log('✅ Starting streaming insertion...');
              
              // Split the code into lines for streaming effect
              const lines = transformedCode.split('\n');
              let insertedText = '';
              let lineIndex = 0;
              
              // Store the initial insertion position
              const startPosition = {
                lineNumber: currentSelectionRange.startLineNumber,
                column: currentSelectionRange.startColumn
              };
              
              // Function to stream code line by line (much faster)
              const streamNextLine = () => {
                if (lineIndex < lines.length) {
                  // Add the entire next line
                  const nextLine = lines[lineIndex];
                  insertedText += (lineIndex > 0 ? '\n' : '') + nextLine;
                  lineIndex++;
                  
                  // Calculate the current end position based on inserted text
                  const model = editor.getModel();
                  const startOffset = model.getOffsetAt(startPosition);
                  const endPosition = model.getPositionAt(startOffset + insertedText.length);
                  
                  // Create range from start position to current end position
                  const currentRange = new monaco.Range(
                    startPosition.lineNumber,
                    startPosition.column,
                    endPosition.lineNumber,
                    endPosition.column
                  );
                  
                  // Update the editor with current text
                  editor.executeEdits('ai-transformation', [{
                    range: currentRange,
                    text: insertedText,
                    forceMoveMarkers: true
                  }]);
                  
                  // Continue with next line - much faster now
                  setTimeout(streamNextLine, 60); // 60ms per line for quick but visible streaming
                } else {
                  // Streaming complete
                  console.log('✅ Code streaming completed');
                  
                  // Close the toolbar after successful insertion
                  setIsStreamingCode(false);
                  setShowCorrectionToolbar(false);
                  setUserInstructions('');
                  clearMentions();
                  
                  // Position cursor at the end of inserted text
                  const model = editor.getModel();
                  const startOffset = model.getOffsetAt(startPosition);
                  const endPosition = model.getPositionAt(startOffset + transformedCode.length);
                  editor.setPosition(endPosition);
                }
              };
              
              // Start the streaming effect
              streamNextLine();
            }
          }
        } catch (error) {
          console.error('❌ Error in code transformation:', error);
        } finally {
          // Only reset API loading state here, streaming state is managed in the streaming function
          setIsProcessingAI(false);
        }
      } else {
        console.log('❌ onCodeCorrection prop is not available');
      }
    } else {
      console.log('❌ No valid selection found - cannot proceed with code correction');
    }
  };

  const handleCloseToolbar = () => {
    setShowCorrectionToolbar(false);
    setShowInstructionsArea(false);
    setUserInstructions('');
    clearMentions(); // Clear @mentions when closing toolbar
    if (monacoInstance.current) {
      monacoInstance.current.focus();
    }
  };

  const handleToggleInstructions = () => {
    setShowInstructionsArea(!showInstructionsArea);
  };

  // Inline diff functionality
  const clearInlineDiff = useCallback(() => {
    const editor = monacoInstance.current;
    if (!editor) return;

    // Remove decorations
    if (inlineDiffDecorations.length > 0) {
      editor.deltaDecorations(inlineDiffDecorations, []);
      setInlineDiffDecorations([]);
    }

    // Remove widget
    if (inlineDiffWidget) {
      editor.removeContentWidget(inlineDiffWidget);
      setInlineDiffWidget(null);
    }

    // Remove spinner widget if it exists
    if (correctionSpinnerWidget) {
      editor.removeContentWidget(correctionSpinnerWidget);
      setCorrectionSpinnerWidget(null);
    }

    // Reset state
    setInlineDiffActive(false);
    setOriginalCode('');
    setCorrectedCode('');
    setDiffSelection(null);
  }, [inlineDiffDecorations, inlineDiffWidget, correctionSpinnerWidget]);

  // Create and show processing spinner widget
  const showProcessingSpinner = useCallback((selection) => {
    const editor = monacoInstance.current;
    if (!editor) return;

    const createSpinnerContent = () => {
      const container = document.createElement('div');
      container.className = 'correction-spinner-widget';
      container.innerHTML = `
        <div class="spinner-container">
          <div class="spinner"></div>
          <span class="spinner-text">Processing code correction...</span>
        </div>
      `;
      return container;
    };

    // Position the spinner near the selection
    const endPosition = selection.getEndPosition();
    const widget = {
      getDomNode: createSpinnerContent,
      getId: () => 'correction-spinner-widget',
      getPosition: () => ({
        position: endPosition,
        preference: [monaco.editor.ContentWidgetPositionPreference.BELOW]
      })
    };

    editor.addContentWidget(widget);
    setCorrectionSpinnerWidget(widget);
  }, []);

  // Hide processing spinner
  const hideProcessingSpinner = useCallback(() => {
    const editor = monacoInstance.current;
    if (!editor || !correctionSpinnerWidget) return;

    editor.removeContentWidget(correctionSpinnerWidget);
    setCorrectionSpinnerWidget(null);
  }, [correctionSpinnerWidget]);

  // Create inline comparison widget to show both original and corrected code
  const createInlineComparisonWidget = useCallback((originalText, correctedText, selection) => {
    console.log('createInlineComparisonWidget called with:', { originalText, correctedText, selection });
    const editor = monacoInstance.current;
    if (!editor) {
      console.log('No editor in createInlineComparisonWidget');
      return;
    }

    // Define accept and reject handlers locally to ensure they work
    const handleAccept = () => {
      console.log('Accept clicked - applying correction');
      if (!editor || !selection || !correctedText) {
        console.log('Missing dependencies for accept');
        return;
      }

      // Replace the original text with corrected text
      editor.executeEdits('inline-diff-accept', [
        {
          range: selection,
          text: correctedText,
          forceMoveMarkers: true
        }
      ]);

      // Clear the diff state
      setInlineDiffActive(false);
      setOriginalCode('');
      setCorrectedCode('');
      setDiffSelection(null);
      
      // Remove decorations and widget
      if (inlineDiffDecorations.length > 0) {
        editor.deltaDecorations(inlineDiffDecorations, []);
        setInlineDiffDecorations([]);
      }
      
      if (inlineDiffWidget) {
        editor.removeContentWidget(inlineDiffWidget);
        setInlineDiffWidget(null);
      }
    };

    const handleReject = () => {
      console.log('Reject clicked - keeping original');
      
      // Clear the diff state without changing the text
      setInlineDiffActive(false);
      setOriginalCode('');
      setCorrectedCode('');
      setDiffSelection(null);
      
      // Remove decorations and widget
      if (inlineDiffDecorations.length > 0) {
        editor.deltaDecorations(inlineDiffDecorations, []);
        setInlineDiffDecorations([]);
      }
      
      if (inlineDiffWidget) {
        editor.removeContentWidget(inlineDiffWidget);
        setInlineDiffWidget(null);
      }
    };

    // Create comparison content
    const createComparisonContent = () => {
      console.log('Creating comparison content DOM element...');
      const container = document.createElement('div');
      container.className = 'inline-comparison-widget';
      container.innerHTML = `
        <div class="diff-header">
          <span class="diff-title">Code Correction</span>
          <div class="diff-actions">
            <button class="diff-accept" title="Accept">Accept</button>
            <button class="diff-reject" title="Reject">Reject</button>
          </div>
        </div>
        <div class="diff-container">
          <div class="diff-side diff-removed">
            <div class="diff-line-numbers"></div>
            <div class="diff-content">
              <pre class="diff-code">${originalText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </div>
          </div>
          <div class="diff-side diff-added">
            <div class="diff-line-numbers"></div>
            <div class="diff-content">
              <pre class="diff-code">${correctedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </div>
          </div>
        </div>
      `;

      // Add event listeners with proper binding
      const acceptBtn = container.querySelector('.diff-accept');
      const rejectBtn = container.querySelector('.diff-reject');
      
      console.log('Buttons found:', { acceptBtn: !!acceptBtn, rejectBtn: !!rejectBtn });
      
      if (acceptBtn) {
        console.log('Adding click listener to accept button');
        acceptBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Accept button clicked!');
          handleAccept();
        });
      }
      
      if (rejectBtn) {
        console.log('Adding click listener to reject button');
        rejectBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Reject button clicked!');
          handleReject();
        });
      }

      return container;
    };

    // Position the widget below the selection
    const endPosition = selection.getEndPosition();
    const widget = {
      getDomNode: createComparisonContent,
      getId: () => 'inline-comparison-widget',
      getPosition: () => ({
        position: endPosition,
        preference: [monaco.editor.ContentWidgetPositionPreference.BELOW]
      })
    };

    console.log('Adding widget to editor...');
    editor.addContentWidget(widget);
    setInlineDiffWidget(widget);
    console.log('Widget added successfully');
  }, [inlineDiffDecorations, inlineDiffWidget]);

  const showInlineDiff = useCallback((originalText, correctedText, selection) => {
    console.log('showInlineDiff called with:', { originalText, correctedText, selection });
    const editor = monacoInstance.current;
    if (!editor) {
      console.log('No editor found');
      return;
    }

    // Store the values for later use
    setOriginalCode(originalText);
    setCorrectedCode(correctedText);
    setDiffSelection(selection);
    setInlineDiffActive(true);

    console.log('Creating decorations...');
    // Don't replace the text immediately, instead show comparison widget
    // Add decorations to highlight the original area
    const decorations = editor.deltaDecorations([], [
      {
        range: selection,
        options: {
          className: 'inline-diff-original',
          glyphMarginClassName: 'inline-diff-glyph',
          minimap: {
            color: 'rgba(255, 165, 0, 0.3)',
            position: 1
          },
          overviewRuler: {
            color: 'rgba(255, 165, 0, 0.3)',
            position: 1
          }
        }
      }
    ]);

    setInlineDiffDecorations(decorations);

    console.log('Creating comparison widget...');
    // Create inline comparison widget
    createInlineComparisonWidget(originalText, correctedText, selection);
  }, [createInlineComparisonWidget]);

  // Handle Monaco diff editor actions - Define handleCloseDiffEditor first
  const handleCloseDiffEditor = useCallback(() => {
    setShowDiffEditor(false);
    setOriginalCode('');
    setCorrectedCode('');
    setDiffSelection(null);
    if (diffEditorRef) {
      diffEditorRef.dispose();
      setDiffEditorRef(null);
    }
  }, [diffEditorRef]);

  const handleApplyDiff = useCallback(() => {
    const editor = monacoInstance.current;
    if (editor && diffSelection) {
      editor.executeEdits('ai-correction', [
        {
          range: diffSelection,
          text: correctedCode,
          forceMoveMarkers: true
        }
      ]);
      editor.focus();
    }
    handleCloseDiffEditor();
  }, [diffSelection, correctedCode, handleCloseDiffEditor]);

  const handleRejectDiff = useCallback(() => {
    handleCloseDiffEditor();
    // Focus back to editor
    if (monacoInstance.current) {
      monacoInstance.current.focus();
    }
  }, [handleCloseDiffEditor]);

  // Create Monaco diff editor when needed
  useEffect(() => {
    if (showDiffEditor && originalCode && correctedCode) {
      const diffContainer = document.getElementById('monaco-diff-container');
      if (diffContainer && !diffEditorRef) {
        const diffEditor = monaco.editor.createDiffEditor(diffContainer, {
          theme: 'vs-dark', // Always use VS Code dark theme for authentic look
          readOnly: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          lineNumbers: 'on',
          glyphMargin: true,
          folding: false,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderSideBySide: true,
          enableSplitViewResizing: true,
          renderOverviewRuler: true,
          diffCodeLens: true,
          ignoreTrimWhitespace: false,
          renderIndicators: true,
          originalEditable: false,
          fontSize: 15,
          fontWeight: '500',
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Mono', 'Roboto Mono', Consolas, 'Ubuntu Mono', monospace",
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 14,
            horizontalScrollbarSize: 14,
            useShadows: false
          }
        });

        const originalModel = monaco.editor.createModel(originalCode, language);
        const modifiedModel = monaco.editor.createModel(correctedCode, language);
        
        diffEditor.setModel({
          original: originalModel,
          modified: modifiedModel
        });

        setDiffEditorRef(diffEditor);
      }
    }
  }, [showDiffEditor, originalCode, correctedCode, language, theme, diffEditorRef]);

  // Add CSS for inline diff decorations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .inline-diff-decoration {
        background-color: rgba(0, 255, 0, 0.2) !important;
        border: 1px solid rgba(0, 255, 0, 0.4) !important;
        border-radius: 3px !important;
      }
      .inline-diff-glyph::before {
        content: "✨";
        color: #007acc;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add VS Code style keyboard shortcuts for diff viewer
  useEffect(() => {
    if (showDiffEditor) {
      const handleDiffKeyboard = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleRejectDiff();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleApplyDiff();
        }
      };
      
      document.addEventListener('keydown', handleDiffKeyboard);
      return () => document.removeEventListener('keydown', handleDiffKeyboard);
    }
  }, [showDiffEditor, handleRejectDiff, handleApplyDiff]);

  // Update theme when it changes
  useEffect(() => {
    if (monacoInstance.current) {
      monaco.editor.setTheme(theme === 'dark' ? 'simple-dark' : 'simple-light');
    }
    // Always keep diff editor in dark theme for VS Code authenticity
    if (diffEditorRef) {
      diffEditorRef.updateOptions({
        theme: 'vs-dark'
      });
    }
  }, [theme, diffEditorRef]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }
      // Clear any active inline diff
      if (inlineDiffActive) {
        clearInlineDiff();
      }
    };
  }, [selectionTimeout, inlineDiffActive, clearInlineDiff]);

  // Update value when it changes externally
  useEffect(() => {
    if (monacoInstance.current && value !== monacoInstance.current.getValue()) {
      const editor = monacoInstance.current;
      const position = editor.getPosition();
      editor.setValue(value || '');
      if (position) {
        editor.setPosition(position);
      }
    }
  }, [value]);

  // Update language when filename changes
  useEffect(() => {
    if (monacoInstance.current && fileName) {
      const currentLanguage = getLanguageFromFileName(fileName);
      const model = monacoInstance.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, currentLanguage);
      }
    }
  }, [fileName]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        minHeight: '300px',
        position: 'relative',
        overflow: 'hidden',  // Let Monaco handle all scrolling
        display: 'flex',
        flexDirection: 'column'
      }} 
    >
      {/* Floating Correction Toolbar */}
      {showCorrectionToolbar && (
        <div
          data-correction-toolbar="true"
          className={`fixed z-[99999] ${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg shadow-lg overflow-hidden`}
          style={{
            left: toolbarPosition.x,
            top: toolbarPosition.y,
            width: '800px', // Increased from 600px to show full placeholder
            minHeight: '50px'
          }}
        >
          {/* Simple horizontal layout */}
          <div className="flex items-start h-full px-3 py-2 gap-3">
            {/* Textarea field with embedded button and @mentions support */}
            <div className="flex-1 relative">
              {/* Selected Mentions Display */}
              {selectedMentions.length > 0 && (
                <div className={`mb-2 p-2 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
                    Referenced files ({selectedMentions.length}):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedMentions.map((mention) => (
                      <div
                        key={mention.id}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                          theme === 'dark' ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        <span className="text-blue-400">@{mention.type}</span>
                        <span>{mention.name}</span>
                        {/* Show Excel-specific details */}
                        {mention.excelData && (
                          <span className={`text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                            ({mention.excelData.sheetName} Row {mention.excelData.rowIndex + 1})
                          </span>
                        )}
                        {/* Show code-specific details */}
                        {mention.codeData && (
                          <span className={`text-xs ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                            (Lines {mention.codeData.startLine}-{mention.codeData.endLine})
                          </span>
                        )}
                        <span className="text-xs">
                          {mention.source === 'github' ? '📁' : 
                           mention.source === 'cloud' ? '☁️' : 
                           mention.source === 'memory' ? '🧠' : '💻'}
                        </span>
                        <button
                          onClick={() => removeMention(mention.id)}
                          className={`text-xs ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} ml-1`}
                          title="Remove mention"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <textarea
                ref={instructionsTextareaRef}
                value={userInstructions}
                onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart)}
                placeholder="Tell AI what to do with the selected code... Use @file, @context, or @code to reference files"
                className={`w-full px-3 py-2 pr-12 text-sm border rounded resize-none ${
                  theme === 'dark' 
                    ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-500 focus:border-blue-500' 
                    : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-gray-400'
                } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                autoFocus
                rows={1}
                style={{
                  minHeight: '34px',
                  height: 'auto',
                  overflow: 'hidden'
                }}
                onInput={(e) => {
                  // Auto-resize textarea
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.max(34, e.target.scrollHeight) + 'px';
                }}
                onKeyDown={(e) => {
                  // Handle @mentions navigation first
                  handleKeyDown(e);
                  
                  // If not handled by mentions, check for other shortcuts
                  if (!showMentionDropdown) {
                    if (e.key === 'Enter' && !e.shiftKey && (userInstructions.trim() || selectedMentions.length > 0)) {
                      e.preventDefault();
                      handleCorrectCode();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCloseToolbar();
                    }
                  }
                }}
              />
              
              {/* Submit button inside textarea */}
              <button
                onClick={handleCorrectCode}
                disabled={isProcessingAI || isStreamingCode || (!userInstructions.trim() && selectedMentions.length === 0)}
                className={`absolute bottom-2 right-2 p-1.5 rounded transition-colors ${
                  isProcessingAI || isStreamingCode || (!userInstructions.trim() && selectedMentions.length === 0)
                    ? 'text-gray-400 cursor-not-allowed' 
                    : theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'
                }`}
                title={
                  isProcessingAI 
                    ? 'AI is generating code...' 
                    : isStreamingCode
                      ? 'Streaming code into editor...'
                      : (!userInstructions.trim() && selectedMentions.length === 0)
                        ? 'Enter instructions or add @mentions to transform code'
                        : 'Submit (Enter)'
                }
              >
                {isProcessingAI ? (
                  <div className="animate-spin">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        strokeDasharray="32" 
                        strokeDashoffset="32"
                        className="animate-pulse"
                      />
                      <path 
                        d="M12 2 C6.48 2 2 6.48 2 12" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        strokeLinecap="round"
                        className="opacity-75"
                      />
                    </svg>
                  </div>
                ) : isStreamingCode ? (
                  <div className="animate-pulse">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                    </svg>
                  </div>
                ) : (
                  <HiSparkles size={14} />
                )}
              </button>
            </div>
            
            {/* Close button */}
            <button
              onClick={handleCloseToolbar}
              className={`text-gray-400 hover:text-gray-600 transition-colors p-1 mt-1`}
              title="Close (Escape)"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* @mentions dropdown - positioned outside the toolbar */}
      {showCorrectionToolbar && showMentionDropdown && (
        <div
          className="fixed z-[100000]"
          style={{
            left: toolbarPosition.x,
            top: toolbarPosition.y + 60, // Position closer to the toolbar
            width: '800px', // Match the new toolbar width
          }}
        >
          <MentionDropdown
            showMentionDropdown={showMentionDropdown}
            mentionType={mentionType}
            mentionSuggestions={mentionSuggestions}
            selectedMentionIndex={selectedMentionIndex}
            onMentionSelect={handleMentionSelectWithExcel}
            position="bottom"
            className="z-[100000]" 
            style={{
              left: '0',
              right: '0'
            }}
          />
        </div>
      )}

      {/* Excel rows dropdown - positioned outside the toolbar */}
      {showCorrectionToolbar && excelRowsDropdown && (
        <div
          className="fixed z-[100000]"
          style={{
            left: toolbarPosition.x,
            top: toolbarPosition.y + 60, // Position closer to the toolbar
            width: '800px', // Match the toolbar width
          }}
        >
          <div 
            data-excel-dropdown="true"
            className={`${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} border rounded-lg shadow-lg min-w-[400px] max-h-[400px] overflow-hidden`}
          >
            {/* Header */}
            <div className={`p-3 text-sm ${theme === 'dark' ? 'text-gray-200 border-gray-600' : 'text-gray-800 border-gray-300'} border-b`}>
              <div className="font-medium">Select data from: {excelRowsDropdown.fileName}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                Choose sheet and row to include in context
              </div>
            </div>
            
            {/* Sheet tabs */}
            <div className={`flex ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'} border-b overflow-x-auto`}>
              {excelRowsDropdown.sheetNames.map((sheetName, index) => (
                <button
                  key={sheetName}
                  onClick={() => handleExcelSheetChange(sheetName)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-r ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'} last:border-r-0 ${
                    sheetName === excelRowsDropdown.activeSheet
                      ? `${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'}`
                      : `${theme === 'dark' ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`
                  }`}
                >
                  {sheetName}
                </button>
              ))}
            </div>
            
            {/* Data rows */}
            <div className="max-h-[250px] overflow-y-auto">
              {(() => {
                const currentSheet = excelRowsDropdown.sheetsData[excelRowsDropdown.activeSheet];
                if (!currentSheet || !currentSheet.rows || currentSheet.rows.length === 0) {
                  return (
                    <div className={`p-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-center`}>
                      No data found in this sheet
                    </div>
                  );
                }
                
                const { headers, rows } = currentSheet;
                return (
                  <>
                    {/* Show all data rows */}
                    {rows.map((row, rowIndex) => (
                      <div 
                        key={rowIndex}
                        className={`p-3 border-b ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'} last:border-b-0 cursor-pointer`}
                        onClick={() => handleExcelRowSelect(row, rowIndex, excelRowsDropdown.activeSheet)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Row {rowIndex + 1}</span>
                          <span className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Click to select</span>
                        </div>
                        
                        {/* Show row data as key-value pairs */}
                        <div className="space-y-1">
                          {row.map((cell, cellIndex) => {
                            const header = headers[cellIndex] || `Column ${cellIndex + 1}`;
                            if (!cell && cell !== 0) return null; // Skip empty cells
                            
                            return (
                              <div key={cellIndex} className="flex">
                                <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} min-w-[100px] mr-2 font-medium`}>
                                  {header}:
                                </span>
                                <span className={`text-xs ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'} flex-1`}>
                                  {cell}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonacoEditor;

// Add CSS for inline comparison widget
const inlineComparisonStyles = `
  .inline-comparison-widget {
    background: var(--vscode-editor-background, #1e1e1e);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    font-family: var(--vscode-editor-font-family, 'Cascadia Code', Consolas, 'Courier New', monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    color: var(--vscode-editor-foreground, #d4d4d4);
    min-width: 500px;
    max-width: 800px;
    z-index: 1000;
  }

  .diff-header {
    background: var(--vscode-editor-background, #1e1e1e);
    border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }

  .diff-title {
    color: var(--vscode-editor-foreground, #d4d4d4);
    font-weight: normal;
  }

  .diff-actions {
    display: flex;
    gap: 8px;
  }

  .diff-accept, .diff-reject {
    background: #2d2d30;
    border: 1px solid #3c3c3c;
    color: #cccccc;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
    border-radius: 2px;
    transition: background-color 0.2s;
    font-family: inherit;
    font-weight: normal;
  }

  .diff-accept:hover {
    background: #464647;
    color: #ffffff;
  }

  .diff-reject:hover {
    background: #464647;
    color: #ffffff;
  }

  /* Light theme support */
  .monaco-editor.vs .inline-comparison-widget {
    background: #ffffff;
    border-color: #e5e5e5;
    color: #333333;
  }

  .monaco-editor.vs .diff-header {
    background: #ffffff;
    border-bottom-color: #e5e5e5;
  }

  .monaco-editor.vs .diff-title {
    color: #333333;
  }

  .monaco-editor.vs .diff-accept,
  .monaco-editor.vs .diff-reject {
    background: #f3f3f3;
    border-color: #cccccc;
    color: #333333;
  }

  .monaco-editor.vs .diff-accept:hover,
  .monaco-editor.vs .diff-reject:hover {
    background: #e5e5e5;
    color: #000000;
  }

  .diff-container {
    display: flex;
    border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
  }

  .diff-side {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .diff-removed {
    background: var(--vscode-diffEditor-removedTextBackground, rgba(255, 0, 0, 0.2));
    border-right: 1px solid var(--vscode-panel-border, #3c3c3c);
  }

  .diff-added {
    background: var(--vscode-diffEditor-insertedTextBackground, rgba(0, 255, 0, 0.2));
  }

  .diff-content {
    padding: 0;
  }

  .diff-code {
    margin: 0;
    padding: 8px 12px;
    background: transparent;
    color: inherit;
    font-family: inherit;
    font-size: inherit;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-x: auto;
    border: none;
    outline: none;
  }

  .diff-line-numbers {
    display: none;
  }

  .inline-diff-original {
    background: var(--vscode-diffEditor-removedTextBackground, rgba(255, 0, 0, 0.2)) !important;
    border: 1px solid var(--vscode-diffEditor-removedTextBorder, rgba(255, 0, 0, 0.4));
  }

  .inline-diff-glyph {
    background: var(--vscode-diffEditor-removedTextBackground, rgba(255, 0, 0, 0.6));
    width: 3px !important;
    margin-left: 2px;
  }

  /* Correction processing spinner */
  .correction-spinner-widget {
    background: var(--vscode-editor-background, #1e1e1e);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 3px;
    padding: 8px 12px;
    font-family: var(--vscode-editor-font-family, 'Cascadia Code', Consolas, 'Courier New', monospace);
    font-size: 12px;
    color: var(--vscode-editor-foreground, #d4d4d4);
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .spinner-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--vscode-progressBar-background, #0e70c0);
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-text {
    color: var(--vscode-editor-foreground, #d4d4d4);
    font-size: 11px;
    white-space: nowrap;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Light theme support for spinner */
  .monaco-editor.vs .correction-spinner-widget {
    background: #ffffff;
    border-color: #e5e5e5;
    color: #333333;
  }

  .monaco-editor.vs .spinner {
    border-color: #0078d4;
  }

  .monaco-editor.vs .spinner-text {
    color: #333333;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'inline-comparison-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = inlineComparisonStyles;
    document.head.appendChild(style);
  }
}
