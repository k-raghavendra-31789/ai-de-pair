import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import MonacoEditor from './MonacoEditor';
import ExcelViewer from './ExcelViewer';
import { FaPlay, FaStop, FaPlus, FaTrash, FaCode, FaTable, FaFileAlt, FaChevronDown, FaChevronRight } from 'react-icons/fa';

const NotebookStyleEditor = forwardRef(({ selectedFile, onFileOpen, isTerminalVisible }, ref) => {
  const { theme, colors } = useTheme();
  const { state, actions } = useAppState();
  
  const { 
    openTabs = [], 
    memoryFiles = {},
    activeConnectionId, 
    dbConnections = [],
    sqlExecution = {} 
  } = state || {};
  
  const { 
    setActiveTab: setActiveTabInContext = () => {},
    executeSqlQuery: executeFromAppState = () => {},
    updateMemoryFile = () => {},
    addMemoryFile = () => {},
    setSqlExecuting = () => {},
    setSqlResults = () => {}
  } = actions || {};

  // State for notebook-style cells
  const [cells, setCells] = useState([
    { id: 'cell-1', type: 'code', content: '', language: 'sql', output: null, isRunning: false }
  ]);
  const [selectedCellId, setSelectedCellId] = useState('cell-1');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Current active tab
  const activeTab = openTabs.find(tab => tab.isActive);
  
  // Cell management functions
  const addCell = useCallback((type = 'code', afterId = null) => {
    const newCell = {
      id: `cell-${Date.now()}`,
      type,
      content: '',
      language: type === 'code' ? 'sql' : 'markdown',
      output: null,
      isRunning: false
    };
    
    setCells(prev => {
      if (afterId) {
        const index = prev.findIndex(cell => cell.id === afterId);
        const newCells = [...prev];
        newCells.splice(index + 1, 0, newCell);
        return newCells;
      } else {
        return [...prev, newCell];
      }
    });
    
    setSelectedCellId(newCell.id);
  }, []);

  const deleteCell = useCallback((cellId) => {
    setCells(prev => {
      const filtered = prev.filter(cell => cell.id !== cellId);
      if (filtered.length === 0) {
        // Always keep at least one cell
        return [{ id: `cell-${Date.now()}`, type: 'code', content: '', language: 'sql', output: null, isRunning: false }];
      }
      return filtered;
    });
    
    // Update selected cell if deleted
    setSelectedCellId(prev => {
      const exists = cells.some(cell => cell.id === prev);
      return exists ? prev : cells[0]?.id;
    });
  }, [cells]);

  const updateCell = useCallback((cellId, updates) => {
    setCells(prev => prev.map(cell => 
      cell.id === cellId ? { ...cell, ...updates } : cell
    ));
  }, []);

  const runCell = useCallback(async (cellId) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || cell.type !== 'code') return;

    updateCell(cellId, { isRunning: true, output: null });

    try {
      // Simulate code execution - replace with actual execution logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock result
      const mockResult = {
        success: true,
        data: [
          { column1: 'Sample', column2: 'Data', column3: 123 },
          { column1: 'Another', column2: 'Row', column3: 456 }
        ],
        executionTime: '0.5s'
      };
      
      updateCell(cellId, { 
        isRunning: false, 
        output: mockResult
      });
    } catch (error) {
      updateCell(cellId, { 
        isRunning: false, 
        output: { success: false, error: error.message }
      });
    }
  }, [cells, updateCell]);

  const CellComponent = ({ cell, isSelected, onSelect }) => (
    <div 
      className={`
        mb-4 rounded-lg border transition-all duration-200 cursor-pointer
        ${isSelected 
          ? `${colors.accent.replace('text-', 'border-')} border-2 ${colors.accentBg} bg-opacity-5` 
          : `${colors.borderLight} border hover:${colors.accent.replace('text-', 'border-')} hover:border-opacity-50`
        }
      `}
      onClick={() => onSelect(cell.id)}
    >
      {/* Cell Header */}
      <div className={`${colors.secondary} px-4 py-2 border-b ${colors.borderLight} flex items-center justify-between rounded-t-lg`}>
        <div className="flex items-center gap-2">
          <span className={`${colors.textMuted} text-xs font-mono`}>
            [{cells.findIndex(c => c.id === cell.id) + 1}]
          </span>
          <span className="flex items-center gap-1">
            {cell.type === 'code' ? <FaCode className="text-blue-500" /> : <FaFileAlt className="text-gray-500" />}
            <span className={`text-sm ${colors.text}`}>
              {cell.type === 'code' ? cell.language.toUpperCase() : 'Markdown'}
            </span>
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {cell.type === 'code' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                runCell(cell.id);
              }}
              disabled={cell.isRunning}
              className={`
                flex items-center gap-1 px-2 py-1 text-xs rounded
                ${cell.isRunning 
                  ? `${colors.textMuted} cursor-not-allowed` 
                  : `${colors.accent} hover:${colors.accentBg} hover:bg-opacity-20`
                }
              `}
            >
              {cell.isRunning ? (
                <>
                  <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full" />
                  Running
                </>
              ) : (
                <>
                  <FaPlay />
                  Run
                </>
              )}
            </button>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              addCell('code', cell.id);
            }}
            className={`${colors.textMuted} hover:${colors.text} p-1`}
            title="Add cell below"
          >
            <FaPlus />
          </button>
          
          {cells.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteCell(cell.id);
              }}
              className={`${colors.textMuted} hover:${colors.error} p-1`}
              title="Delete cell"
            >
              <FaTrash />
            </button>
          )}
        </div>
      </div>

      {/* Cell Content */}
      <div className={`${colors.primary}`}>
        {cell.type === 'code' ? (
          <MonacoEditor
            value={cell.content}
            onChange={(value) => updateCell(cell.id, { content: value })}
            language={cell.language}
            height="auto"
            minHeight={120}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: false,
              lineDecorationsWidth: 10,
              lineNumbersMinChars: 3,
              fontSize: 14,
              tabSize: 2,
              automaticLayout: true
            }}
          />
        ) : (
          <textarea
            value={cell.content}
            onChange={(e) => updateCell(cell.id, { content: e.target.value })}
            placeholder="Enter markdown text..."
            className={`
              w-full p-4 bg-transparent border-none outline-none resize-none
              ${colors.text} text-sm leading-relaxed
            `}
            rows={3}
          />
        )}
      </div>

      {/* Cell Output */}
      {cell.output && (
        <div className={`${colors.secondary} border-t ${colors.borderLight}`}>
          <div className="p-4">
            {cell.output.success ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FaTable className="text-green-500" />
                  <span className={`text-sm ${colors.text} font-medium`}>
                    Results ({cell.output.data?.length || 0} rows)
                  </span>
                  <span className={`text-xs ${colors.textMuted}`}>
                    Executed in {cell.output.executionTime}
                  </span>
                </div>
                
                {cell.output.data && cell.output.data.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className={`min-w-full text-sm ${colors.border}`}>
                      <thead>
                        <tr className={`${colors.secondary} border-b ${colors.borderLight}`}>
                          {Object.keys(cell.output.data[0]).map(key => (
                            <th key={key} className={`px-3 py-2 text-left ${colors.text} font-medium`}>
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cell.output.data.slice(0, 10).map((row, index) => (
                          <tr key={index} className={`border-b ${colors.borderLight} hover:${colors.hover}`}>
                            {Object.values(row).map((value, i) => (
                              <td key={i} className={`px-3 py-2 ${colors.text}`}>
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {cell.output.data.length > 10 && (
                      <div className={`text-center py-2 ${colors.textMuted} text-xs`}>
                        ... and {cell.output.data.length - 10} more rows
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-red-500">⚠️</span>
                <span className={`text-sm ${colors.error}`}>
                  Error: {cell.output.error}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className={`
        ${sidebarCollapsed ? 'w-12' : 'w-64'} 
        ${colors.secondary} border-r ${colors.borderLight} 
        transition-all duration-300 flex-shrink-0
      `}>
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <h3 className={`font-medium ${colors.text}`}>Notebook</h3>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`${colors.textMuted} hover:${colors.text} p-1`}
            >
              {sidebarCollapsed ? <FaChevronRight /> : <FaChevronDown />}
            </button>
          </div>
        </div>
        
        {!sidebarCollapsed && (
          <div className="p-3">
            <div className="space-y-2">
              <button
                onClick={() => addCell('code')}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm rounded
                  ${colors.accent} hover:${colors.accentBg} hover:bg-opacity-20
                `}
              >
                <FaPlus />
                Add Code Cell
              </button>
              
              <button
                onClick={() => addCell('markdown')}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm rounded
                  ${colors.textMuted} hover:${colors.text} hover:${colors.hover}
                `}
              >
                <FaPlus />
                Add Text Cell
              </button>
            </div>
            
            <div className="mt-6">
              <h4 className={`text-xs font-medium ${colors.textMuted} mb-2 uppercase tracking-wide`}>
                Cells ({cells.length})
              </h4>
              <div className="space-y-1">
                {cells.map((cell, index) => (
                  <div
                    key={cell.id}
                    onClick={() => setSelectedCellId(cell.id)}
                    className={`
                      px-2 py-1 text-xs rounded cursor-pointer
                      ${selectedCellId === cell.id 
                        ? `${colors.accentBg} text-white` 
                        : `${colors.textMuted} hover:${colors.text} hover:${colors.hover}`
                      }
                    `}
                  >
                    [{index + 1}] {cell.type === 'code' ? cell.language.toUpperCase() : 'Markdown'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`${colors.secondary} px-6 py-4 border-b ${colors.borderLight} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <h1 className={`text-lg font-medium ${colors.text}`}>
              {activeTab?.name || 'Untitled Notebook'}
            </h1>
            <span className={`px-2 py-1 text-xs rounded ${colors.accentBg} text-white`}>
              Python
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                cells.forEach(cell => {
                  if (cell.type === 'code') {
                    runCell(cell.id);
                  }
                });
              }}
              className={`
                flex items-center gap-2 px-4 py-2 rounded
                ${colors.accent} hover:${colors.accentBg} hover:bg-opacity-20
              `}
            >
              <FaPlay />
              Run All
            </button>
          </div>
        </div>

        {/* Notebook Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
            {cells.map(cell => (
              <CellComponent
                key={cell.id}
                cell={cell}
                isSelected={selectedCellId === cell.id}
                onSelect={setSelectedCellId}
              />
            ))}
            
            {/* Add Cell Button at Bottom */}
            <div className="text-center py-8">
              <button
                onClick={() => addCell('code')}
                className={`
                  px-6 py-3 rounded-lg border-2 border-dashed
                  ${colors.borderLight} ${colors.textMuted} hover:${colors.accent.replace('text-', 'border-')}
                  hover:${colors.accent} transition-colors
                `}
              >
                <FaPlus className="mr-2" />
                Add Cell
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

NotebookStyleEditor.displayName = 'NotebookStyleEditor';

export default NotebookStyleEditor;
