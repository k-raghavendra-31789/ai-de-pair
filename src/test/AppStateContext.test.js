import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AppStateProvider, useAppState } from '../contexts/AppStateContext'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = mockLocalStorage

describe('AppStateContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  const wrapper = ({ children }) => (
    <AppStateProvider>{children}</AppStateProvider>
  )

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      
      expect(result.current.state).toEqual({
        selectedFile: null,
        availableFiles: [],
        openFolders: [],
        expandedFolders: new Set(),
        openTabs: [],
        activeTabId: null,
        excelFiles: {},
        excelCache: new Map(),
        chatInput: '',
        chatMessages: [],
        selectedLLM: 'claude-sonnet-3.5',
        attachedDocuments: [],
        panelSizes: {
          leftPanelWidth: 250,
          rightPanelWidth: 450,
          bottomPanelHeight: 0,
        },
        isTerminalVisible: false,
        isResizing: false,
      })
    })

    it('should load state from localStorage if available', () => {
      const mockFolders = [{ id: 'folder1', name: 'Test Folder' }]
      const mockExpandedFolders = ['folder1']
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'app_folders') return JSON.stringify(mockFolders)
        if (key === 'app_expanded_folders') return JSON.stringify(mockExpandedFolders)
        return null
      })

      const { result } = renderHook(() => useAppState(), { wrapper })
      
      expect(result.current.state.openFolders).toEqual(mockFolders)
      expect(result.current.state.expandedFolders).toEqual(new Set(mockExpandedFolders))
    })
  })

  describe('File Management Actions', () => {
    it('should set selected file', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testFile = { name: 'test.txt', id: 'file1' }

      act(() => {
        result.current.actions.setSelectedFile(testFile)
      })

      expect(result.current.state.selectedFile).toEqual(testFile)
    })

    it('should set available files', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testFiles = [
        { name: 'file1.txt', id: 'file1' },
        { name: 'file2.csv', id: 'file2' }
      ]

      act(() => {
        result.current.actions.setAvailableFiles(testFiles)
      })

      expect(result.current.state.availableFiles).toEqual(testFiles)
    })
  })

  describe('Folder Management Actions', () => {
    it('should add a folder', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testFolder = { id: 'folder1', name: 'Test Folder', handle: {} }

      act(() => {
        result.current.actions.addFolder(testFolder)
      })

      expect(result.current.state.openFolders).toContain(testFolder)
    })

    it('should not add duplicate folders', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testFolder = { id: 'folder1', name: 'Test Folder', handle: {} }

      act(() => {
        result.current.actions.addFolder(testFolder)
        result.current.actions.addFolder(testFolder) // Try to add again
      })

      expect(result.current.state.openFolders).toHaveLength(1)
    })

    it('should remove a folder', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testFolder = { id: 'folder1', name: 'Test Folder', handle: {} }

      act(() => {
        result.current.actions.addFolder(testFolder)
      })

      expect(result.current.state.openFolders).toHaveLength(1)

      act(() => {
        result.current.actions.removeFolder('folder1')
      })

      expect(result.current.state.openFolders).toHaveLength(0)
    })

    it('should reconnect a folder', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const originalFolder = { id: 'folder1', name: 'Test Folder', handle: null }
      const reconnectedFolder = { id: 'folder1', name: 'Test Folder', handle: {} }

      act(() => {
        result.current.actions.addFolder(originalFolder)
      })

      act(() => {
        result.current.actions.reconnectFolder('folder1', reconnectedFolder)
      })

      expect(result.current.state.openFolders[0]).toEqual(reconnectedFolder)
    })

    it('should handle array safety for folder operations', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      
      // Test with corrupted state (non-array)
      act(() => {
        result.current.actions.setOpenFolders('not-an-array')
      })

      expect(result.current.state.openFolders).toEqual([])
    })
  })

  describe('Tab Management Actions', () => {
    it('should add a tab', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testTab = { id: 'tab1', name: 'Test Tab', type: 'file' }

      act(() => {
        result.current.actions.addTab(testTab)
      })

      expect(result.current.state.openTabs).toContain(testTab)
      expect(result.current.state.activeTabId).toBe('tab1')
    })

    it('should update existing tab instead of duplicating', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const originalTab = { id: 'tab1', name: 'Original Tab', type: 'file' }
      const updatedTab = { id: 'tab1', name: 'Updated Tab', type: 'file' }

      act(() => {
        result.current.actions.addTab(originalTab)
        result.current.actions.addTab(updatedTab)
      })

      expect(result.current.state.openTabs).toHaveLength(1)
      expect(result.current.state.openTabs[0].name).toBe('Updated Tab')
    })

    it('should close a tab', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testTab = { id: 'tab1', name: 'Test Tab', type: 'file' }

      act(() => {
        result.current.actions.addTab(testTab)
      })

      expect(result.current.state.openTabs).toHaveLength(1)

      act(() => {
        result.current.actions.closeTab('tab1')
      })

      expect(result.current.state.openTabs).toHaveLength(0)
      expect(result.current.state.activeTabId).toBeNull()
    })

    it('should switch active tab when closing current active tab', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const tab1 = { id: 'tab1', name: 'Tab 1', type: 'file' }
      const tab2 = { id: 'tab2', name: 'Tab 2', type: 'file' }

      act(() => {
        result.current.actions.addTab(tab1)
        result.current.actions.addTab(tab2)
      })

      expect(result.current.state.activeTabId).toBe('tab2')

      act(() => {
        result.current.actions.closeTab('tab2')
      })

      expect(result.current.state.activeTabId).toBe('tab1')
    })

    it('should set active tab', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const tab1 = { id: 'tab1', name: 'Tab 1', type: 'file' }
      const tab2 = { id: 'tab2', name: 'Tab 2', type: 'file' }

      act(() => {
        result.current.actions.addTab(tab1)
        result.current.actions.addTab(tab2)
        result.current.actions.setActiveTab('tab1')
      })

      expect(result.current.state.activeTabId).toBe('tab1')
    })
  })

  describe('Excel Management Actions', () => {
    it('should set excel data', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const excelData = {
        content: new ArrayBuffer(8),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1', 'Sheet2']
      }

      act(() => {
        result.current.actions.setExcelData('tab1', excelData)
      })

      expect(result.current.state.excelFiles['tab1']).toEqual(excelData)
    })

    it('should update excel file', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const initialData = {
        content: new ArrayBuffer(8),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1', 'Sheet2']
      }

      act(() => {
        result.current.actions.setExcelData('tab1', initialData)
      })

      act(() => {
        result.current.actions.updateExcelFile('tab1', { activeSheet: 'Sheet2' })
      })

      expect(result.current.state.excelFiles['tab1'].activeSheet).toBe('Sheet2')
    })

    it('should set excel active sheet', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const excelData = {
        content: new ArrayBuffer(8),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1', 'Sheet2']
      }

      act(() => {
        result.current.actions.setExcelData('tab1', excelData)
        result.current.actions.setExcelActiveSheet('tab1', 'Sheet2')
      })

      expect(result.current.state.excelFiles['tab1'].activeSheet).toBe('Sheet2')
    })

    it('should clear excel data', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const excelData = {
        content: new ArrayBuffer(8),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1', 'Sheet2']
      }

      act(() => {
        result.current.actions.setExcelData('tab1', excelData)
      })

      expect(result.current.state.excelFiles['tab1']).toBeDefined()

      act(() => {
        result.current.actions.clearExcelData('tab1')
      })

      expect(result.current.state.excelFiles['tab1']).toBeUndefined()
    })
  })

  describe('Chat Management Actions', () => {
    it('should set chat input', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testInput = 'Hello, this is a test message'

      act(() => {
        result.current.actions.setChatInput(testInput)
      })

      expect(result.current.state.chatInput).toBe(testInput)
    })

    it('should set selected LLM', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testLLM = 'gpt-4'

      act(() => {
        result.current.actions.setSelectedLLM(testLLM)
      })

      expect(result.current.state.selectedLLM).toBe(testLLM)
    })

    it('should add chat message', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testMessage = { id: 'msg1', content: 'Test message', sender: 'user' }

      act(() => {
        result.current.actions.addChatMessage(testMessage)
      })

      expect(result.current.state.chatMessages).toContain(testMessage)
    })

    it('should clear chat messages', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testMessage = { id: 'msg1', content: 'Test message', sender: 'user' }

      act(() => {
        result.current.actions.addChatMessage(testMessage)
      })

      expect(result.current.state.chatMessages).toHaveLength(1)

      act(() => {
        result.current.actions.clearChatMessages()
      })

      expect(result.current.state.chatMessages).toHaveLength(0)
    })
  })

  describe('UI State Management', () => {
    it('should update panel sizes', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const newSizes = {
        leftPanelWidth: 300,
        rightPanelWidth: 400,
        bottomPanelHeight: 200
      }

      act(() => {
        result.current.actions.updatePanelSizes(newSizes)
      })

      expect(result.current.state.panelSizes).toEqual(newSizes)
    })

    it('should toggle terminal visibility', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })

      expect(result.current.state.isTerminalVisible).toBe(false)

      act(() => {
        result.current.actions.setTerminalVisible(true)
      })

      expect(result.current.state.isTerminalVisible).toBe(true)
    })

    it('should set resizing state', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })

      expect(result.current.state.isResizing).toBe(false)

      act(() => {
        result.current.actions.setResizing(true)
      })

      expect(result.current.state.isResizing).toBe(true)
    })
  })

  describe('Persistence', () => {
    it('should save folders to localStorage when folders change', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testFolder = { id: 'folder1', name: 'Test Folder', handle: {} }

      act(() => {
        result.current.actions.addFolder(testFolder)
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'app_folders',
        expect.stringContaining('folder1')
      )
    })

    it('should save expanded folders when they change', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })

      act(() => {
        result.current.actions.setExpandedFolders(new Set(['folder1', 'folder2']))
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'app_expanded_folders',
        JSON.stringify(['folder1', 'folder2'])
      )
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      expect(() => {
        renderHook(() => useAppState(), { wrapper })
      }).not.toThrow()
    })
  })

  describe('Utility Actions', () => {
    it('should clear folder data and localStorage', () => {
      const { result } = renderHook(() => useAppState(), { wrapper })
      const testFolder = { id: 'folder1', name: 'Test Folder', handle: {} }

      act(() => {
        result.current.actions.addFolder(testFolder)
        result.current.actions.setExpandedFolders(new Set(['folder1']))
      })

      expect(result.current.state.openFolders).toHaveLength(1)

      act(() => {
        result.current.actions.clearFolderData()
      })

      expect(result.current.state.openFolders).toHaveLength(0)
      expect(result.current.state.expandedFolders).toEqual(new Set())
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('app_folders')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('app_expanded_folders')
    })
  })
})
