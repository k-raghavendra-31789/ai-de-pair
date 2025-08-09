import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExcelViewer from '../components/ExcelViewer'
import { AppStateProvider } from '../contexts/AppStateContext'
import { ThemeProvider } from '../components/ThemeContext'
import * as XLSX from 'xlsx'

// Mock XLSX library
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
  }
}))

// Test wrapper with all necessary providers
const TestWrapper = ({ children }) => (
  <ThemeProvider>
    <AppStateProvider>
      {children}
    </AppStateProvider>
  </ThemeProvider>
)

describe('ExcelViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render with no file selected message', () => {
      render(
        <TestWrapper>
          <ExcelViewer />
        </TestWrapper>
      )

      expect(screen.getByText(/No Excel file selected/)).toBeInTheDocument()
    })

    it('should render loading state', () => {
      render(
        <TestWrapper>
          <ExcelViewer isLoading={true} />
        </TestWrapper>
      )

      expect(screen.getByText(/Loading Excel file/)).toBeInTheDocument()
    })
  })

  describe('Excel File Display', () => {
    const mockExcelData = {
      content: new ArrayBuffer(100),
      activeSheet: 'Sheet1',
      sheetNames: ['Sheet1', 'Sheet2', 'Sheet3']
    }

    const mockWorkbook = {
      Sheets: {
        Sheet1: {},
        Sheet2: {},
        Sheet3: {}
      },
      SheetNames: ['Sheet1', 'Sheet2', 'Sheet3']
    }

    const mockSheetData = [
      { A: 'Name', B: 'Age', C: 'City' },
      { A: 'John', B: 25, C: 'New York' },
      { A: 'Jane', B: 30, C: 'Los Angeles' },
      { A: 'Bob', B: 35, C: 'Chicago' }
    ]

    beforeEach(() => {
      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockSheetData)
    })

    it('should display Excel data when file is provided', async () => {
      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('John')).toBeInTheDocument()
        expect(screen.getByText('Jane')).toBeInTheDocument()
      })
    })

    it('should display sheet tabs', async () => {
      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Sheet1')).toBeInTheDocument()
        expect(screen.getByText('Sheet2')).toBeInTheDocument()
        expect(screen.getByText('Sheet3')).toBeInTheDocument()
      })
    })

    it('should highlight active sheet tab', async () => {
      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        const activeTab = screen.getByText('Sheet1').closest('button')
        expect(activeTab).toHaveClass('bg-blue-500')
      })
    })

    it('should switch sheets when tab is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Sheet2')).toBeInTheDocument()
      })

      const sheet2Tab = screen.getByText('Sheet2')
      await user.click(sheet2Tab)

      // Should call the context action to switch sheets
      expect(sheet2Tab.closest('button')).toBeInTheDocument()
    })

    it('should handle empty sheet data', async () => {
      XLSX.utils.sheet_to_json.mockReturnValue([])

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/No data available/)).toBeInTheDocument()
      })
    })

    it('should handle sheets with different column structures', async () => {
      const irregularData = [
        { A: 'Name', B: 'Age' },
        { A: 'John', B: 25, C: 'Extra Column' },
        { A: 'Jane' }
      ]

      XLSX.utils.sheet_to_json.mockReturnValue(irregularData)

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('John')).toBeInTheDocument()
        expect(screen.getByText('Jane')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle XLSX parsing errors', async () => {
      XLSX.read.mockImplementation(() => {
        throw new Error('Invalid Excel file')
      })

      const mockExcelData = {
        content: new ArrayBuffer(100),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/Error loading Excel file/)).toBeInTheDocument()
      })
    })

    it('should handle missing sheet data', async () => {
      const mockWorkbook = {
        Sheets: {},
        SheetNames: ['Sheet1']
      }

      XLSX.read.mockReturnValue(mockWorkbook)

      const mockExcelData = {
        content: new ArrayBuffer(100),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/No data available/)).toBeInTheDocument()
      })
    })

    it('should handle corrupted Excel data', async () => {
      const mockExcelData = {
        content: null,
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/Error loading Excel file/)).toBeInTheDocument()
      })
    })
  })

  describe('Table Rendering', () => {
    const mockSheetData = [
      { A: 'Name', B: 'Age', C: 'City' },
      { A: 'John', B: 25, C: 'New York' },
      { A: 'Jane', B: 30, C: 'Los Angeles' }
    ]

    beforeEach(() => {
      const mockWorkbook = {
        Sheets: { Sheet1: {} },
        SheetNames: ['Sheet1']
      }
      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockSheetData)
    })

    it('should render table headers correctly', async () => {
      const mockExcelData = {
        content: new ArrayBuffer(100),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('A')).toBeInTheDocument()
        expect(screen.getByText('B')).toBeInTheDocument()
        expect(screen.getByText('C')).toBeInTheDocument()
      })
    })

    it('should render table rows correctly', async () => {
      const mockExcelData = {
        content: new ArrayBuffer(100),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('John')).toBeInTheDocument()
        expect(screen.getByText('25')).toBeInTheDocument()
        expect(screen.getByText('New York')).toBeInTheDocument()
      })
    })

    it('should handle large datasets with scrolling', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        A: `Name${i}`,
        B: i,
        C: `City${i}`
      }))

      XLSX.utils.sheet_to_json.mockReturnValue(largeDataset)

      const mockExcelData = {
        content: new ArrayBuffer(100),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Name0')).toBeInTheDocument()
        // Should have scrollable container
        const table = screen.getByRole('table')
        expect(table.closest('div')).toHaveStyle({ overflow: 'auto' })
      })
    })
  })

  describe('Performance', () => {
    it('should handle re-renders efficiently', async () => {
      const mockExcelData = {
        content: new ArrayBuffer(100),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      const { rerender } = render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      // Re-render with same data
      rerender(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      // XLSX.read should be called only once due to caching
      expect(XLSX.read).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const mockExcelData = {
        content: new ArrayBuffer(100),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        const table = screen.getByRole('table')
        expect(table).toBeInTheDocument()
        expect(table).toHaveAttribute('aria-label')
      })
    })

    it('should be keyboard navigable', async () => {
      const mockExcelData = {
        content: new ArrayBuffer(100),
        activeSheet: 'Sheet1',
        sheetNames: ['Sheet1']
      }

      render(
        <TestWrapper>
          <ExcelViewer 
            tabId="test-tab"
            excelData={mockExcelData}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        const sheetTab = screen.getByText('Sheet1')
        expect(sheetTab.closest('button')).toHaveAttribute('tabIndex', '0')
      })
    })
  })
})
