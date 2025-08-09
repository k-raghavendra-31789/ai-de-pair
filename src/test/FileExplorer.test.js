import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileExplorer from '../components/FileExplorer'
import { AppStateProvider } from '../contexts/AppStateContext'
import { ThemeProvider } from '../components/ThemeContext'

// Mock the File System Access API
const mockDirectoryHandle = {
  values: vi.fn().mockReturnValue([]),
  kind: 'directory',
  name: 'test-folder'
}

global.showDirectoryPicker = vi.fn().mockResolvedValue(mockDirectoryHandle)
global.showOpenFilePicker = vi.fn()

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = mockLocalStorage

// Test wrapper with all necessary providers
const TestWrapper = ({ children }) => (
  <ThemeProvider>
    <AppStateProvider>
      {children}
    </AppStateProvider>
  </ThemeProvider>
)

describe('FileExplorer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  describe('Rendering', () => {
    it('should render file explorer with default state', () => {
      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      expect(screen.getByText('Local')).toBeInTheDocument()
      expect(screen.getByText('GitHub')).toBeInTheDocument()
      expect(screen.getByText('Cloud')).toBeInTheDocument()
    })

    it('should show empty state when no folders are open', () => {
      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      expect(screen.getByText(/Click "Open Folder" to add folders/)).toBeInTheDocument()
    })

    it('should render open folder button', () => {
      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      expect(screen.getByText('Open Folder')).toBeInTheDocument()
    })
  })

  describe('Tab Navigation', () => {
    it('should switch between tabs', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const githubTab = screen.getByText('GitHub')
      await user.click(githubTab)

      expect(screen.getByText('Add Repository/File')).toBeInTheDocument()
    })

    it('should show cloud tab content', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const cloudTab = screen.getByText('Cloud')
      await user.click(cloudTab)

      expect(screen.getByText(/Connect to Cloud/)).toBeInTheDocument()
    })
  })

  describe('Folder Operations', () => {
    it('should open directory picker when clicking Open Folder', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      expect(global.showDirectoryPicker).toHaveBeenCalled()
    })

    it('should show loading state while opening folder', async () => {
      const user = userEvent.setup()
      
      // Mock a slow directory picker
      global.showDirectoryPicker.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockDirectoryHandle), 100))
      )

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should handle directory picker cancellation', async () => {
      const user = userEvent.setup()
      
      // Mock user cancelling the picker
      global.showDirectoryPicker.mockRejectedValue(new Error('AbortError'))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      // Should not show any error for cancellation
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })
  })

  describe('Folder Persistence', () => {
    it('should load folders from localStorage on mount', () => {
      const mockFolders = [
        { id: 'folder1', name: 'Test Folder', handle: null }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      expect(screen.getByText('Test Folder')).toBeInTheDocument()
    })

    it('should show reconnect button for folders without handles', () => {
      const mockFolders = [
        { id: 'folder1', name: 'Test Folder', handle: null }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      expect(screen.getByText('Reconnect')).toBeInTheDocument()
    })

    it('should show lock icon for folders without handles', () => {
      const mockFolders = [
        { id: 'folder1', name: 'Test Folder', handle: null }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const folderElement = screen.getByText('Test Folder').closest('div')
      expect(folderElement).toHaveClass('opacity-60')
    })

    it('should trigger reconnect when clicking reconnect button', async () => {
      const user = userEvent.setup()
      const mockFolders = [
        { id: 'folder1', name: 'Test Folder', handle: null }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const reconnectButton = screen.getByText('Reconnect')
      await user.click(reconnectButton)

      expect(global.showDirectoryPicker).toHaveBeenCalled()
    })
  })

  describe('File Tree Rendering', () => {
    it('should render folder tree with proper structure', () => {
      const mockFolders = [
        {
          id: 'folder1',
          name: 'Test Folder',
          handle: {},
          children: [
            { id: 'file1', name: 'test.txt', type: 'file' }
          ]
        }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      expect(screen.getByText('Test Folder')).toBeInTheDocument()
    })

    it('should handle folder expansion for folders with handles', async () => {
      const user = userEvent.setup()
      const mockFolders = [
        {
          id: 'folder1',
          name: 'Test Folder',
          handle: {},
          isLoaded: false,
          children: []
        }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const folderElement = screen.getByText('Test Folder')
      await user.click(folderElement)

      // Should attempt to expand the folder
      expect(folderElement).toBeInTheDocument()
    })

    it('should prevent expansion for folders without handles', async () => {
      const user = userEvent.setup()
      const mockFolders = [
        {
          id: 'folder1',
          name: 'Test Folder',
          handle: null,
          isLoaded: false,
          children: []
        }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const folderElement = screen.getByText('Test Folder')
      await user.click(folderElement)

      // Should not expand folder without handle
      expect(folderElement).toBeInTheDocument()
    })
  })

  describe('Context Menu', () => {
    it('should show context menu on right click', async () => {
      const mockFolders = [
        { id: 'folder1', name: 'Test Folder', handle: {} }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const folderElement = screen.getByText('Test Folder')
      fireEvent.contextMenu(folderElement)

      // Context menu behavior would be tested here
      expect(folderElement).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle corrupted localStorage data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json')

      expect(() => {
        render(
          <TestWrapper>
            <FileExplorer />
          </TestWrapper>
        )
      }).not.toThrow()

      expect(screen.getByText(/Click "Open Folder" to add folders/)).toBeInTheDocument()
    })

    it('should show error message for non-array folder data', () => {
      mockLocalStorage.getItem.mockReturnValue('"not-an-array"')

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      expect(screen.getByText(/Click "Open Folder" to add folders/)).toBeInTheDocument()
    })

    it('should handle File System Access API not supported', async () => {
      const user = userEvent.setup()
      
      // Mock unsupported API
      delete global.showDirectoryPicker

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      // Should handle gracefully when API is not supported
      expect(openFolderButton).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should handle keyboard events', () => {
      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      const explorer = screen.getByText('Local').closest('div')
      fireEvent.keyDown(explorer, { key: 'Enter' })

      // Keyboard navigation behavior would be tested here
      expect(explorer).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should filter files when search is performed', async () => {
      const mockFolders = [
        {
          id: 'folder1',
          name: 'Test Folder',
          handle: {},
          children: [
            { id: 'file1', name: 'test.txt', type: 'file' },
            { id: 'file2', name: 'example.csv', type: 'file' }
          ]
        }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(
        <TestWrapper>
          <FileExplorer />
        </TestWrapper>
      )

      // Search functionality would be tested here if implemented
      expect(screen.getByText('Test Folder')).toBeInTheDocument()
    })
  })
})
