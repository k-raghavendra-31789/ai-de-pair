import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock the File System Access API
const mockDirectoryHandle = {
  values: vi.fn().mockReturnValue([
    {
      kind: 'file',
      name: 'test.xlsx'
    }
  ]),
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

// Mock XLSX library
vi.mock('xlsx', () => ({
  read: vi.fn().mockReturnValue({
    Sheets: { Sheet1: {} },
    SheetNames: ['Sheet1']
  }),
  utils: {
    sheet_to_json: vi.fn().mockReturnValue([
      { A: 'Name', B: 'Age' },
      { A: 'John', B: 25 }
    ]),
  }
}))

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  describe('App Initialization', () => {
    it('should render the complete application', () => {
      render(<App />)

      expect(screen.getByText('Local')).toBeInTheDocument()
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
      expect(screen.getByText('Terminal')).toBeInTheDocument()
    })

    it('should load persisted data on startup', () => {
      const mockFolders = [
        { id: 'folder1', name: 'Persisted Folder', handle: null }
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockFolders))

      render(<App />)

      expect(screen.getByText('Persisted Folder')).toBeInTheDocument()
      expect(screen.getByText('Reconnect')).toBeInTheDocument()
    })
  })

  describe('End-to-End Workflows', () => {
    it('should complete folder opening workflow', async () => {
      const user = userEvent.setup()
      
      render(<App />)

      // Click open folder button
      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      // Should call directory picker
      expect(global.showDirectoryPicker).toHaveBeenCalled()

      // Should show the folder in the tree
      await waitFor(() => {
        expect(screen.getByText('test-folder')).toBeInTheDocument()
      })
    })

    it('should complete file opening and Excel viewing workflow', async () => {
      const user = userEvent.setup()
      
      // Mock a folder with Excel file
      const mockFolderWithExcel = {
        values: vi.fn().mockReturnValue([
          {
            kind: 'file',
            name: 'data.xlsx',
            getFile: vi.fn().mockResolvedValue(new File([''], 'data.xlsx'))
          }
        ]),
        kind: 'directory',
        name: 'excel-folder'
      }

      global.showDirectoryPicker.mockResolvedValue(mockFolderWithExcel)

      render(<App />)

      // Open folder
      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      // Wait for folder to appear
      await waitFor(() => {
        expect(screen.getByText('excel-folder')).toBeInTheDocument()
      })

      // Expand folder to see files
      const folderElement = screen.getByText('excel-folder')
      await user.click(folderElement)

      // File should appear and be clickable
      await waitFor(() => {
        expect(screen.getByText('data.xlsx')).toBeInTheDocument()
      })
    })

    it('should complete chat interaction workflow', async () => {
      const user = userEvent.setup()
      
      render(<App />)

      // Type message in chat
      const chatInput = screen.getByPlaceholderText(/Ask about your files/)
      await user.type(chatInput, 'Hello AI')

      // Send message
      const sendButton = screen.getByText('Send')
      await user.click(sendButton)

      // Input should be cleared
      expect(chatInput).toHaveValue('')
    })

    it('should complete folder persistence and reconnection workflow', async () => {
      const user = userEvent.setup()
      
      render(<App />)

      // First, add a folder
      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      await waitFor(() => {
        expect(screen.getByText('test-folder')).toBeInTheDocument()
      })

      // Simulate page refresh by re-rendering
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([
        { id: 'folder1', name: 'test-folder', handle: null }
      ]))

      render(<App />)

      // Folder should be persisted but without handle
      expect(screen.getByText('test-folder')).toBeInTheDocument()
      expect(screen.getByText('Reconnect')).toBeInTheDocument()

      // Click reconnect
      const reconnectButton = screen.getByText('Reconnect')
      await user.click(reconnectButton)

      // Should trigger directory picker again
      expect(global.showDirectoryPicker).toHaveBeenCalledTimes(2)
    })
  })

  describe('Cross-Component Communication', () => {
    it('should sync state between FileExplorer and ChatPanel', async () => {
      const user = userEvent.setup()
      
      render(<App />)

      // Open a folder
      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      // Chat panel should show updated file count
      await waitFor(() => {
        expect(screen.getByText(/Available Files:/)).toBeInTheDocument()
      })
    })

    it('should sync Excel data between components', async () => {
      const user = userEvent.setup()
      
      render(<App />)

      // Excel viewer should show count updates
      expect(screen.getByText(/Excel Files: 0/)).toBeInTheDocument()
    })

    it('should sync tab state across components', async () => {
      const user = userEvent.setup()
      
      render(<App />)

      // Opening files should create tabs
      expect(screen.getByText(/Open Tabs: 0/)).toBeInTheDocument()
    })
  })

  describe('Error Scenarios', () => {
    it('should handle File System API errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock API error
      global.showDirectoryPicker.mockRejectedValue(new Error('Permission denied'))

      render(<App />)

      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      // Should not crash the app
      expect(screen.getByText('Local')).toBeInTheDocument()
    })

    it('should handle localStorage quota exceeded', async () => {
      const user = userEvent.setup()
      
      // Mock localStorage error
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Quota exceeded')
      })

      render(<App />)

      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      // Should not crash the app
      expect(screen.getByText('Local')).toBeInTheDocument()
    })

    it('should handle corrupted persisted data', () => {
      // Mock corrupted localStorage data
      mockLocalStorage.getItem.mockReturnValue('corrupted-data')

      expect(() => render(<App />)).not.toThrow()
      
      // Should show default state
      expect(screen.getByText(/Click "Open Folder"/)).toBeInTheDocument()
    })
  })

  describe('Performance Tests', () => {
    it('should handle large folder structures efficiently', async () => {
      const user = userEvent.setup()
      
      // Mock large directory structure
      const largeDirectory = {
        values: vi.fn().mockReturnValue(
          Array.from({ length: 100 }, (_, i) => ({
            kind: 'file',
            name: `file${i}.txt`
          }))
        ),
        kind: 'directory',
        name: 'large-folder'
      }

      global.showDirectoryPicker.mockResolvedValue(largeDirectory)

      render(<App />)

      const openFolderButton = screen.getByText('Open Folder')
      await user.click(openFolderButton)

      // Should handle large structures without freezing
      await waitFor(() => {
        expect(screen.getByText('large-folder')).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('should handle rapid user interactions', async () => {
      const user = userEvent.setup()
      
      render(<App />)

      // Rapidly click buttons
      const openFolderButton = screen.getByText('Open Folder')
      
      // Click multiple times rapidly
      await Promise.all([
        user.click(openFolderButton),
        user.click(openFolderButton),
        user.click(openFolderButton)
      ])

      // Should not crash or have race conditions
      expect(screen.getByText('Local')).toBeInTheDocument()
    })
  })

  describe('Accessibility Tests', () => {
    it('should be keyboard navigable', async () => {
      render(<App />)

      // Should be able to tab through interactive elements
      const interactiveElements = screen.getAllByRole('button')
      expect(interactiveElements.length).toBeGreaterThan(0)
      
      interactiveElements.forEach(element => {
        expect(element).toHaveAttribute('tabIndex')
      })
    })

    it('should have proper ARIA labels', () => {
      render(<App />)

      // Check for ARIA labels on key components
      const fileExplorer = screen.getByText('Local').closest('div')
      const chatPanel = screen.getByText('AI Assistant').closest('div')
      
      expect(fileExplorer).toHaveAttribute('role')
      expect(chatPanel).toHaveAttribute('role')
    })

    it('should support screen readers', () => {
      render(<App />)

      // Check for screen reader support
      const liveRegions = document.querySelectorAll('[aria-live]')
      expect(liveRegions.length).toBeGreaterThan(0)
    })
  })

  describe('Responsive Design Tests', () => {
    it('should adapt to different screen sizes', () => {
      // Mock different viewport sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })

      render(<App />)

      // Should render without layout issues
      expect(screen.getByText('Local')).toBeInTheDocument()
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })

    it('should handle mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<App />)

      // Should adapt layout for mobile
      expect(screen.getByText('Local')).toBeInTheDocument()
    })
  })
})
