# Git Commit + Pull Request Integration Feature

## Overview

Enhanced Git commit functionality with **Pull Request creation** capabilities. Users can now commit individual files AND create GitHub Pull Requests directly from the File Explorer and Monaco Editor, supporting both **regular files** and **memory files** with comprehensive Git workflows.

## Implementation Details

### 🎯 **User Experience**

- **Right-click any file** (regular or memory) → Context menu appears
- **Click "Git Commit"** → Enhanced Git commit + PR dialog opens
- **Choose workflow**: Simple commit OR commit + Pull Request
- **Enter details** → Get complete Git commands including PR creation
- **No UI changes** to existing interface - seamlessly enhanced

### 🔧 **Technical Implementation**

#### **Enhanced State Variables**

```javascript
// Original Git commit state
const [showGitCommitDialog, setShowGitCommitDialog] = useState(false);
const [commitMessage, setCommitMessage] = useState('');
const [isCommitting, setIsCommitting] = useState(false);

// New PR creation state
const [createPR, setCreatePR] = useState(false);
const [prTitle, setPrTitle] = useState('');
const [prDescription, setPrDescription] = useState('');
const [branchName, setBranchName] = useState('');
const [githubToken, setGithubToken] = useState('');
const [repoUrl, setRepoUrl] = useState('');
```

#### **Enhanced Functions Added**

1. **`handleGitCommit()`** - Opens enhanced commit + PR dialog with auto-detection
2. **`performGitCommit()`** - Generates Git commands OR Git + PR workflow
3. **`closeGitCommitDialog()`** - Closes dialog and resets all state
4. **Auto-detection logic** - Smart defaults for repo URL, PR title, branch names

#### **Dual Workflow Support**

- **Simple Commit**: Traditional Git commit workflow
- **Commit + PR**: Complete GitHub Pull Request workflow with branch creation

#### **Smart Auto-Detection**

- **Repository URL**: Attempts to detect from current context
- **Branch Names**: Auto-generates based on filename and timestamp
- **PR Titles**: Smart defaults based on file and operation type
- **GitHub Token**: Persists securely in localStorage for API operations

#### **Context Menu Enhancement**

Added Git commit option to both file types:

```javascript
// For regular files and memory files
<button onClick={() => handleGitCommit(contextMenu.item)}>
  <FaCodeBranch size={12} />
  Git Commit
</button>
```

#### **Memory File Context Menu Support**

Enhanced memory file rendering to support context menus:

```javascript
onContextMenu={(e) => handleContextMenu(e, {
  type: 'file',
  name: file.name,
  fileId: fileId,
  isMemoryFile: true,
  handle: null
})}
```

### 🚀 **Features**

#### **🔄 Complete Git + PR Workflows**

- **Simple Commit**: Traditional file commit process
- **Commit + Pull Request**: Full GitHub PR creation workflow
- **Branch Management**: Auto-generated or custom branch names
- **GitHub Integration**: Direct API support with token authentication

#### **🎯 Multiple Access Points**

- **File Explorer Context Menu**: Right-click any file (regular or memory) → Git Commit
- **Monaco Editor**:
  - **Header Button**: Click "Commit" button in editor file header
  - **Context Menu**: Right-click in editor → "Git Commit"
  - **Keyboard Shortcut**: Ctrl+Shift+G while editing
- **Universal Support**: All access points work with both regular files and memory files

#### **Enhanced MonacoEditor Integration**

- **Header Button**: Visual "Commit" button in editor file header
- **Context Menu**: Right-click in editor → "Git Commit" option
- **Keyboard Shortcut**: Ctrl+Shift+G for quick access
- **Smart Detection**: Automatically detects current file type

#### **Dual File Type Support**

- **Regular Files**: Direct Git commands for existing files on disk
- **Memory Files**: Complete workflow including save-to-disk step

#### **File-Specific Command Generation**

**For Regular Files (Simple Commit):**

```bash
git add "filename.ext"
git commit -m "Your commit message"
git push
```

**For Regular Files (Commit + PR):**

```bash
git checkout -b feature/filename-update-123456
git add "filename.ext"
git commit -m "Your commit message"
git push origin feature/filename-update-123456
gh pr create --title "Update filename.ext" --body "Your commit message"
```

**For Memory Files (Simple Commit):**

```bash
# Complete workflow shown:
1. Save file to disk (Ctrl+S in editor)
2. Navigate to the saved file's directory
3. git add "filename.ext"
4. git commit -m "Your commit message"
5. git push
```

**For Memory Files (Commit + PR):**

```bash
# Complete workflow with PR:
1. Save file to disk (Ctrl+S in editor)
2. Navigate to repository directory
3. git checkout -b feature/filename-update-123456
4. git add "filename.ext"
5. git commit -m "Your commit message"
6. git push origin feature/filename-update-123456
7. gh pr create --title "Add filename.ext" --body "Your description"
```

#### **Enhanced User Interface**

- **Expandable Dialog**: Compact for simple commits, expands for PR creation
- **Smart Defaults**: Auto-populated fields based on context and file type
- **GitHub Integration**: Token management and repository URL detection
- **Workflow Selection**: Toggle between simple commit and commit + PR
- **Branch Management**: Auto-generated or custom branch naming
- **Progress Indicators**: Loading states and validation feedback
- **Context-Aware Tips**: Different help text for memory vs regular files and workflow types

### 📁 **Files Modified**

#### **`src/components/MainEditor.js`**

- Added Git commit state variables and functions
- Enhanced file header with Git commit button
- Added keyboard shortcut support (Ctrl+Shift+G)
- Integrated Git commit dialog with theme support
- Added file type detection for memory vs regular files

#### **`src/components/MonacoEditor.js`**

- Added `onGitCommit` prop support
- Enhanced context menu with Git commit option
- Integrated with parent component's Git commit functionality

#### **`src/components/FileExplorer.js`**

- Added context menu support for memory files
- Enhanced Git commit functions to handle both file types
- Updated dialog UI to be context-aware
- Added file type detection logic

#### **Context Menu Structure**

- **For Regular Files**: Rename, Download (GitHub), Delete, **Git Commit**
- **For Memory Files**: **Git Commit** (via new context menu support)
- **For Folders**: New File

### 🎨 **UI Design**

- **Consistent Styling**: Maintains VS Code dark theme across file types
- **Dynamic Content**: Dialog adapts based on file type
- **Clear Indicators**: Visual cues for memory vs regular files
- **Context-Aware Help**: Different tips and button text per file type

### 🔐 **Security & Limitations**

#### **Memory File Considerations**

- Memory files exist only in browser memory until saved
- Must be saved to disk before Git operations can be performed
- Provides complete workflow guidance for memory file commits

#### **File Type Handling**

1. **Memory Files**: Complete save-to-disk + commit workflow
2. **Regular Files**: Direct Git command generation
3. **Both Types**: Safe instruction-based approach (no automatic execution)

### 🧪 **Usage Flow**

#### **Simple Commit Workflow:**

1. **Open any file** in Monaco Editor or File Explorer
2. **Access Git commit** via any method (button/context menu/shortcut)
3. **Enter commit message**
4. **Click "Show Git Commands"**
5. **Copy and run** commands in terminal

#### **Pull Request Workflow:**

1. **Open any file** in Monaco Editor or File Explorer
2. **Access Git commit** via any method
3. **Enable "Create Pull Request"** checkbox
4. **Configure PR details**:
   - Branch name (auto-generated or custom)
   - PR title and description
   - Repository URL
   - GitHub token (optional, for API operations)
5. **Click "Show Git + PR Commands"**
6. **Follow complete workflow** including PR creation

#### **From Monaco Editor (Most Convenient):**

- **Click "Commit" button** in file header
- **Right-click in editor** → "Git Commit"
- **Press Ctrl+Shift+G** keyboard shortcut

#### **From File Explorer:**

- **Right-click any file** → "Git Commit"
- **Works with regular files and memory files**

#### **For Different File Types:**

**Regular Files (Simple):**

```bash
git add "filename.ext"
git commit -m "message"
git push
```

**Regular Files (+ PR):**

```bash
git checkout -b branch-name
git add "filename.ext"
git commit -m "message"
git push origin branch-name
gh pr create --title "PR Title" --body "Description"
```

**Memory Files (Simple):**

```bash
# Save file first (Ctrl+S), then:
git add "filename.ext"
git commit -m "message"
git push
```

**Memory Files (+ PR):**

```bash
# Save file first (Ctrl+S), then:
git checkout -b branch-name
git add "filename.ext"
git commit -m "message"
git push origin branch-name
gh pr create --title "PR Title" --body "Description"
```

### 🔮 **Future Enhancements**

#### **Memory File Improvements**

- Auto-save memory files to disk before showing Git commands
- Integration with File System Access API for direct save operations
- Batch operations for multiple memory files

#### **Advanced Features**

- Multiple file selection for batch commits
- Integration with GitHub API for direct file commits
- File diff preview before commit
- Commit history tracking per file type

### ✅ **Benefits**

1. **Complete Git Workflow** - From commit to Pull Request creation in one interface
2. **Multiple Access Points** - Git functionality available from editor header, context menus, and keyboard shortcuts
3. **Universal Support** - Works with both regular files and memory files
4. **GitHub Integration** - Direct PR creation with API support and CLI commands
5. **Smart Automation** - Auto-detection of repository details and intelligent defaults
6. **Granular Control** - Commit individual files rather than entire directories
7. **No UI Disruption** - Seamlessly integrated into existing interfaces
8. **Educational** - Shows complete workflows for different file types and Git operations
9. **Safe** - No automatic execution, always shows instructions first
10. **Memory File Integration** - Brings complete Git + PR functionality to AI-generated content
11. **Developer Friendly** - Keyboard shortcuts and multiple access points for efficiency
12. **Branch Management** - Automatic branch creation for PR workflows

### 🎯 **Target Users**

- Developers working with both regular code files and AI-generated content
- Users who prefer GUI over command line for file operations
- Teams needing to commit specific files (including generated ones)
- Educational environments teaching Git workflows with different file types

### 📊 **File Type Support Matrix**

| File Type     | Context Menu | Git Commands            | Special Features     |
| ------------- | ------------ | ----------------------- | -------------------- |
| Regular Files | ✅           | Direct git commands     | File handle support  |
| Memory Files  | ✅           | Save + git workflow     | AI-generated content |
| GitHub Files  | ✅           | Download + git workflow | Remote file support  |

This comprehensive implementation provides Git commit functionality for all file types in the File Explorer, making it a truly universal file management solution with Git integration.
