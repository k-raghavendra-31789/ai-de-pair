import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import * as XLSX from 'xlsx';

const ExcelViewer = ({ file, fileContent, initialActiveSheet, sheetNames: propSheetNames, onSheetChange }) => {
  const { colors } = useTheme();
  const [workbook, setWorkbook] = useState(null);
  const [activeSheet, setActiveSheet] = useState(initialActiveSheet || '');
  const [sheetData, setSheetData] = useState([]);
  const [originalSheetData, setOriginalSheetData] = useState([]); // Store original data
  const [sheetNames, setSheetNames] = useState(propSheetNames || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevFileContentRef = useRef(null);
  const prevFileNameRef = useRef(null);
  
  // Create storage key for this specific Excel file (without sheet name)
  const fileStorageKey = useMemo(() => {
    const identifier = file?.tabId || file?.name || 'excel-file';
    return `excel_${identifier.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
  }, [file?.tabId, file?.name]);
  
  // Create unique storage keys based on tab ID, file name, and active sheet
  const storageKey = useMemo(() => {
    const identifier = file?.tabId || file?.name || 'excel-file';
    const sheetName = activeSheet || 'default';
    return `${identifier.toString().replace(/[^a-zA-Z0-9]/g, '_')}_${sheetName.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }, [file?.tabId, file?.name, activeSheet]);

  // Initialize filters from sessionStorage if available
  const [columnFilters, setColumnFilters] = useState({});
  const [multiSelectFilters, setMultiSelectFilters] = useState({});

  // Load filters when storage key changes (when activeSheet is set)
  useEffect(() => {
    if (!storageKey.includes('default')) { // Only load when we have a real sheet name
      try {
        const savedColumnFilters = sessionStorage.getItem(`excelFilters_${storageKey}`);
        const savedMultiSelectFilters = sessionStorage.getItem(`excelMultiSelectFilters_${storageKey}`);
        
        console.log('Loading filters for storageKey:', storageKey);
        console.log('columnFilters:', savedColumnFilters);
        console.log('multiSelectFilters:', savedMultiSelectFilters);
        
        setColumnFilters(savedColumnFilters ? JSON.parse(savedColumnFilters) : {});
        setMultiSelectFilters(savedMultiSelectFilters ? JSON.parse(savedMultiSelectFilters) : {});
      } catch (error) {
        console.warn('Failed to load filters:', error);
        setColumnFilters({});
        setMultiSelectFilters({});
      }
    }
  }, [storageKey]);
  
  const [showFilterDropdown, setShowFilterDropdown] = useState(null); // Which column filter is open
  const [sortConfig, setSortConfig] = useState({ column: null, direction: null }); // Sort configuration
  const filterDropdownRef = useRef(null); // Reference to prevent unwanted closing
  const lastInteractionRef = useRef(Date.now()); // Track last user interaction
  const lastLoadedSheetRef = useRef(null); // Track last loaded sheet to prevent unnecessary reloads

  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    try {
      console.log('Saving columnFilters for', storageKey, ':', columnFilters);
      sessionStorage.setItem(`excelFilters_${storageKey}`, JSON.stringify(columnFilters));
    } catch (error) {
      console.warn('Failed to save filters to sessionStorage:', error);
    }
  }, [columnFilters, storageKey]);

  useEffect(() => {
    try {
      console.log('Saving multiSelectFilters for', storageKey, ':', multiSelectFilters);
      sessionStorage.setItem(`excelMultiSelectFilters_${storageKey}`, JSON.stringify(multiSelectFilters));
    } catch (error) {
      console.warn('Failed to save multi-select filters to sessionStorage:', error);
    }
  }, [multiSelectFilters, storageKey]);

  useEffect(() => {
    // Only reload if the file content or name actually changed
    const hasContentChanged = prevFileContentRef.current !== fileContent;
    const hasFileNameChanged = prevFileNameRef.current !== file?.name;
    
    if (!hasContentChanged && !hasFileNameChanged) {
      console.log('ExcelViewer: Skipping reload - no changes detected');
      return;
    }
    
    console.log('ExcelViewer: Content or file changed, reloading...', {
      hasContentChanged,
      hasFileNameChanged,
      fileName: file?.name,
      hasContent: !!fileContent
    });
    
    prevFileContentRef.current = fileContent;
    prevFileNameRef.current = file?.name;

    const loadExcelFile = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('ExcelViewer Debug - useEffect triggered:', {
          fileName: file?.name,
          tabId: file?.tabId,
          storageKey: storageKey,
          hasFileContent: !!fileContent,
          currentActiveSheet: activeSheet
        });

        // Clear any old storage keys that might conflict (cleanup for existing sessions)
        if (file?.name && file?.tabId && file.name !== file.tabId) {
          const oldKey = file.name.replace(/[^a-zA-Z0-9]/g, '_');
          try {
            // Clear all possible old keys with different sheet names
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key && (key.startsWith(`excelFilters_${oldKey}`) || key.startsWith(`excelMultiSelectFilters_${oldKey}`))) {
                sessionStorage.removeItem(key);
              }
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        let data;
        if (fileContent) {
          // If we have file content as buffer/blob
          console.log('ExcelViewer: Using provided fileContent');
          data = fileContent;
        } else if (file && file.handle) {
          // Read from file handle
          console.log('ExcelViewer: Reading from file handle');
          const fileData = await file.handle.getFile();
          data = await fileData.arrayBuffer();
        } else {
          console.error('ExcelViewer: No file data available', { 
            hasFileContent: !!fileContent, 
            hasFile: !!file, 
            hasHandle: !!(file && file.handle),
            file,
            fileContent: fileContent ? 'Present' : 'Missing'
          });
          throw new Error('No file data available');
        }

        // Parse Excel file
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        
        const sheets = wb.SheetNames;
        setSheetNames(sheets);
        
        // Set first sheet as active by default, or use provided active sheet
        if (sheets.length > 0) {
          // Use provided active sheet if it exists and is valid, otherwise use first sheet
          const sheetToActivate = initialActiveSheet && sheets.includes(initialActiveSheet) 
            ? initialActiveSheet 
            : sheets[0];
          
          console.log('ExcelViewer: Setting active sheet to:', sheetToActivate, {
            initialActiveSheet,
            availableSheets: sheets,
            fileStorageKey
          });
          
          setActiveSheet(sheetToActivate);
          setSheetNames(sheets);
          
          // Notify parent about sheet names and active sheet
          if (onSheetChange) {
            onSheetChange(sheetToActivate, sheets);
          }
          
          loadSheetData(wb, sheetToActivate, false); // Don't reset filters on initial load
        }
      } catch (err) {
        console.error('Error loading Excel file:', err);
        setError(`Failed to load Excel file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (hasContentChanged || hasFileNameChanged) {
      loadExcelFile();
    }
  }, [file?.name, fileContent]); // Only depend on name and content

  // Update active sheet when prop changes (for switching between tabs)
  useEffect(() => {
    if (initialActiveSheet && initialActiveSheet !== activeSheet && sheetNames.includes(initialActiveSheet)) {
      console.log('ExcelViewer: Updating active sheet from prop:', initialActiveSheet);
      setActiveSheet(initialActiveSheet);
      if (workbook) {
        loadSheetData(workbook, initialActiveSheet, false);
      }
    }
  }, [initialActiveSheet, activeSheet, sheetNames, workbook]);

  // Smart click-outside detection that ignores layout changes
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown === null) return;
      
      // Update last interaction time
      lastInteractionRef.current = Date.now();
      
      // Check if click is related to filter functionality
      const isFilterRelated = 
        event.target.closest('.filter-dropdown') ||
        event.target.closest('[data-filter-button]');
      
      // Check if it's a layout/resize related element
      const isLayoutChange = 
        event.target.closest('.resize-handle') ||
        event.target.closest('[data-panel-resize]') ||
        event.target.closest('.panel-resizer') ||
        event.target.closest('.chat-panel') ||
        event.target.closest('.sidebar') ||
        event.target.matches('button[aria-label*="resize"]') ||
        event.target.matches('[class*="resize"]') ||
        event.target.matches('[class*="split"]') ||
        event.target.matches('[class*="panel"]');
      
      // Only close if it's a genuine user click, not a layout change
      if (!isFilterRelated && !isLayoutChange) {
        // Add a small delay to distinguish between layout changes and intentional clicks
        setTimeout(() => {
          const timeSinceLastInteraction = Date.now() - lastInteractionRef.current;
          // Only close if enough time has passed (indicating intentional click)
          if (timeSinceLastInteraction > 100) {
            setShowFilterDropdown(null);
          }
        }, 150);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showFilterDropdown !== null) {
        setShowFilterDropdown(null);
      }
    };

    // Use capture phase to catch events early
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showFilterDropdown]);

  const loadSheetData = useCallback((wb, sheetName, resetFilters = false) => {
    try {
      // Prevent unnecessary reloads of the same sheet
      if (lastLoadedSheetRef.current === sheetName && !resetFilters) {
        console.log('Sheet already loaded, skipping reload:', sheetName);
        return;
      }
      
      const worksheet = wb.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '', 
        raw: false 
      });
      setOriginalSheetData(jsonData);
      setSheetData(jsonData);
      lastLoadedSheetRef.current = sheetName;
      
      // Only reset filters when explicitly requested (e.g., sheet switching)
      if (resetFilters) {
        console.log('Resetting filters for sheet change to:', sheetName);
        setColumnFilters({});
        setMultiSelectFilters({});
        setSortConfig({ column: null, direction: null });
        setShowFilterDropdown(null);
        
        // Note: We don't clear sessionStorage here because we want filters
        // to persist per sheet. The new filters will be loaded by the useEffect
        // when the storageKey changes due to activeSheet change.
      }
    } catch (err) {
      console.error('Error loading sheet data:', err);
      setError(`Failed to load sheet "${sheetName}": ${err.message}`);
    }
  }, [storageKey]);

  const handleSheetChange = (sheetName) => {
    console.log('ExcelViewer: handleSheetChange called:', {
      newSheet: sheetName,
      currentActiveSheet: activeSheet,
      hasWorkbook: !!workbook,
      sheetNames: sheetNames,
      fileStorageKey
    });
    
    // Update local state
    setActiveSheet(sheetName);
    
    // Notify parent component
    if (onSheetChange) {
      onSheetChange(sheetName, sheetNames);
    }
    
    if (workbook) {
      loadSheetData(workbook, sheetName, false); // Don't reset filters, let useEffect handle loading saved filters
    }
  };

  const getColumnLetter = (index) => {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode(65 + (index % 26)) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  };

  // Get unique values for a column for filter dropdown
  const getUniqueColumnValues = (columnIndex) => {
    if (originalSheetData.length <= 1) return [];
    
    const values = originalSheetData.slice(1).map(row => row[columnIndex] || '');
    return [...new Set(values)].sort();
  };

  // Apply filters and sorting
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...originalSheetData];
    
    // Apply filters (skip header row)
    if (filtered.length > 1) {
      const dataRows = filtered.slice(1);
      const filteredRows = dataRows.filter(row => {
        return Object.entries(columnFilters).every(([colIndex, filterValue]) => {
          if (!filterValue || filterValue === 'all') return true;
          const cellValue = (row[parseInt(colIndex)] || '').toString().toLowerCase();
          return cellValue.includes(filterValue.toLowerCase());
        }) && Object.entries(multiSelectFilters).every(([colIndex, selectedValues]) => {
          if (!selectedValues || selectedValues.length === 0) return true;
          const cellValue = (row[parseInt(colIndex)] || '').toString();
          return selectedValues.includes(cellValue);
        });
      });
      
      // Apply sorting
      if (sortConfig.column !== null) {
        filteredRows.sort((a, b) => {
          const aVal = a[sortConfig.column] || '';
          const bVal = b[sortConfig.column] || '';
          
          // Try to parse as numbers
          const aNum = parseFloat(aVal);
          const bNum = parseFloat(bVal);
          
          let comparison = 0;
          if (!isNaN(aNum) && !isNaN(bNum)) {
            comparison = aNum - bNum;
          } else {
            comparison = aVal.toString().localeCompare(bVal.toString());
          }
          
          return sortConfig.direction === 'desc' ? -comparison : comparison;
        });
      }
      
      filtered = [filtered[0], ...filteredRows]; // Keep header row
    }
    
    return filtered;
  }, [originalSheetData, columnFilters, multiSelectFilters, sortConfig]);

  // Handle column header click for sorting
  const handleSort = (columnIndex) => {
    setSortConfig(prev => {
      if (prev.column === columnIndex) {
        if (prev.direction === 'asc') return { column: columnIndex, direction: 'desc' };
        if (prev.direction === 'desc') return { column: null, direction: null };
      }
      return { column: columnIndex, direction: 'asc' };
    });
  };

  // Handle filter change with interaction tracking
  const handleFilterChange = (columnIndex, value) => {
    lastInteractionRef.current = Date.now();
    setColumnFilters(prev => ({
      ...prev,
      [columnIndex]: value
    }));
  };

  // Handle opening/closing filter dropdowns - simplified
  const handleFilterDropdownToggle = (colIndex) => {
    const isCurrentlyOpen = showFilterDropdown === colIndex;
    setShowFilterDropdown(isCurrentlyOpen ? null : colIndex);
    
    // Update interaction time to prevent immediate closing
    lastInteractionRef.current = Date.now();
  };

  // Handle multiple selection filter with interaction tracking
  const handleMultiSelectFilter = (columnIndex, value) => {
    // Update interaction time to prevent closing
    lastInteractionRef.current = Date.now();
    
    setMultiSelectFilters(prev => {
      const currentSelections = prev[columnIndex] || [];
      const isSelected = currentSelections.includes(value);
      
      let newSelections;
      if (isSelected) {
        // Remove the value
        newSelections = currentSelections.filter(v => v !== value);
      } else {
        // Add the value
        newSelections = [...currentSelections, value];
      }
      
      const newFilters = {
        ...prev,
        [columnIndex]: newSelections
      };
      
      // Remove empty filter arrays
      if (newSelections.length === 0) {
        delete newFilters[columnIndex];
      }
      
      return newFilters;
    });
  };

  // Select all values for a column
  const handleSelectAll = (columnIndex, allValues) => {
    lastInteractionRef.current = Date.now();
    setMultiSelectFilters(prev => ({
      ...prev,
      [columnIndex]: [...allValues]
    }));
  };

  // Clear selection for a column
  const handleClearSelection = (columnIndex) => {
    lastInteractionRef.current = Date.now();
    setMultiSelectFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnIndex];
      return newFilters;
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setColumnFilters({});
    setMultiSelectFilters({});
    setSortConfig({ column: null, direction: null });
    
    // Also clear from sessionStorage
    try {
      sessionStorage.removeItem(`excelFilters_${storageKey}`);
      sessionStorage.removeItem(`excelMultiSelectFilters_${storageKey}`);
    } catch (error) {
      console.warn('Failed to clear filters from sessionStorage:', error);
    }
  };

  // Use filtered data instead of original sheetData
  const displayData = filteredAndSortedData.length > 0 ? filteredAndSortedData : sheetData;

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${colors.primary}`}>
        <div className={`text-center ${colors.textSecondary}`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading Excel file...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${colors.primary}`}>
        <div className={`text-center ${colors.textSecondary}`}>
          <div className={`text-red-500 mb-4`}>
            <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${colors.primary} overflow-hidden`} style={{ height: '100%', maxHeight: '100%' }}>
      {/* Sheet Tabs */}
      {sheetNames.length > 1 && (
        <div className={`flex ${colors.secondary} ${colors.border} border-b overflow-x-auto flex-shrink-0`} style={{ minHeight: 'auto' }}>
          {sheetNames.map((sheetName) => (
            <button
              key={sheetName}
              onClick={() => handleSheetChange(sheetName)}
              className={`px-4 py-2 text-sm font-medium border-r ${colors.border} hover:${colors.hover} transition-colors whitespace-nowrap ${
                activeSheet === sheetName 
                  ? `${colors.tertiary} ${colors.text}` 
                  : `${colors.textSecondary}`
              }`}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}

      {/* Sheet Info */}
      <div className={`px-4 py-2 ${colors.secondary} ${colors.border} border-b flex-shrink-0`} style={{ minHeight: 'auto' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className={`text-sm ${colors.textSecondary}`}>
              Sheet: <span className={`${colors.text} font-medium`}>{activeSheet}</span>
            </span>
            {(Object.keys(columnFilters).length > 0 || Object.keys(multiSelectFilters).length > 0) && (
              <button
                onClick={clearAllFilters}
                className={`text-xs px-2 py-1 rounded ${colors.tertiary} hover:${colors.hover} ${colors.text} border ${colors.border}`}
              >
                Clear Filters ({Object.keys(columnFilters).length + Object.keys(multiSelectFilters).length})
              </button>
            )}
          </div>
          <span className={`text-sm ${colors.textMuted}`}>
            {displayData.length > 0 ? `${displayData.length - 1} rows × ${displayData[0]?.length || 0} columns` : 'No data'}
            {originalSheetData.length !== displayData.length && (
              <span className="ml-2 text-blue-400">
                (filtered from {originalSheetData.length - 1})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Table Container - constrained to remaining space */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0, height: 'auto' }}>
        {sheetData.length > 0 ? (
          <div className="h-full w-full overflow-auto" style={{ maxHeight: '100%', height: '100%' }}>
            <table className={`w-full ${colors.primary}`} style={{ minWidth: 'max-content' }}>
              <thead className={`sticky top-0 ${colors.secondary} ${colors.border} border-b z-10`}>
                <tr>
                  {/* Row number header */}
                  <th className={`px-3 py-2 text-left text-xs font-medium ${colors.textMuted} ${colors.border} border-r w-16 bg-opacity-100 ${colors.secondary}`}>
                    #
                  </th>
                  {/* Column headers */}
                  {displayData[0]?.map((headerCell, colIndex) => {
                    const uniqueValues = getUniqueColumnValues(colIndex);
                    const isFiltered = columnFilters[colIndex] || (multiSelectFilters[colIndex] && multiSelectFilters[colIndex].length > 0);
                    const sortDirection = sortConfig.column === colIndex ? sortConfig.direction : null;
                    const selectedValues = multiSelectFilters[colIndex] || [];
                    
                    return (
                      <th
                        key={colIndex}
                        className={`relative px-3 py-2 text-left text-xs font-medium ${colors.textMuted} ${colors.border} border-r min-w-32 bg-opacity-100 ${colors.secondary}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-gray-500">{getColumnLetter(colIndex)}</span>
                            <span className="font-medium truncate">{String(headerCell || '')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Sort indicator */}
                            <button
                              onClick={() => handleSort(colIndex)}
                              className={`text-xs hover:${colors.text} transition-colors ${
                                sortDirection ? colors.text : colors.textMuted
                              }`}
                            >
                              {sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '↕'}
                            </button>
                            {/* Filter dropdown button */}
                            <div className="relative filter-dropdown">
                              <button
                                data-filter-button="true"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFilterDropdownToggle(colIndex);
                                }}
                                className={`text-xs hover:${colors.text} transition-colors relative ${
                                  isFiltered ? 'text-blue-400' : colors.textMuted
                                }`}
                              >
                                <svg 
                                  width="12" 
                                  height="12" 
                                  viewBox="0 0 24 24" 
                                  fill="currentColor"
                                  className="inline-block"
                                >
                                  <path d="M3 6h18v2.5l-7 7v6.5l-4-2v-4.5l-7-7z"/>
                                </svg>
                                {/* Multi-select indicator */}
                                {selectedValues.length > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                    {selectedValues.length}
                                  </span>
                                )}
                              </button>
                              {/* Filter dropdown */}
                              {showFilterDropdown === colIndex && (
                                <div 
                                  ref={filterDropdownRef}
                                  className={`absolute top-full right-0 mt-1 ${colors.primary} ${colors.border} border rounded shadow-xl z-50 w-64 max-h-80 overflow-hidden`}
                                  style={{ 
                                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                                    border: '1px solid #4a5568'
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    lastInteractionRef.current = Date.now();
                                  }}
                                >
                                  {/* Text Filter Section */}
                                  <div className="p-3 border-b border-gray-600">
                                    <label className={`block text-xs ${colors.textMuted} mb-2`}>Text Filter:</label>
                                    <input
                                      type="text"
                                      placeholder="Type to filter..."
                                      value={columnFilters[colIndex] || ''}
                                      onChange={(e) => handleFilterChange(colIndex, e.target.value)}
                                      className={`w-full px-2 py-1 text-xs ${colors.secondary} ${colors.border} border rounded ${colors.text}`}
                                    />
                                  </div>

                                  {/* Multi-Select Section */}
                                  <div className="p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <label className={`text-xs ${colors.textMuted}`}>
                                        Select Values ({selectedValues.length} of {uniqueValues.length}):
                                      </label>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleSelectAll(colIndex, uniqueValues)}
                                          className={`text-xs px-2 py-1 rounded ${colors.tertiary} hover:${colors.hover} ${colors.text}`}
                                          title="Select All"
                                        >
                                          All
                                        </button>
                                        <button
                                          onClick={() => handleClearSelection(colIndex)}
                                          className={`text-xs px-2 py-1 rounded ${colors.tertiary} hover:${colors.hover} ${colors.text}`}
                                          title="Clear Selection"
                                        >
                                          None
                                        </button>
                                      </div>
                                    </div>

                                    {/* Filter status indicator */}
                                    {(selectedValues.length > 0 || columnFilters[colIndex]) && (
                                      <div className={`mb-2 p-2 rounded text-xs ${colors.tertiary} ${colors.text} border-l-4 border-blue-400`}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-blue-400">●</span>
                                          <span>
                                            Active filters: 
                                            {selectedValues.length > 0 && ` ${selectedValues.length} selected`}
                                            {columnFilters[colIndex] && ` text: "${columnFilters[colIndex]}"`}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Scrollable checkbox list */}
                                    <div className="max-h-48 overflow-y-auto border border-gray-600 rounded">
                                      {uniqueValues.slice(0, 100).map((value, idx) => {
                                        const isSelected = selectedValues.includes(value);
                                        return (
                                          <label
                                            key={idx}
                                            className={`flex items-center gap-2 px-3 py-2 text-xs hover:${colors.hover} cursor-pointer ${colors.text} border-b border-gray-700 last:border-b-0`}
                                            title={String(value)}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => handleMultiSelectFilter(colIndex, value)}
                                              className="w-3 h-3 text-blue-600 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                            />
                                            <span className="truncate flex-1">
                                              {String(value) || '(Empty)'}
                                            </span>
                                          </label>
                                        );
                                      })}
                                      {uniqueValues.length > 100 && (
                                        <div className={`px-3 py-2 text-xs ${colors.textMuted} text-center border-t border-gray-600`}>
                                          Showing first 100 values...
                                        </div>
                                      )}
                                    </div>

                                    {/* Footer - simplified */}
                                    <div className={`p-2 border-t border-gray-600 text-center`}>
                                      <span className={`text-xs ${colors.textMuted}`}>
                                        Click outside to close • ESC to close
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayData.slice(1).map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`${colors.hover} hover:${colors.tertiary} ${colors.border} border-b`}
                  >
                    {/* Row number */}
                    <td className={`px-3 py-2 text-xs ${colors.textMuted} ${colors.border} border-r font-mono bg-opacity-50 ${colors.secondary} sticky left-0`}>
                      {rowIndex + 2}
                    </td>
                    {/* Row data */}
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className={`px-3 py-2 text-sm ${colors.text} ${colors.border} border-r max-w-xs`}
                        title={String(cell || '')}
                      >
                        <div className="truncate">
                          {String(cell || '')}
                        </div>
                      </td>
                    ))}
                    {/* Fill empty columns if row is shorter */}
                    {displayData[0] && row.length < displayData[0].length && 
                      Array.from({ length: displayData[0].length - row.length }, (_, index) => (
                        <td
                          key={`empty-${index}`}
                          className={`px-3 py-2 text-sm ${colors.text} ${colors.border} border-r max-w-xs`}
                        >
                          <div className="truncate"></div>
                        </td>
                      ))
                    }
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={`flex items-center justify-center h-full ${colors.textMuted}`}>
            <p>No data in this sheet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelViewer;
