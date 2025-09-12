import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  wordWrap = false
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
  const [correctionMode, setCorrectionMode] = useState('fix'); // 'fix' or 'enhance'
  
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

      // Listen for selection changes to show/hide correction toolbar
      editor.onDidChangeCursorSelection((e) => {
        const selection = e.selection;
        
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
            setSelectedCode(selectedText);
            setSelectionRange(selection);
            setIsUserSelecting(true);
            
            // Hide toolbar immediately when user is actively selecting
            setShowCorrectionToolbar(false);
            
            // Wait 800ms after user stops selecting before showing toolbar
            const timeout = setTimeout(() => {
              setIsUserSelecting(false);
              
              // Auto-populate instructions with the full selected code
              const codeContext = `Fix this code: "${selectedText}"`;
              setUserInstructions(codeContext);
              
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

      // Hide toolbar when clicking elsewhere
      editor.onDidChangeCursorPosition(() => {
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
          setShowCorrectionToolbar(false);
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
              handleCodeCorrection(selectedText, selection, '');
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

  // Handle code correction with AI
  const handleCodeCorrection = async (selectedText, selection, customInstructions = '') => {
    console.log('🤖 Monaco handleCodeCorrection called with:', {
      selectedText: selectedText?.substring(0, 50) + '...',
      customInstructions: customInstructions || 'NO CUSTOM INSTRUCTIONS',
      correctionMode: correctionMode,
      fileName: fileName
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
        customInstructions: customInstructions || 'EMPTY',
        correctionMode: correctionMode
      });
      
      const correctedCode = await onCodeCorrection(selectedText, {
        fileName,
        language: getLanguageFromFileName(fileName),
        startLine: selection.startLineNumber,
        endLine: selection.endLineNumber,
        startColumn: selection.startColumn,
        endColumn: selection.endColumn
      }, customInstructions, correctionMode);
      
      // Hide spinner before showing diff
      hideProcessingSpinner();
      
      // If we get corrected code, show inline diff instead of modal
      if (correctedCode && correctedCode !== selectedText) {
        showInlineDiff(selectedText, correctedCode, selection);
      }
    } catch (error) {
      console.error('Code correction failed:', error);
      hideProcessingSpinner();
    } finally {
      setIsRequestingCorrection(false);
      setUserInstructions('');
      setShowInstructionsArea(false);
    }
  };

  // Handle correction toolbar actions
  const handleCorrectCode = () => {
    console.log('🔧 Apply button clicked with:', {
      selectedCode: selectedCode?.substring(0, 50) + '...',
      userInstructions: userInstructions || 'NO INSTRUCTIONS PROVIDED',
      correctionMode: correctionMode,
      showInstructionsArea: showInstructionsArea
    });
    
    if (selectedCode && selectionRange) {
      handleCodeCorrection(selectedCode, selectionRange, userInstructions, correctionMode);
    }
  };

  const handleCloseToolbar = () => {
    setShowCorrectionToolbar(false);
    setShowInstructionsArea(false);
    setUserInstructions('');
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
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace",
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
          className="fixed z-[99999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden"
          style={{
            left: toolbarPosition.x,
            top: toolbarPosition.y,
            maxWidth: '400px',
            minWidth: '300px'
          }}
        >
          {/* Main Toolbar */}
          <div className="px-3 py-2 flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded text-xs">
              <button
                onClick={() => setCorrectionMode('fix')}
                className={`px-2 py-1 rounded-l transition-colors ${
                  correctionMode === 'fix' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Quick fix only"
              >
                Fix
              </button>
              <button
                onClick={() => setCorrectionMode('enhance')}
                className={`px-2 py-1 rounded-r transition-colors ${
                  correctionMode === 'enhance' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Smart enhance with context"
              >
                Enhance
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleInstructions}
                className="px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-xs"
                title={showInstructionsArea ? "Hide instructions" : "Add instructions"}
              >
                Instructions
              </button>
              
              <button
                onClick={handleCorrectCode}
                disabled={isRequestingCorrection}
                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                title="Apply AI correction"
              >
                {isRequestingCorrection ? 'Processing...' : 'Apply'}
              </button>
              
              <button
                onClick={handleCloseToolbar}
                className="px-1 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xs"
                title="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Instructions Area */}
          {showInstructionsArea && (
            <div className="border-t border-gray-200 dark:border-gray-600 p-3">
              <textarea
                value={userInstructions}
                onChange={(e) => setUserInstructions(e.target.value)}
                placeholder={selectedCode ? "Instructions auto-populated with your selection. Edit as needed..." : "Add specific instructions..."}
                className="w-full px-2 py-2 text-xs border border-gray-300 dark:border-gray-500 rounded resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleCorrectCode();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCloseToolbar();
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Ctrl+Enter to apply • Esc to close
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setUserInstructions('Make this code more efficient')}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    Optimize
                  </button>
                  <button
                    onClick={() => setUserInstructions('Add error handling and validation')}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    Add Error Handling
                  </button>
                  <button
                    onClick={() => setUserInstructions('Add detailed comments explaining what this code does')}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    Add Comments
                  </button>
                </div>
              </div>
            </div>
          )}
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
