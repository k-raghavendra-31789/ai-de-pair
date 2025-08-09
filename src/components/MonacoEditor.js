import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { useTheme } from './ThemeContext';

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
    if (label === 'css' || label === 'scss' || label === 'less') {
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
  wordWrap = false
}) => {
  const { theme } = useTheme();
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const monacoInstance = useRef(null);
  const resizeObserver = useRef(null);

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
      'txt': 'plaintext'
    };
    
    return languageMap[extension] || 'plaintext';
  };

  useEffect(() => {
    if (containerRef.current && !monacoInstance.current) {
      // Extend Monaco's built-in SQL language with additional keywords
      monaco.languages.setLanguageConfiguration('sql', {
        keywords: [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 
          'ON', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'IN', 'BETWEEN', 
          'ORDER', 'BY', 'GROUP', 'HAVING', 'DISTINCT', 'UNION', 'ALL', 'INTERSECT', 
          'EXCEPT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'EXISTS', 'ANY', 'SOME',
          'CAST', 'CONCAT', 'COALESCE', 'ISNULL', 'NULLIF', 'COUNT', 'SUM', 'AVG', 
          'MAX', 'MIN', 'SUBSTRING', 'LEN', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 
          'LTRIM', 'RTRIM', 'REPLACE', 'CHARINDEX', 'DATEPART', 'DATEDIFF', 'GETDATE', 
          'CONVERT', 'TRY_CAST', 'TRY_CONVERT', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 
          'OVER', 'PARTITION', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
          'STRING','CURRENT_TIMESTAMP',
        ]
      });

      // Override SQL tokenizer with comprehensive keyword matching
      monaco.languages.setMonarchTokensProvider('sql', {
        ignoreCase: true,
        keywords: [
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
          'VARBINARY', 'UNIQUEIDENTIFIER','STRING','CURRENT_TIMESTAMP'
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
            [/\d+(\.\d+)?([eE][\-+]?\d+)?/, 'number'],
            
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
          { token: 'string', foreground: '000000' },
          { token: 'string.sql', foreground: '000000' },
          { token: 'comment', foreground: '999999' },
          { token: 'comment.sql', foreground: '999999' },
          { token: 'number', foreground: '000000' },
          { token: 'number.sql', foreground: '000000' },
          { token: 'identifier', foreground: '000000' },
          { token: 'identifier.sql', foreground: '000000' },
          { token: 'operator', foreground: '000000' },
          { token: 'operator.sql', foreground: '000000' },
          { token: 'delimiter', foreground: '000000' },
          { token: 'delimiter.sql', foreground: '000000' },
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
          { token: 'string', foreground: 'd4d4d4' },
          { token: 'string.sql', foreground: 'd4d4d4' },
          { token: 'comment', foreground: '6a9955' },
          { token: 'comment.sql', foreground: '6a9955' },
          { token: 'number', foreground: 'd4d4d4' },
          { token: 'number.sql', foreground: 'd4d4d4' },
          { token: 'identifier', foreground: 'd4d4d4' },
          { token: 'identifier.sql', foreground: 'd4d4d4' },
          { token: 'operator', foreground: 'd4d4d4' },
          { token: 'operator.sql', foreground: 'd4d4d4' },
          { token: 'delimiter', foreground: 'd4d4d4' },
          { token: 'delimiter.sql', foreground: 'd4d4d4' },
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

      // Create the editor
      const editor = monaco.editor.create(containerRef.current, {
        value: value || '',
        language: getLanguageFromFileName(fileName),
        theme: theme === 'dark' ? 'simple-dark' : 'simple-light',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
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

      // Add context menu option for SQL formatting
      editor.addAction({
        id: 'format-sql',
        label: 'Format SQL (Uppercase Keywords)',
        contextMenuGroupId: 'modification',
        contextMenuOrder: 1,
        run: () => formatSQL(editor)
      });

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
    }

    return () => {
      if (monacoInstance.current) {
        monacoInstance.current.dispose();
        monacoInstance.current = null;
        editorRef.current = null;
      }
      // Clean up resize observer
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
        resizeObserver.current = null;
      }
    };
  }, []);

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

  // Update theme when it changes
  useEffect(() => {
    if (monacoInstance.current) {
      monaco.editor.setTheme(theme === 'dark' ? 'simple-dark' : 'simple-light');
    }
  }, [theme]);

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
    />
  );
};

export default MonacoEditor;
