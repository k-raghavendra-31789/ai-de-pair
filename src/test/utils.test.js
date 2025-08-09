import { describe, it, expect, beforeEach, vi } from 'vitest'

// Utility functions tests
describe('Utility Functions', () => {
  describe('localStorage helpers', () => {
    const mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }

    beforeEach(() => {
      global.localStorage = mockLocalStorage
      vi.clearAllMocks()
    })

    describe('saveFoldersToStorage', () => {
      // Import the function from AppStateContext
      const saveFoldersToStorage = (folders) => {
        try {
          const foldersToSave = folders.map(folder => ({
            ...folder,
            handle: null,
            children: folder.children ? folder.children.map(child => ({
              ...child,
              handle: null
            })) : undefined
          }))
          localStorage.setItem('app_folders', JSON.stringify(foldersToSave))
        } catch (error) {
          console.warn('Failed to save folders to localStorage:', error)
        }
      }

      it('should save folders to localStorage', () => {
        const folders = [
          { id: 'folder1', name: 'Test Folder', handle: {} }
        ]

        saveFoldersToStorage(folders)

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'app_folders',
          expect.stringContaining('Test Folder')
        )
      })

      it('should remove handles before saving', () => {
        const folders = [
          { id: 'folder1', name: 'Test Folder', handle: { some: 'handle' } }
        ]

        saveFoldersToStorage(folders)

        const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1])
        expect(savedData[0].handle).toBeNull()
      })

      it('should handle folders with children', () => {
        const folders = [
          {
            id: 'folder1',
            name: 'Test Folder',
            handle: {},
            children: [
              { id: 'file1', name: 'test.txt', handle: {} }
            ]
          }
        ]

        saveFoldersToStorage(folders)

        const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1])
        expect(savedData[0].children[0].handle).toBeNull()
      })

      it('should handle localStorage errors', () => {
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('Storage quota exceeded')
        })

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        
        const folders = [{ id: 'folder1', name: 'Test Folder' }]
        
        expect(() => saveFoldersToStorage(folders)).not.toThrow()
        expect(consoleSpy).toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })
    })

    describe('loadFoldersFromStorage', () => {
      const loadFoldersFromStorage = () => {
        try {
          const stored = localStorage.getItem('app_folders')
          if (!stored) return []
          
          const parsed = JSON.parse(stored)
          return Array.isArray(parsed) ? parsed : []
        } catch (error) {
          console.warn('Failed to load folders from localStorage:', error)
          localStorage.removeItem('app_folders')
          return []
        }
      }

      it('should load folders from localStorage', () => {
        const folders = [{ id: 'folder1', name: 'Test Folder' }]
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(folders))

        const result = loadFoldersFromStorage()

        expect(result).toEqual(folders)
      })

      it('should return empty array if no data', () => {
        mockLocalStorage.getItem.mockReturnValue(null)

        const result = loadFoldersFromStorage()

        expect(result).toEqual([])
      })

      it('should handle corrupted JSON', () => {
        mockLocalStorage.getItem.mockReturnValue('invalid-json')

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        
        const result = loadFoldersFromStorage()

        expect(result).toEqual([])
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('app_folders')
        expect(consoleSpy).toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })

      it('should handle non-array data', () => {
        mockLocalStorage.getItem.mockReturnValue('"not-an-array"')

        const result = loadFoldersFromStorage()

        expect(result).toEqual([])
      })
    })
  })

  describe('File System API helpers', () => {
    describe('buildFolderStructure', () => {
      const mockFileHandle = {
        kind: 'file',
        name: 'test.txt'
      }

      const mockDirectoryHandle = {
        kind: 'directory',
        name: 'test-folder',
        values: vi.fn().mockReturnValue([mockFileHandle])
      }

      const buildFolderStructure = async (dirHandle) => {
        const folder = {
          name: dirHandle.name,
          type: 'folder',
          handle: dirHandle,
          children: [],
          id: `${dirHandle.name}-${Date.now()}-${Math.random()}`,
          isLoaded: false
        }

        try {
          for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
              const supportedExtensions = ['csv', 'sql', 'py', 'xlsx', 'xls', 'json', 'txt', 'js', 'ts', 'html', 'css', 'md']
              const extension = entry.name.split('.').pop().toLowerCase()
              
              if (supportedExtensions.includes(extension)) {
                folder.children.push({
                  name: entry.name,
                  type: 'file',
                  handle: entry,
                  id: `${entry.name}-${Date.now()}-${Math.random()}`
                })
              }
            } else if (entry.kind === 'directory') {
              folder.children.push({
                name: entry.name,
                type: 'folder',
                handle: entry,
                children: [],
                id: `${entry.name}-${Date.now()}-${Math.random()}`,
                isLoaded: false
              })
            }
          }
          folder.isLoaded = true
        } catch (error) {
          console.error('Error reading directory:', error)
        }

        return folder
      }

      it('should build folder structure from directory handle', async () => {
        const result = await buildFolderStructure(mockDirectoryHandle)

        expect(result.name).toBe('test-folder')
        expect(result.type).toBe('folder')
        expect(result.handle).toBe(mockDirectoryHandle)
        expect(result.children).toHaveLength(1)
        expect(result.children[0].name).toBe('test.txt')
      })

      it('should filter unsupported file types', async () => {
        const unsupportedFile = {
          kind: 'file',
          name: 'image.png'
        }

        mockDirectoryHandle.values.mockReturnValue([unsupportedFile])

        const result = await buildFolderStructure(mockDirectoryHandle)

        expect(result.children).toHaveLength(0)
      })

      it('should handle nested directories', async () => {
        const nestedDir = {
          kind: 'directory',
          name: 'nested-folder'
        }

        mockDirectoryHandle.values.mockReturnValue([nestedDir])

        const result = await buildFolderStructure(mockDirectoryHandle)

        expect(result.children).toHaveLength(1)
        expect(result.children[0].type).toBe('folder')
        expect(result.children[0].name).toBe('nested-folder')
      })

      it('should handle directory read errors', async () => {
        mockDirectoryHandle.values.mockImplementation(() => {
          throw new Error('Permission denied')
        })

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const result = await buildFolderStructure(mockDirectoryHandle)

        expect(result.children).toHaveLength(0)
        expect(consoleSpy).toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })
    })
  })

  describe('Excel processing helpers', () => {
    describe('file type detection', () => {
      const getFileTypeInfo = (filename) => {
        const extension = filename.split('.').pop().toLowerCase()
        const typeMap = {
          csv: 'Comma-Separated Values',
          xlsx: 'Excel Workbook',
          xls: 'Excel Workbook (Legacy)',
          json: 'JSON Data',
          txt: 'Text File',
          sql: 'SQL Script',
          py: 'Python Script',
          js: 'JavaScript File',
          ts: 'TypeScript File',
          html: 'HTML Document',
          css: 'CSS Stylesheet',
          md: 'Markdown Document'
        }
        return typeMap[extension] || 'Unknown File Type'
      }

      it('should detect Excel files', () => {
        expect(getFileTypeInfo('data.xlsx')).toBe('Excel Workbook')
        expect(getFileTypeInfo('legacy.xls')).toBe('Excel Workbook (Legacy)')
      })

      it('should detect CSV files', () => {
        expect(getFileTypeInfo('data.csv')).toBe('Comma-Separated Values')
      })

      it('should detect programming files', () => {
        expect(getFileTypeInfo('script.py')).toBe('Python Script')
        expect(getFileTypeInfo('app.js')).toBe('JavaScript File')
        expect(getFileTypeInfo('types.ts')).toBe('TypeScript File')
      })

      it('should handle unknown file types', () => {
        expect(getFileTypeInfo('unknown.xyz')).toBe('Unknown File Type')
      })

      it('should handle files without extensions', () => {
        expect(getFileTypeInfo('README')).toBe('Unknown File Type')
      })
    })
  })

  describe('ID generation', () => {
    const generateId = (name) => {
      return `${name}-${Date.now()}-${Math.random()}`
    }

    it('should generate unique IDs', () => {
      const id1 = generateId('test')
      const id2 = generateId('test')

      expect(id1).not.toBe(id2)
      expect(id1).toContain('test')
      expect(id2).toContain('test')
    })

    it('should include timestamp', () => {
      const beforeTime = Date.now()
      const id = generateId('test')
      const afterTime = Date.now()

      const timestamp = parseInt(id.split('-')[1])
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(timestamp).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('Data validation', () => {
    const validateFolderData = (data) => {
      if (!Array.isArray(data)) return false
      
      return data.every(folder => 
        folder &&
        typeof folder.id === 'string' &&
        typeof folder.name === 'string' &&
        typeof folder.type === 'string'
      )
    }

    it('should validate correct folder data', () => {
      const validData = [
        { id: 'folder1', name: 'Test', type: 'folder' },
        { id: 'folder2', name: 'Test2', type: 'folder' }
      ]

      expect(validateFolderData(validData)).toBe(true)
    })

    it('should reject non-array data', () => {
      expect(validateFolderData('not-array')).toBe(false)
      expect(validateFolderData({})).toBe(false)
      expect(validateFolderData(null)).toBe(false)
    })

    it('should reject invalid folder objects', () => {
      const invalidData = [
        { id: 'folder1' }, // missing name and type
        { name: 'Test' }, // missing id and type
      ]

      expect(validateFolderData(invalidData)).toBe(false)
    })

    it('should reject folders with wrong data types', () => {
      const invalidData = [
        { id: 123, name: 'Test', type: 'folder' }, // id should be string
        { id: 'folder1', name: 456, type: 'folder' }, // name should be string
      ]

      expect(validateFolderData(invalidData)).toBe(false)
    })
  })
})
