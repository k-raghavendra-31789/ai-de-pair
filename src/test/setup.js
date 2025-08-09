import { vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Extend vi.fn() to have Jest-compatible methods
const createMockFn = () => {
  const fn = vi.fn()
  fn.mockReturnValue = (value) => fn.mockImplementation(() => value)
  fn.mockResolvedValue = (value) => fn.mockImplementation(() => Promise.resolve(value))
  fn.mockRejectedValue = (value) => fn.mockImplementation(() => Promise.reject(value))
  return fn
}

// Mock localStorage
const localStorageMock = {
  getItem: createMockFn(),
  setItem: createMockFn(),
  removeItem: createMockFn(),
  clear: createMockFn(),
  length: 0,
  key: createMockFn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

// Mock File System Access API
Object.defineProperty(window, 'showDirectoryPicker', {
  value: createMockFn(),
  writable: true
})
Object.defineProperty(window, 'showOpenFilePicker', {
  value: createMockFn(),
  writable: true
})

// Mock XLSX for Excel functionality
vi.mock('xlsx', () => ({
  read: createMockFn(),
  utils: {
    sheet_to_json: createMockFn(),
    book_new: createMockFn(),
    json_to_sheet: createMockFn(),
    book_append_sheet: createMockFn()
  }
}))

// Make vi globally available for compatibility
global.vi = vi
