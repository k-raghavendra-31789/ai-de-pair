import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState, ACTION_TYPES } from '../contexts/AppStateContext';
import CustomScrollbar from './CustomScrollbar';
import Tooltip from './Tooltip';
import { 
  FaGithub, 
  FaDesktop,
  FaLaptop,
  FaCloud, 
  FaFolder, 
  FaFolderOpen,
  FaFile,
  FaFileCode,
  FaFileCsv,
  FaFileExcel,
  FaFilePdf,
  FaFileImage,
  FaFileArchive,
  FaFileAlt,
  FaDatabase,
  FaHtml5,
  FaCss3Alt,
  FaMarkdown
} from 'react-icons/fa';
import { 
  SiJavascript, 
  SiTypescript, 
  SiPython, 
  SiJson 
} from 'react-icons/si';

// Global file handle registry to work around drag and drop limitations
window.fileHandleRegistry = window.fileHandleRegistry || new Map();

const FileExplorer = forwardRef(({ selectedFile, setSelectedFile, width, onFileRenamed, onFileDeleted, onFilesUpdate }, ref) => {
  const { colors } = useTheme();
  const { state, actions } = useAppState();
  
  // Get folder state from Context
  const { openFolders, expandedFolders } = state;
  const { setOpenFolders, setExpandedFolders, addFolder, removeFolder, reconnectFolder } = actions;
  
  // Local UI state (non-persistent)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showCreateFileDialog, setShowCreateFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedFolderForNewFile, setSelectedFolderForNewFile] = useState(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingFile, setRenamingFile] = useState(null);
  const [newName, setNewName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, item: null });
  
  // GitHub integration state
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [gitHubRepoUrl, setGitHubRepoUrl] = useState('');
  const [gitHubToken, setGitHubToken] = useState('');
  const [gitHubBranch, setGitHubBranch] = useState('main');
  const [gitHubFilePath, setGitHubFilePath] = useState('');
  const [fetchMode, setFetchMode] = useState('repository'); // 'repository' or 'single-file'
  const [gitHubRepos, setGitHubRepos] = useState([]);
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(false);
  
  // Cloud storage integration state
  const [cloudConnections, setCloudConnections] = useState([]);
  const [showCloudDialog, setShowCloudDialog] = useState(false);
  const [showCloudConnectDialog, setShowCloudConnectDialog] = useState(false);
  const [selectedCloudProvider, setSelectedCloudProvider] = useState('onedrive'); // 'onedrive', 'sharepoint', 'googledrive'
  const [activeCloudProvider, setActiveCloudProvider] = useState('onedrive');
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [cloudAuthTokens, setCloudAuthTokens] = useState({});
  const [cloudConnected, setCloudConnected] = useState(false);
  const [cloudFiles, setCloudFiles] = useState([]);
  
  const [activeTab, setActiveTab] = useState('local'); // 'local', 'github', or 'cloud'

  // Helper function to restore file handles for persisted folders
  const restoreFileHandles = useCallback(async () => {
    // This function will be called on component mount to help users reconnect
    // folders that were persisted but lost their file handles
    if (openFolders.length > 0) {
  // console.log('Current openFolders:', openFolders);
      const foldersWithoutHandles = openFolders.filter(folder => !folder.handle);
      if (foldersWithoutHandles.length > 0) {
  // console.log(`Found ${foldersWithoutHandles.length} folders without file handles. These will need to be reconnected.`);
        // You could show a notification here asking users to reconnect folders
      }
    }
  }, [openFolders]);

  // Effect to restore handles on mount
  useEffect(() => {
    restoreFileHandles();
  }, [restoreFileHandles]);

  // Refs to access current state values in event handlers
  const stateRefs = useRef({
    showCreateFileDialog: false,
    showRenameDialog: false,
    showDeleteDialog: false,
    showGitHubDialog: false,
    showCloudDialog: false,
    showCloudConnectDialog: false,
    openFolders: [],
    isLoadingFiles: false
  });

  // Update refs when state changes
  useEffect(() => {
    stateRefs.current = {
      showCreateFileDialog,
      showRenameDialog,
      showDeleteDialog,
      showGitHubDialog,
      showCloudDialog,
      showCloudConnectDialog,
      openFolders,
      isLoadingFiles
    };
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Close context menu and dialogs on Escape
      if (e.key === 'Escape') {
        setContextMenu({ show: false, x: 0, y: 0, item: null });
        if (stateRefs.current.showCreateFileDialog) {
          setShowCreateFileDialog(false);
          setNewFileName('');
          setSelectedFolderForNewFile(null);
        }
        if (stateRefs.current.showRenameDialog) {
          setShowRenameDialog(false);
          setNewName('');
          setRenamingFile(null);
        }
        if (stateRefs.current.showDeleteDialog) {
          setShowDeleteDialog(false);
          setDeletingFile(null);
        }
        if (stateRefs.current.showGitHubDialog) {
          setShowGitHubDialog(false);
          setGitHubRepoUrl('');
          setGitHubToken('');
          setGitHubFilePath('');
          setGitHubBranch('main');
          setFetchMode('repository');
        }
        if (stateRefs.current.showCloudDialog) {
          setShowCloudDialog(false);
          setSelectedCloudProvider('onedrive');
        }
        if (stateRefs.current.showCloudConnectDialog) {
          setShowCloudConnectDialog(false);
        }
      }
      
      // Refresh workspace on F5 or Ctrl+R
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        if (stateRefs.current.openFolders.length > 0 && !stateRefs.current.isLoadingFiles) {
          refreshWorkspace();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array since we're just setting up event listeners

  // Cloud storage integration functions
  const cloudProviders = [
    {
      id: 'onedrive',
      name: 'OneDrive',
      icon: '☁️',
      color: 'blue',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      scopes: 'https://graph.microsoft.com/Files.Read offline_access',
      clientId: 'your-onedrive-client-id' // Replace with your app registration
    },
    {
      id: 'sharepoint',
      name: 'SharePoint',
      icon: '🏢',
      color: 'purple',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      scopes: 'https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.Read offline_access',
      clientId: 'your-sharepoint-client-id' // Replace with your app registration
    },
    {
      id: 'googledrive',
      name: 'Google Drive',
      icon: '🔗',
      color: 'green',
      authUrl: 'https://accounts.google.com/oauth/authorize',
      scopes: 'https://www.googleapis.com/auth/drive.readonly',
      clientId: 'your-googledrive-client-id' // Replace with your Google app client ID
    }
  ];

  const authenticateCloudProvider = async (provider) => {
    try {
      setIsLoadingCloud(true);
      const config = cloudProviders.find(p => p.id === provider);
      
      if (!config) {
        throw new Error(`Unknown cloud provider: ${provider}`);
      }
      
      // For demo purposes, we'll simulate authentication
      // In production, you'd implement proper OAuth flows
      
      if (provider === 'onedrive' || provider === 'sharepoint') {
        // Microsoft Graph API authentication simulation
        const mockAuth = await simulateMicrosoftAuth(provider);
        if (mockAuth.success) {
          setCloudAuthTokens(prev => ({
            ...prev,
            [provider]: mockAuth.token
          }));
          await loadCloudFiles(provider, mockAuth.token);
        }
      } else if (provider === 'googledrive') {
        // Google Drive API authentication simulation
        const mockAuth = await simulateGoogleAuth();
        if (mockAuth.success) {
          setCloudAuthTokens(prev => ({
            ...prev,
            [provider]: mockAuth.token
          }));
          await loadGoogleDriveFiles(mockAuth.token);
        }
      }
      
      setShowCloudDialog(false);
    } catch (error) {
      console.error(`Error authenticating with ${provider}:`, error);
      const providerConfig = cloudProviders.find(p => p.id === provider);
      alert(`Failed to connect to ${providerConfig?.name || provider}: ${error.message}`);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // Connect to cloud provider function
  const connectToCloudProvider = async (providerId) => {
    try {
      await authenticateCloudProvider(providerId);
      setActiveCloudProvider(providerId);
      setCloudConnected(true);
      setShowCloudConnectDialog(false);
    } catch (error) {
      console.error('Error connecting to cloud provider:', error);
    }
  };

  // Simulate Microsoft authentication (OneDrive/SharePoint)
  const simulateMicrosoftAuth = async (provider) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          token: `mock-${provider}-token-${Date.now()}`,
          provider: provider
        });
      }, 1500);
    });
  };

  // Simulate Google authentication
  const simulateGoogleAuth = async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          token: `mock-google-token-${Date.now()}`
        });
      }, 1500);
    });
  };

  // Load OneDrive files
  const loadOneDriveFiles = async (token) => {
    const mockFiles = [
      {
        name: 'OneDrive Files',
        type: 'folder',
        isCloud: true,
        provider: 'onedrive',
        id: `onedrive-root-${Date.now()}`,
        children: [
          {
            name: 'Documents',
            type: 'folder',
            isCloud: true,
            provider: 'onedrive',
            path: '/Documents',
            id: `onedrive-docs-${Date.now()}`,
            children: [
              {
                name: 'sales_report.xlsx',
                type: 'file',
                isCloud: true,
                provider: 'onedrive',
                path: '/Documents/sales_report.xlsx',
                size: 524288,
                downloadUrl: 'https://example.com/mock-download',
                id: `onedrive-file-1-${Date.now()}`
              },
              {
                name: 'project_data.csv',
                type: 'file',
                isCloud: true,
                provider: 'onedrive',
                path: '/Documents/project_data.csv',
                size: 102400,
                downloadUrl: 'https://example.com/mock-download',
                id: `onedrive-file-2-${Date.now()}`
              }
            ],
            isLoaded: true
          },
          {
            name: 'SQL Scripts',
            type: 'folder',
            isCloud: true,
            provider: 'onedrive',
            path: '/SQL Scripts',
            id: `onedrive-sql-${Date.now()}`,
            children: [
              {
                name: 'query_builder.sql',
                type: 'file',
                isCloud: true,
                provider: 'onedrive',
                path: '/SQL Scripts/query_builder.sql',
                size: 8192,
                downloadUrl: 'https://example.com/mock-download',
                id: `onedrive-file-3-${Date.now()}`
              }
            ],
            isLoaded: true
          }
        ],
        isLoaded: true
      }
    ];

    setCloudConnections(prev => [...prev.filter(c => c.provider !== 'onedrive'), ...mockFiles]);
  };

  // Load SharePoint files
  const loadSharePointFiles = async (token) => {
    const mockFiles = [
      {
        name: 'SharePoint Site',
        type: 'folder',
        isCloud: true,
        provider: 'sharepoint',
        id: `sharepoint-root-${Date.now()}`,
        children: [
          {
            name: 'Shared Documents',
            type: 'folder',
            isCloud: true,
            provider: 'sharepoint',
            path: '/Shared Documents',
            id: `sharepoint-shared-${Date.now()}`,
            children: [
              {
                name: 'mapping_template.xlsx',
                type: 'file',
                isCloud: true,
                provider: 'sharepoint',
                path: '/Shared Documents/mapping_template.xlsx',
                size: 1048576,
                downloadUrl: 'https://example.com/mock-download',
                id: `sharepoint-file-1-${Date.now()}`
              },
              {
                name: 'database_schema.sql',
                type: 'file',
                isCloud: true,
                provider: 'sharepoint',
                path: '/Shared Documents/database_schema.sql',
                size: 16384,
                downloadUrl: 'https://example.com/mock-download',
                id: `sharepoint-file-2-${Date.now()}`
              }
            ],
            isLoaded: true
          }
        ],
        isLoaded: true
      }
    ];

    setCloudConnections(prev => [...prev.filter(c => c.provider !== 'sharepoint'), ...mockFiles]);
  };

  // Load Google Drive files
  const loadGoogleDriveFiles = async (token) => {
    const mockFiles = [
      {
        name: 'Google Drive',
        type: 'folder',
        isCloud: true,
        provider: 'googledrive',
        id: `googledrive-root-${Date.now()}`,
        children: [
          {
            name: 'Data Analysis',
            type: 'folder',
            isCloud: true,
            provider: 'googledrive',
            path: '/Data Analysis',
            id: `googledrive-analysis-${Date.now()}`,
            children: [
              {
                name: 'customer_data.csv',
                type: 'file',
                isCloud: true,
                provider: 'googledrive',
                path: '/Data Analysis/customer_data.csv',
                size: 2097152,
                downloadUrl: 'https://example.com/mock-download',
                id: `googledrive-file-1-${Date.now()}`
              },
              {
                name: 'python_analysis.py',
                type: 'file',
                isCloud: true,
                provider: 'googledrive',
                path: '/Data Analysis/python_analysis.py',
                size: 4096,
                downloadUrl: 'https://example.com/mock-download',
                id: `googledrive-file-2-${Date.now()}`
              }
            ],
            isLoaded: true
          }
        ],
        isLoaded: true
      }
    ];

    setCloudConnections(prev => [...prev.filter(c => c.provider !== 'googledrive'), ...mockFiles]);
  };

  // Main cloud files loader
  const loadCloudFiles = async (provider, token) => {
    switch (provider) {
      case 'onedrive':
        await loadOneDriveFiles(token);
        break;
      case 'sharepoint':
        await loadSharePointFiles(token);
        break;
      case 'googledrive':
        await loadGoogleDriveFiles(token);
        break;
    }
  };

  // Download cloud file
  const downloadCloudFile = async (file) => {
    try {
      // In a real implementation, you'd use the actual cloud provider APIs
      // For now, we'll simulate file content based on file type
      
      const mockContent = generateMockFileContent(file);
      return mockContent;
    } catch (error) {
      console.error('Error downloading cloud file:', error);
      throw error;
    }
  };

  // Generate mock content for demonstration
  const generateMockFileContent = (file) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const providerConfig = cloudProviders.find(p => p.id === file.provider);
    const providerName = providerConfig?.name || file.provider;
    
    switch (extension) {
      case 'sql':
        return `-- ${file.name} from ${providerName}\n-- Path: ${file.path}\n\nSELECT * FROM example_table\nWHERE date >= '2024-01-01'\nORDER BY id DESC;`;
      
      case 'py':
        return `# ${file.name} from ${providerName}\n# Path: ${file.path}\n\nimport pandas as pd\nimport numpy as np\n\n# Load data\ndf = pd.read_csv('data.csv')\nprint(df.head())`;
      
      case 'csv':
        return `Name,Email,Department,Salary\nJohn Doe,john@example.com,Engineering,75000\nJane Smith,jane@example.com,Marketing,65000\nBob Johnson,bob@example.com,Sales,70000`;
      
      case 'json':
        return JSON.stringify({
          "source": file.provider,
          "path": file.path,
          "data": [
            {"id": 1, "name": "Sample Record 1"},
            {"id": 2, "name": "Sample Record 2"}
          ]
        }, null, 2);
      
      case 'xlsx':
      case 'xls':
        // For Excel files, we'd need to return binary data
        // For demo, return a placeholder that indicates it's an Excel file
        return new ArrayBuffer(0); // Empty ArrayBuffer for demo
      
      default:
        return `File: ${file.name}\nProvider: ${providerName}\nPath: ${file.path}\n\nThis is mock content for demonstration purposes.`;
    }
  };
  const parseGitHubUrl = (url) => {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(regex);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '')
      };
    }
    return null;
  };

  const fetchSingleGitHubFile = async () => {
    if (!gitHubRepoUrl.trim()) {
      alert('Please enter a GitHub repository URL');
      return;
    }

    if (!gitHubFilePath.trim()) {
      alert('Please enter a file path');
      return;
    }

    const repoInfo = parseGitHubUrl(gitHubRepoUrl);
    if (!repoInfo) {
      alert('Invalid GitHub repository URL. Please use format: https://github.com/owner/repo');
      return;
    }

    try {
      setIsLoadingGitHub(true);
      
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
      };
      
      if (gitHubToken.trim()) {
        headers['Authorization'] = `token ${gitHubToken}`;
      }

      // Fetch the specific file from the specified branch
      const fileResponse = await fetch(
        `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${gitHubFilePath}?ref=${gitHubBranch}`,
        { headers }
      );

      if (!fileResponse.ok) {
        if (fileResponse.status === 404) {
          throw new Error(`File not found: ${gitHubFilePath} in branch '${gitHubBranch}'`);
        }
        throw new Error(`GitHub API error: ${fileResponse.status} ${fileResponse.statusText}`);
      }

      const fileData = await fileResponse.json();

      if (fileData.type !== 'file') {
        throw new Error(`Path '${gitHubFilePath}' is not a file`);
      }

      // Create a single file item
      const fileName = gitHubFilePath.split('/').pop();
      const gitHubFile = {
        name: `${repoInfo.owner}/${repoInfo.repo}/${gitHubBranch}/${fileName}`,
        type: 'file',
        isGitHub: true,
        repoInfo: repoInfo,
        branch: gitHubBranch,
        path: gitHubFilePath,
        downloadUrl: fileData.download_url,
        sha: fileData.sha,
        size: fileData.size,
        content: fileData.content, // Base64 encoded content
        encoding: fileData.encoding,
        id: `github-single-${fileData.sha}-${Date.now()}`
      };

      // Add to GitHub repos as a single file
      setGitHubRepos(prev => {
        const existing = prev.find(item => 
          item.repoInfo?.owner === repoInfo.owner && 
          item.repoInfo?.repo === repoInfo.repo &&
          item.path === gitHubFilePath &&
          item.branch === gitHubBranch
        );
        if (existing) {
          alert('This file is already open');
          return prev;
        }
        return [...prev, gitHubFile];
      });

      // Reset form
      setShowGitHubDialog(false);
      setGitHubRepoUrl('');
      setGitHubFilePath('');
      setGitHubBranch('main');
      
    } catch (error) {
      console.error('Error fetching GitHub file:', error);
      alert(`Error fetching file: ${error.message}`);
    } finally {
      setIsLoadingGitHub(false);
    }
  };

  const fetchGitHubRepo = async () => {
    if (!gitHubRepoUrl.trim()) {
      alert('Please enter a GitHub repository URL');
      return;
    }

    const repoInfo = parseGitHubUrl(gitHubRepoUrl);
    if (!repoInfo) {
      alert('Invalid GitHub repository URL. Please use format: https://github.com/owner/repo');
      return;
    }

    try {
      setIsLoadingGitHub(true);
      
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
      };
      
      if (gitHubToken.trim()) {
        headers['Authorization'] = `token ${gitHubToken}`;
      }

      // Fetch repository info
      const repoResponse = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`, {
        headers
      });

      if (!repoResponse.ok) {
        throw new Error(`GitHub API error: ${repoResponse.status} ${repoResponse.statusText}`);
      }

      const repoData = await repoResponse.json();

      // Fetch repository contents
      const contentsResponse = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents`, {
        headers
      });

      if (!contentsResponse.ok) {
        throw new Error(`Failed to fetch repository contents: ${contentsResponse.status}`);
      }

      const contents = await contentsResponse.json();

      // Build GitHub folder structure
      const gitHubFolder = {
        name: `${repoInfo.owner}/${repoInfo.repo}`,
        type: 'folder',
        isGitHub: true,
        repoInfo: repoInfo,
        description: repoData.description,
        defaultBranch: repoData.default_branch,
        children: await buildGitHubFolderStructure(contents, repoInfo, '', headers),
        id: `github-${repoInfo.owner}-${repoInfo.repo}-${Date.now()}`
      };

      // Add to open folders
      setGitHubRepos(prev => {
        const existing = prev.find(repo => 
          repo.repoInfo.owner === repoInfo.owner && 
          repo.repoInfo.repo === repoInfo.repo
        );
        if (existing) {
          alert('This repository is already open');
          return prev;
        }
        return [...prev, gitHubFolder];
      });

      // Auto-expand the GitHub repo
      const newExpandedFolders = new Set([...expandedFolders, gitHubFolder.id]);
      setExpandedFolders(newExpandedFolders);

      // Reset form
      setShowGitHubDialog(false);
      setGitHubRepoUrl('');
      
    } catch (error) {
      console.error('Error fetching GitHub repository:', error);
      alert(`Error fetching repository: ${error.message}`);
    } finally {
      setIsLoadingGitHub(false);
    }
  };

  const buildGitHubFolderStructure = async (contents, repoInfo, path = '', headers = {}) => {
    const children = [];
    
    for (const item of contents) {
      if (item.type === 'file') {
        // Filter for supported file types
        const supportedExtensions = ['csv', 'sql', 'py', 'xlsx', 'xls', 'json', 'txt', 'js', 'ts', 'html', 'css', 'md', 'yml', 'yaml'];
        const extension = item.name.split('.').pop()?.toLowerCase();
        
        if (supportedExtensions.includes(extension)) {
          children.push({
            name: item.name,
            type: 'file',
            isGitHub: true,
            repoInfo: repoInfo,
            path: item.path,
            downloadUrl: item.download_url,
            sha: item.sha,
            size: item.size,
            id: `github-file-${item.sha}-${Date.now()}`
          });
        }
      } else if (item.type === 'dir') {
        children.push({
          name: item.name,
          type: 'folder',
          isGitHub: true,
          repoInfo: repoInfo,
          path: item.path,
          children: [],
          id: `github-folder-${item.sha}-${Date.now()}`,
          isLoaded: false
        });
      }
    }
    
    return children;
  };

  const loadGitHubFolderChildren = async (folderId, folderPath, repoInfo) => {
    try {
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
      };
      
      if (gitHubToken.trim()) {
        headers['Authorization'] = `token ${gitHubToken}`;
      }

      const response = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${folderPath}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch folder contents: ${response.status}`);
      }

      const contents = await response.json();
      const children = await buildGitHubFolderStructure(contents, repoInfo, folderPath, headers);

      // Update the folder structure
      setGitHubRepos(prevRepos => 
        updateGitHubFolderInTree(prevRepos, folderId, { children, isLoaded: true })
      );
    } catch (error) {
      console.error('Error loading GitHub folder children:', error);
      alert(`Error loading folder: ${error.message}`);
    }
  };

  const updateGitHubFolderInTree = (repos, targetId, updates) => {
    return repos.map(repo => {
      if (repo.id === targetId) {
        return { ...repo, ...updates };
      }
      if (repo.children && repo.children.length > 0) {
        return {
          ...repo,
          children: updateGitHubFolderInTree(repo.children, targetId, updates)
        };
      }
      return repo;
    });
  };

  // Load cloud folder children (placeholder for future implementation)
  const loadCloudFolderChildren = async (folderId, folderPath, provider) => {
    try {
      // In a real implementation, this would call the respective cloud provider APIs
      // For now, most folders are already loaded with mock data
  // console.log(`Loading cloud folder children for ${provider}: ${folderPath}`);
    } catch (error) {
      console.error('Error loading cloud folder children:', error);
      alert(`Error loading folder: ${error.message}`);
    }
  };

  const downloadGitHubFile = async (file) => {
    try {
      // For single files fetched directly, use the base64 content if available
      if (file.content && file.encoding === 'base64') {
        const content = atob(file.content);
        return content;
      }

      // For repository files, use the download URL
      if (!file.downloadUrl) {
        throw new Error('No download URL available for this file');
      }

      const response = await fetch(file.downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }

      let content;
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension)) {
        // For Excel files, get as ArrayBuffer
        content = await response.arrayBuffer();
      } else {
        // For text files, get as text
        content = await response.text();
      }

      return content;
    } catch (error) {
      console.error('Error downloading GitHub file:', error);
      throw error;
    }
  };
  // Function to reconnect a folder that lost its handle
  const handleReconnectFolder = async (folderId) => {
    try {
      setIsLoadingFiles(true);
      
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker();
        
        // Build new folder structure
        const folderStructure = await buildFolderStructure(dirHandle);
        
        // Update the existing folder with new handle and structure using Context action
        reconnectFolder(folderId, folderStructure);
        
      } else {
        alert('Your browser does not support the File System Access API.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error reconnecting folder:', error);
        alert('Failed to reconnect folder. Please try again.');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const addLocalFolder = async () => {
    try {
      setIsLoadingFiles(true);
      
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker();
        
        // Check if folder already exists
        const existingFolder = openFolders.find(folder => folder.name === dirHandle.name);
        if (existingFolder) {
          alert('This folder is already open in the workspace.');
          return;
        }
        
        // Build the folder structure
        const folderStructure = await buildFolderStructure(dirHandle);
        
        // Add to open folders using Context action
        addFolder(folderStructure);
        
        // Auto-expand the root folder
        const newExpandedFolders = new Set([...expandedFolders, folderStructure.id]);
        setExpandedFolders(newExpandedFolders);
        
      } else {
        alert('Your browser does not support the File System Access API. Please use a modern browser like Chrome or Edge.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting folder:', error);
        alert('Error accessing folder. Please try again.');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Refresh all currently open folders
  const refreshWorkspace = async () => {
    if (openFolders.length === 0) {
      return;
    }

    try {
      setIsLoadingFiles(true);
      
      // Rebuild each open folder structure
      const refreshedFolders = [];
      for (const folder of openFolders) {
        try {
          const refreshedFolder = await buildFolderStructure(folder.handle);
          // Preserve the expanded state
          refreshedFolder.id = folder.id;
          refreshedFolders.push(refreshedFolder);
        } catch (error) {
          console.error(`Error refreshing folder ${folder.name}:`, error);
          // Keep the old folder if refresh fails
          refreshedFolders.push(folder);
        }
      }
      
      // Use Context action instead of direct setter
      setOpenFolders(refreshedFolders);
      
      // Refresh any expanded folders
      for (const folderId of expandedFolders) {
        const folder = refreshedFolders.find(f => f.id === folderId);
        if (folder && folder.handle) {
          await loadFolderChildren(folderId, folder.handle);
        }
      }
      
    } catch (error) {
      console.error('Error refreshing workspace:', error);
      alert('Error refreshing workspace. Please try again.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Create a new file in the selected folder
  const createFile = async () => {
    if (!newFileName.trim()) {
      alert('Please enter a file name.');
      return;
    }

    if (!selectedFolderForNewFile) {
      alert('Please select a folder first.');
      return;
    }

    try {
      const fileName = newFileName.includes('.') ? newFileName : `${newFileName}.txt`;
      
      // Create a new file in the selected folder
      const fileHandle = await selectedFolderForNewFile.handle.getFileHandle(fileName, { create: true });
      
      // Create a writable stream
      const writable = await fileHandle.createWritable();
      
      // Write initial content (empty for new files)
      await writable.write('');
      await writable.close();

      // Refresh the folder structure to show the new file
      const folderId = selectedFolderForNewFile.id;
      await loadFolderChildren(folderId, selectedFolderForNewFile.handle);

      // Reset form
      setNewFileName('');
      setShowCreateFileDialog(false);
      setSelectedFolderForNewFile(null);

    } catch (error) {
      console.error('Error creating file:', error);
      alert('Error creating file. Please check folder permissions and try again.');
    }
  };

  // Handle folder selection for file creation
  const selectFolderForNewFile = (folder) => {
    setSelectedFolderForNewFile(folder);
    setShowCreateFileDialog(true);
  };

  // Rename a file
  const renameFile = async () => {
    if (!newName.trim()) {
      alert('Please enter a new name.');
      return;
    }

    if (!renamingFile) {
      alert('No file selected for renaming.');
      return;
    }

    try {
      const oldHandle = renamingFile.handle;
      const parentFolder = findParentFolder(renamingFile.id);
      
      if (!parentFolder) {
        alert('Could not find parent folder.');
        return;
      }

      // Read the current file content
      const file = await oldHandle.getFile();
      const content = await file.text();

      // Create a new file with the new name
      const newFileName = newName.includes('.') ? newName : `${newName}.${renamingFile.name.split('.').pop()}`;
      const newHandle = await parentFolder.handle.getFileHandle(newFileName, { create: true });
      
      // Write the content to the new file
      const writable = await newHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Delete the old file
      await parentFolder.handle.removeEntry(renamingFile.name);

      // Notify MainEditor about the file rename
      if (onFileRenamed) {
        onFileRenamed(renamingFile.name, newFileName, newHandle);
      }

      // Refresh the folder structure
      await loadFolderChildren(parentFolder.id, parentFolder.handle);

      // Reset form
      setNewName('');
      setShowRenameDialog(false);
      setRenamingFile(null);

    } catch (error) {
      console.error('Error renaming file:', error);
      alert('Error renaming file. Please check permissions and try again.');
    }
  };

  // Delete a file
  const deleteFile = async () => {
    if (!deletingFile) {
      alert('No file selected for deletion.');
      return;
    }

    try {
      const parentFolder = findParentFolder(deletingFile.id);
      
      if (!parentFolder) {
        alert('Could not find parent folder.');
        return;
      }

      // Remove the file
      await parentFolder.handle.removeEntry(deletingFile.name);

      // Notify MainEditor that file was deleted
      if (onFileDeleted) {
        onFileDeleted(deletingFile.name);
      }

      // Refresh the folder structure
      await loadFolderChildren(parentFolder.id, parentFolder.handle);

      // Reset form
      setShowDeleteDialog(false);
      setDeletingFile(null);

    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file. Please check permissions and try again.');
    }
  };

  // Find parent folder of a file/folder
  const findParentFolder = (itemId) => {
    for (const folder of openFolders) {
      const found = findParentInFolder(folder, itemId);
      if (found) return found;
    }
    return null;
  };

  // Recursively find parent folder
  const findParentInFolder = (folder, itemId) => {
    if (folder.children) {
      for (const child of folder.children) {
        if (child.id === itemId) {
          return folder;
        }
        if (child.type === 'folder' && child.children) {
          const found = findParentInFolder(child, itemId);
          if (found) return found;
        }
      }
    }
    return null;
  };

  // Handle file operations
  const handleRenameFile = (file) => {
    setRenamingFile(file);
    setNewName(file.name.split('.')[0]); // Set name without extension
    setShowRenameDialog(true);
  };

  const handleDeleteFile = (file) => {
    setDeletingFile(file);
    setShowDeleteDialog(true);
    setContextMenu({ show: false, x: 0, y: 0, item: null });
  };

  // Download GitHub file to local machine
  const downloadFileToLocal = async (file) => {
    try {
      let content = '';
      
      if (file.isGitHub && file.content) {
        // Decode base64 content for GitHub files
        if (file.encoding === 'base64') {
          content = atob(file.content);
        } else {
          content = file.content;
        }
      } else if (file.downloadUrl) {
        // Fetch content from download URL
        const response = await fetch(file.downloadUrl);
        content = await response.text();
      } else {
        throw new Error('No content available for download');
      }
      
      // Extract just the filename without path prefixes
      const cleanFileName = file.name.includes('/') ? file.name.split('/').pop() : file.name;
      
      // Determine file type from extension
      const extension = cleanFileName.split('.').pop()?.toLowerCase();
      let mimeType = 'text/plain';
      
      // Set appropriate MIME type based on file extension
      switch (extension) {
        case 'js':
        case 'jsx':
          mimeType = 'text/javascript';
          break;
        case 'ts':
        case 'tsx':
          mimeType = 'text/typescript';
          break;
        case 'json':
          mimeType = 'application/json';
          break;
        case 'html':
          mimeType = 'text/html';
          break;
        case 'css':
          mimeType = 'text/css';
          break;
        case 'md':
          mimeType = 'text/markdown';
          break;
        case 'xml':
          mimeType = 'application/xml';
          break;
        case 'sql':
          mimeType = 'application/sql';
          break;
        case 'py':
          mimeType = 'text/x-python';
          break;
        default:
          mimeType = 'text/plain';
      }
      
      // Create a blob from the content
      const blob = new Blob([content], { type: mimeType });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = cleanFileName;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
  // console.log(`Successfully downloaded: ${cleanFileName}`);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      alert(`Failed to download file: ${error.message}`);
    }
  };

  // Handle context menu
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      item: item
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, item: null });
  };

  // Build folder structure with files and immediate subdirectories
  const buildFolderStructure = async (dirHandle) => {
    const folder = {
      name: dirHandle.name,
      type: 'folder',
      handle: dirHandle,
      children: [],
      id: `${dirHandle.name}-${Date.now()}`
    };

    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          // Filter for supported file types
          const supportedExtensions = ['csv', 'sql', 'py', 'xlsx', 'xls', 'json', 'txt', 'js', 'ts', 'html', 'css', 'md'];
          const extension = entry.name.split('.').pop().toLowerCase();
          
          if (supportedExtensions.includes(extension)) {
            folder.children.push({
              name: entry.name,
              type: 'file',
              handle: entry,
              id: `${entry.name}-${Date.now()}-${Math.random()}`
            });
          }
        } else if (entry.kind === 'directory') {
          // Add subdirectories
          folder.children.push({
            name: entry.name,
            type: 'folder',
            handle: entry,
            children: [],
            id: `${entry.name}-${Date.now()}-${Math.random()}`,
            isLoaded: false
          });
        }
      }
    } catch (error) {
      console.error('Error reading directory contents:', error);
    }

    return folder;
  };

  // Load children for a subfolder when expanded
  const loadFolderChildren = async (folderId, folderHandle) => {
    try {
      const children = [];
      
      for await (const entry of folderHandle.values()) {
        if (entry.kind === 'file') {
          const supportedExtensions = ['csv', 'sql', 'py', 'xlsx', 'xls', 'json', 'txt', 'js', 'ts', 'html', 'css', 'md'];
          const extension = entry.name.split('.').pop().toLowerCase();
          
          if (supportedExtensions.includes(extension)) {
            children.push({
              name: entry.name,
              type: 'file',
              handle: entry,
              id: `${entry.name}-${Date.now()}-${Math.random()}`
            });
          }
        } else if (entry.kind === 'directory') {
          children.push({
            name: entry.name,
            type: 'folder',
            handle: entry,
            children: [],
            id: `${entry.name}-${Date.now()}-${Math.random()}`,
            isLoaded: false
          });
        }
      }

      // Update the folder structure using Context action
      const updatedFolders = updateFolderInTree(openFolders, folderId, { children, isLoaded: true });
      setOpenFolders(updatedFolders);
    } catch (error) {
      console.error('Error loading folder children:', error);
    }
  };

  // Update a specific folder in the tree
  const updateFolderInTree = (folders, targetId, updates) => {
    return folders.map(folder => {
      if (folder.id === targetId) {
        return { ...folder, ...updates };
      }
      if (folder.children && folder.children.length > 0) {
        return {
          ...folder,
          children: updateFolderInTree(folder.children, targetId, updates)
        };
      }
      return folder;
    });
  };

  // Toggle folder expansion (enhanced for GitHub and Cloud)
  const toggleFolder = async (folderId, folderHandle, isLoaded, isGitHub = false, folderPath = '', repoInfo = null, isCloud = false, cloudProvider = '') => {
  // console.log('toggleFolder called:', { folderId, folderHandle: !!folderHandle, isLoaded, isGitHub, isCloud });
  // console.log('Current openFolders before toggle:', openFolders);
    
    const isExpanded = expandedFolders.has(folderId);
    
    if (!isExpanded) {
      // Expanding - check if folder has access
      if (!isGitHub && !isCloud && !folderHandle) {
        // This is a persisted folder without file handle - cannot expand
        console.warn('Cannot expand folder without file handle. User needs to reconnect first.');
        return;
      }
      
      // Expanding - load children if not already loaded
      if (!isLoaded) {
  // console.log('Loading children for folder:', folderId);
        if (isGitHub && repoInfo) {
          await loadGitHubFolderChildren(folderId, folderPath, repoInfo);
        } else if (isCloud && cloudProvider) {
          await loadCloudFolderChildren(folderId, folderPath, cloudProvider);
        } else if (folderHandle) {
          await loadFolderChildren(folderId, folderHandle);
        }
      }
      const newExpandedFolders = new Set([...expandedFolders, folderId]);
      setExpandedFolders(newExpandedFolders);
    } else {
      // Collapsing
      const newExpandedFolders = new Set(expandedFolders);
      newExpandedFolders.delete(folderId);
      setExpandedFolders(newExpandedFolders);
    }
    
  // console.log('Current openFolders after toggle:', openFolders);
  };

  // Handle file drag start (enhanced for GitHub and Cloud)
  const handleFileDragStart = async (e, file) => {
    e.stopPropagation();
    
    try {
      if (file.isGitHub) {
        // For GitHub files, download content and create a data URL
        try {
          const content = await downloadGitHubFile(file);
          
          const fileData = {
            name: file.name,
            isGitHubFile: true,
            content: content,
            repoInfo: file.repoInfo,
            path: file.path,
            downloadUrl: file.downloadUrl
          };
          
          e.dataTransfer.setData('text/plain', JSON.stringify(fileData));
        } catch (error) {
          console.error('Error downloading GitHub file for drag:', error);
          // Fallback to basic info
          e.dataTransfer.setData('text/plain', JSON.stringify({
            name: file.name,
            isGitHubFile: true,
            error: 'Failed to download content',
            downloadUrl: file.downloadUrl
          }));
        }
      } else if (file.isCloud) {
        // For cloud files, use mock content
        try {
          const content = await downloadCloudFile(file);
          
          const fileData = {
            name: file.name,
            isCloudFile: true,
            content: content,
            provider: file.provider,
            path: file.path,
            downloadUrl: file.downloadUrl
          };
          
          e.dataTransfer.setData('text/plain', JSON.stringify(fileData));
        } catch (error) {
          console.error('Error downloading cloud file for drag:', error);
          // Fallback to basic info
          e.dataTransfer.setData('text/plain', JSON.stringify({
            name: file.name,
            isCloudFile: true,
            provider: file.provider,
            error: 'Failed to download content'
          }));
        }
      } else if (file.handle) {
        // For local files, register the file handle and pass the ID
        const fileId = `${file.name}-${Date.now()}-${Math.random()}`;
        
        // Store the file handle in global registry
        window.fileHandleRegistry.set(fileId, file.handle);
        
        // Get the full path by traversing up the tree
        const getFullPath = (item, folders) => {
          const findParent = (targetId, items, currentPath = []) => {
            for (const folder of items) {
              if (folder.children && folder.children.some(child => child.id === targetId)) {
                return [...currentPath, folder.name];
              }
              if (folder.children) {
                const result = findParent(targetId, folder.children, [...currentPath, folder.name]);
                if (result) return result;
              }
            }
            return null;
          };
          
          const parentPath = findParent(item.id, folders) || [];
          return [...parentPath, item.name].join('/');
        };
        
        const fullPath = getFullPath(file, openFolders);
        
        const fileData = {
          name: file.name,
          isLocalFile: true,
          fileId: fileId,
          fullPath: fullPath
        };
        
        e.dataTransfer.setData('text/plain', JSON.stringify(fileData));
      } else {
        // Fallback for non-local files
        e.dataTransfer.setData('text/plain', file.name);
      }
      e.dataTransfer.effectAllowed = 'copy';
    } catch (error) {
      console.error('Error in drag start:', error);
      e.dataTransfer.setData('text/plain', file.name);
    }
  };

  // Get file/folder icon (enhanced for GitHub)
  const getFileIcon = (name, type, isGitHub = false, isExpanded = false) => {
    if (type === 'folder') {
      const FolderIcon = isExpanded ? FaFolderOpen : FaFolder;
      return <FolderIcon className={`${isGitHub ? 'text-blue-400' : 'text-yellow-500'}`} />;
    }
    
    const extension = name.split('.').pop().toLowerCase();
    const iconClass = isGitHub ? 'text-blue-400' : 'text-gray-300';
    
    switch (extension) {
      case 'csv': 
        return <FaFileCsv className="text-green-500" />;
      case 'xlsx': 
      case 'xls': 
      case 'xlsm': 
      case 'xlsb': 
        return <FaFileExcel className="text-green-600" />;
      case 'py': 
        return <SiPython className="text-yellow-400" />;
      case 'sql': 
        return <FaDatabase className="text-blue-500" />;
      case 'json': 
        return <SiJson className="text-yellow-300" />;
      case 'txt': 
      case 'log': 
        return <FaFileAlt className="text-gray-400" />;
      case 'js': 
      case 'jsx': 
        return <SiJavascript className="text-yellow-500" />;
      case 'ts': 
      case 'tsx': 
        return <SiTypescript className="text-blue-600" />;
      case 'html': 
      case 'htm': 
        return <FaHtml5 className="text-orange-500" />;
      case 'css': 
      case 'scss': 
      case 'sass': 
      case 'less': 
        return <FaCss3Alt className="text-blue-500" />;
      case 'md': 
      case 'markdown': 
        return <FaMarkdown className="text-gray-300" />;
      case 'yml': 
      case 'yaml': 
        return <FaFileCode className="text-purple-400" />;
      case 'pdf': 
        return <FaFilePdf className="text-red-500" />;
      case 'png': 
      case 'jpg': 
      case 'jpeg': 
      case 'gif': 
      case 'bmp': 
      case 'svg': 
      case 'webp': 
        return <FaFileImage className="text-pink-400" />;
      case 'zip': 
      case 'rar': 
      case '7z': 
      case 'tar': 
      case 'gz': 
        return <FaFileArchive className="text-orange-400" />;
      case 'xml': 
      case 'config': 
      case 'conf': 
        return <FaFileCode className="text-green-400" />;
      default: 
        return <FaFile className={iconClass} />;
    }
  };

  // Remove a folder from workspace (enhanced for GitHub)
  const removeFolderFromWorkspace = (folderId, isGitHub = false) => {
    if (isGitHub) {
      setGitHubRepos(prev => prev.filter(repo => repo.id !== folderId));
    } else {
      // Use Context action to remove folder
      removeFolder(folderId);
    }
    
    // Update expanded folders state
    const newExpandedFolders = new Set(expandedFolders);
    newExpandedFolders.delete(folderId);
    setExpandedFolders(newExpandedFolders);
  };

  // Helper function to get file extension and type info for tooltip
  const getFileTypeInfo = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const typeMap = {
      'sql': 'SQL Database Script',
      'js': 'JavaScript File',
      'jsx': 'React Component',
      'ts': 'TypeScript File',
      'tsx': 'TypeScript React Component',
      'py': 'Python Script',
      'html': 'HTML Document',
      'css': 'CSS Stylesheet',
      'json': 'JSON Data',
      'xml': 'XML Document',
      'md': 'Markdown Document',
      'txt': 'Text Document',
      'csv': 'CSV Data File',
      'xlsx': 'Excel Spreadsheet',
      'xls': 'Excel 97-2003 Workbook',
      'xlsm': 'Excel Macro-Enabled Workbook',
      'xlsb': 'Excel Binary Workbook',
      'pdf': 'PDF Document',
      'png': 'PNG Image',
      'jpg': 'JPEG Image',
      'gif': 'GIF Image',
      'svg': 'SVG Vector Image'
    };
    
    return typeMap[extension] || 'Unknown File Type';
  };

  // Render tree item recursively (enhanced for GitHub)
  const renderFileTreeItem = (item, depth = 0, isGitHub = false, isCloud = false) => {
    const isExpanded = expandedFolders.has(item.id);
    const paddingLeft = `${depth * 16 + 8}px`;

    if (item.type === 'folder') {
      return (
        <div key={item.id} className="group">
          <Tooltip content={
            item.isGitHub 
              ? `GitHub Repository: ${item.name}${item.description ? `\n${item.description}` : ''}`
              : `Folder: ${item.name}`
          }>
            <div
              onClick={() => {
                // Prevent expansion if folder has no handle (needs reconnection)
                if (!item.handle && !item.isGitHub && !item.isCloud) {
                  return; // Do nothing - user needs to reconnect first
                }
                toggleFolder(
                  item.id, 
                  item.handle, 
                  item.isLoaded, 
                  item.isGitHub,
                  item.path,
                  item.repoInfo
                );
              }}
              onContextMenu={(e) => handleContextMenu(e, item)}
              className={`flex items-center cursor-pointer hover:${colors.hover} p-1 rounded transition-colors text-sm ${!item.handle && !item.isGitHub ? 'opacity-60' : ''}`}
              style={{ paddingLeft }}
            >
              <span className={`mr-1 text-xs ${colors.textMuted} transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${!item.handle && !item.isGitHub && !item.isCloud ? 'opacity-30' : ''}`}>
                {!item.handle && !item.isGitHub && !item.isCloud ? (
                  // Show lock icon for folders that need reconnection
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 16 16" 
                    fill="currentColor"
                    className="inline-block"
                  >
                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                  </svg>
                ) : (
                  // Normal expand/collapse arrow
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 16 16" 
                    fill="currentColor"
                    className="inline-block"
                  >
                    <path d="M6 4l4 4-4 4V4z"/>
                  </svg>
                )}
              </span>
              <span className={`mr-2 ${colors.textMuted}`}>
                {getFileIcon(item.name, 'folder', item.isGitHub, isExpanded)}
              </span>
              <span className="truncate flex-1">{item.name}</span>
              {item.isGitHub && (
                <FaGithub className={`text-xs ${colors.textMuted} mr-1`} title="GitHub Repository" />
              )}
              {/* Show reconnect button for folders without handles */}
              {depth === 0 && !item.handle && !item.isGitHub && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReconnectFolder(item.id);
                  }}
                  className={`ml-1 text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded transition-colors`}
                  title="Reconnect folder - File access was lost"
                >
                  Reconnect
                </button>
              )}
              {depth === 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFolderFromWorkspace(item.id, item.isGitHub);
                  }}
                  className={`ml-1 text-xs ${colors.textMuted} hover:${colors.text} opacity-0 group-hover:opacity-100 transition-opacity px-1`}
                >
                  ×
                </button>
              )}
            </div>
          </Tooltip>
          
          {isExpanded && item.children && item.children.length > 0 && (
            <div>
              {item.children.map(child => (
                <React.Fragment key={child.id}>
                  {renderFileTreeItem(child, depth + 1, item.isGitHub || child.isGitHub, item.isCloud || child.isCloud)}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      // File item
      const fileSize = item.size ? ` (${(item.size / 1024).toFixed(1)}KB)` : '';
      const tooltipText = item.isGitHub 
        ? `${item.name}\n${getFileTypeInfo(item.name)}${fileSize}\nRepository: ${item.repoInfo?.owner}/${item.repoInfo?.repo}`
        : `${item.name}\n${getFileTypeInfo(item.name)}`;

      return (
        <div key={item.id} className="group">
          <Tooltip content={tooltipText}>
            <div
              draggable
              onDragStart={(e) => handleFileDragStart(e, item)}
              onContextMenu={(e) => handleContextMenu(e, item)}
              className={`flex items-center cursor-pointer p-1 rounded transition-colors text-sm hover:bg-opacity-20 hover:bg-gray-500`}
              style={{ paddingLeft }}
            >
              <span className={`mr-2 ${colors.textMuted}`}>
                {getFileIcon(item.name, 'file', item.isGitHub)}
              </span>
              <span className="truncate flex-1">{item.name}</span>
              {item.isGitHub && (
                <FaGithub className={`text-xs ${colors.textMuted} ml-1`} title="From GitHub" />
              )}
            </div>
          </Tooltip>
        </div>
      );
    }
  };

  // Function to recursively collect all files from the file tree
  const getAllFiles = () => {
    const allFiles = [];
    
    // Helper function to traverse file tree
    const traverseFiles = (items, source = 'local') => {
      items.forEach(item => {
        if (item.type === 'file') {
          allFiles.push({
            name: item.name,
            path: item.path || item.name,
            source: source,
            id: item.id,
            isGitHub: item.isGitHub || false,
            isCloud: item.isCloud || false,
            provider: item.provider || null,
            repoInfo: item.repoInfo || null,
            handle: item.handle || null
          });
        } else if (item.type === 'folder' && item.children) {
          traverseFiles(item.children, source);
        }
      });
    };
    
    // Collect from local files
    traverseFiles(openFolders, 'local');
    
    // Collect from GitHub repos
    traverseFiles(gitHubRepos, 'github');
    
    // Collect from cloud files
    traverseFiles(cloudFiles, 'cloud');
    
    return allFiles;
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    getAllFiles: getAllFiles
  }));

  // Notify parent when files change
  useEffect(() => {
    if (onFilesUpdate) {
      const files = getAllFiles();
      onFilesUpdate(files);
    }
  }, [openFolders, gitHubRepos, cloudFiles]); // Remove onFilesUpdate from dependencies

  return (
    <div 
      className={`${colors.secondary} ${colors.border} border-r flex-shrink-0 flex flex-col min-h-full`}
      style={{ width, minHeight: '800px' }}
    >
      <div className={`p-3 ${colors.border} border-b`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-sm font-medium ${colors.textSecondary} uppercase tracking-wide`}>
            Explorer
          </h2>
          <div className="flex items-center gap-2">
            <Tooltip content={isLoadingFiles ? "Refreshing..." : "Refresh workspace (F5)"}>
              <button
                onClick={refreshWorkspace}
                disabled={isLoadingFiles || (openFolders.length === 0 && gitHubRepos.length === 0)}
                className={`p-1 rounded text-xs ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${isLoadingFiles ? 'animate-spin' : ''}`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.451 5.609l-.579-.939-1.068.812-.076-.094c-.525-.668-1.308-1.066-2.295-1.235L9.343 4h1.511l-2.016-2.048L6.822 4h1.426l.083.151c1.12.188 2.01.651 2.627 1.382l.153.188 1.065-.812.575.939-2.222 1.732c-.949-1.135-2.362-1.8-4.048-1.8-2.757 0-5 2.243-5 5s2.243 5 5 5c2.636 0 4.775-2.043 4.967-4.605h-1.032C9.338 12.129 7.822 13.2 6.001 13.2c-2.208 0-4-1.792-4-4s1.792-4 4-4c1.517 0 2.85.85 3.53 2.1l-2.084 1.622z"/>
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex mt-2 border-b border-gray-600">
          <button
            onClick={() => setActiveTab('local')}
            className={`px-3 py-1 text-xs transition-colors flex items-center gap-1 ${
              activeTab === 'local' 
                ? `${colors.accent} border-b-2 border-blue-500` 
                : `${colors.textMuted} hover:${colors.text}`
            }`}
          >
            <FaFolder /> Local
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`px-3 py-1 text-xs transition-colors flex items-center gap-1 ${
              activeTab === 'github' 
                ? `${colors.accent} border-b-2 border-blue-500` 
                : `${colors.textMuted} hover:${colors.text}`
            }`}
          >
            <FaGithub /> GitHub
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`px-3 py-1 text-xs transition-colors flex items-center gap-1 ${
              activeTab === 'cloud' 
                ? `${colors.accent} border-b-2 border-blue-500` 
                : `${colors.textMuted} hover:${colors.text}`
            }`}
          >
            <FaCloud /> Cloud
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-3">
          {activeTab === 'local' ? (
            <button
              onClick={addLocalFolder}
              disabled={isLoadingFiles}
              className={`px-2 py-1 text-xs rounded ${colors.accent} hover:opacity-80 disabled:opacity-50 transition-opacity flex-1`}
            >
              {isLoadingFiles ? (openFolders.length > 0 ? 'Refreshing...' : 'Loading...') : 'Open Folder'}
            </button>
          ) : activeTab === 'github' ? (
            <button
              onClick={() => setShowGitHubDialog(true)}
              disabled={isLoadingGitHub}
              className={`px-2 py-1 text-xs rounded ${colors.accent} hover:opacity-80 disabled:opacity-50 transition-opacity flex-1`}
            >
              {isLoadingGitHub ? 'Loading...' : 'Add Repository/File'}
            </button>
          ) : (
            <button
              onClick={() => setShowCloudConnectDialog(true)}
              disabled={isLoadingCloud}
              className={`px-2 py-1 text-xs rounded ${colors.accent} hover:opacity-80 disabled:opacity-50 transition-opacity flex-1`}
            >
              {isLoadingCloud ? 'Connecting...' : (cloudConnected ? 'Connected' : 'Connect to Cloud')}
            </button>
          )}
        </div>
      </div>
      
      <CustomScrollbar 
        className="flex-1"
        showHorizontal={false}
        showVertical={true}
      >
        <div className="p-2">
          {activeTab === 'local' ? (
            // Local Files Tab
            openFolders.length === 0 ? (
              <div className={`text-xs ${colors.textMuted} text-center py-4`}>
                No folders opened yet.<br />
                Click "Open Folder" to add folders to your workspace.
              </div>
            ) : (
              <div className={`${colors.textSecondary} space-y-1`}>
                {Array.isArray(openFolders) ? openFolders.map(folder => (
                  <React.Fragment key={folder.id}>
                    {renderFileTreeItem(folder)}
                  </React.Fragment>
                )) : (
                  <div className="text-red-500 text-sm p-2">
                    Error: Folder data is corrupted. Please refresh and re-add folders.
                  </div>
                )}
              </div>
            )
          ) : activeTab === 'github' ? (
            // GitHub Tab
            gitHubRepos.length === 0 ? (
              <div className={`text-xs ${colors.textMuted} text-center py-4`}>
                No GitHub repositories or files added yet.<br />
                Click "Add Repository/File" to browse GitHub repos or fetch specific files.
                <div className="mt-3 text-xs">
                  <strong>Two Modes Available:</strong><br />
                  • Browse Repository: Explore full repository structure<br />
                  • Single File: Fetch specific file from a branch<br />
                  <br />
                  <strong>Supported URLs:</strong><br />
                  • https://github.com/owner/repo<br />
                  • github.com/owner/repo<br />
                  <br />
                  <strong>Optional:</strong> Add a personal access token for private repos and higher rate limits.
                </div>
              </div>
            ) : (
              <div className={`${colors.textSecondary} space-y-1`}>
                {gitHubRepos.map(repo => (
                  <React.Fragment key={repo.id}>
                    {renderFileTreeItem(repo, 0, true)}
                  </React.Fragment>
                ))}
              </div>
            )
          ) : (
            // Cloud Storage Tab
            !cloudConnected ? (
              <div className={`text-xs ${colors.textMuted} text-center py-4`}>
                No cloud storage connected yet.<br />
                Click "Connect to Cloud" to access your files.
                <div className="mt-3 text-xs">
                  <strong>Supported Providers:</strong><br />
                  • OneDrive<br />
                  • SharePoint<br />
                  • Google Drive<br />
                </div>
              </div>
            ) : (
              <div>
                {/* Cloud Provider Tabs */}
                <div className="flex border-b border-gray-600 mb-2">
                  {cloudProviders.map(provider => (
                    <button
                      key={provider.id}
                      onClick={() => setActiveCloudProvider(provider.id)}
                      className={`px-2 py-1 text-xs border-b-2 transition-colors ${
                        activeCloudProvider === provider.id
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {provider.icon} {provider.name}
                    </button>
                  ))}
                </div>

                {/* Cloud Files */}
                <div className={`${colors.textSecondary} space-y-1`}>
                  {cloudFiles
                    .filter(file => file.provider === activeCloudProvider)
                    .map(file => (
                      <React.Fragment key={file.id}>
                        {renderFileTreeItem(file, 0, false, true)}
                      </React.Fragment>
                    ))}
                </div>
              </div>
            )
          )}
        </div>
      </CustomScrollbar>

      {/* GitHub Repository Dialog */}
      {showGitHubDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.background} ${colors.border} border rounded-lg p-6 w-96 max-w-md`}>
            <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>
              Add GitHub Repository
            </h3>

            {/* Mode Selection */}
            <div className="mb-4">
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                Mode:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFetchMode('repository')}
                  className={`px-3 py-2 text-xs rounded transition-colors ${
                    fetchMode === 'repository' 
                      ? `${colors.accent} text-white` 
                      : `${colors.border} border hover:${colors.hover}`
                  }`}
                >
                  Browse Repository
                </button>
                <button
                  onClick={() => setFetchMode('single-file')}
                  className={`px-3 py-2 text-xs rounded transition-colors ${
                    fetchMode === 'single-file' 
                      ? `${colors.accent} text-white` 
                      : `${colors.border} border hover:${colors.hover}`
                  }`}
                >
                  Single File
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                Repository URL:
              </label>
              <input
                type="text"
                value={gitHubRepoUrl}
                onChange={(e) => setGitHubRepoUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchMode === 'single-file' ? fetchSingleGitHubFile() : fetchGitHubRepo();
                  } else if (e.key === 'Escape') {
                    setShowGitHubDialog(false);
                    setGitHubRepoUrl('');
                    setGitHubToken('');
                    setGitHubFilePath('');
                    setGitHubBranch('main');
                    setFetchMode('repository');
                  }
                }}
                placeholder="https://github.com/owner/repository"
                className={`w-full px-3 py-2 ${colors.background} ${colors.border} border rounded text-sm ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                autoFocus
              />
              <p className={`text-xs ${colors.textMuted} mt-1`}>
                Enter the full GitHub repository URL
              </p>
            </div>

            {/* Single File Mode Fields */}
            {fetchMode === 'single-file' && (
              <>
                <div className="mb-4">
                  <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                    Branch:
                  </label>
                  <input
                    type="text"
                    value={gitHubBranch}
                    onChange={(e) => setGitHubBranch(e.target.value)}
                    placeholder="main"
                    className={`w-full px-3 py-2 ${colors.background} ${colors.border} border rounded text-sm ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <p className={`text-xs ${colors.textMuted} mt-1`}>
                    Branch name (default: main)
                  </p>
                </div>
                
                <div className="mb-4">
                  <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                    File Path:
                  </label>
                  <input
                    type="text"
                    value={gitHubFilePath}
                    onChange={(e) => setGitHubFilePath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        fetchSingleGitHubFile();
                      }
                    }}
                    placeholder="src/components/Example.js"
                    className={`w-full px-3 py-2 ${colors.background} ${colors.border} border rounded text-sm ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <p className={`text-xs ${colors.textMuted} mt-1`}>
                    Path to the specific file you want to fetch
                  </p>
                </div>
              </>
            )}
            
            <div className="mb-4">
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                Personal Access Token (Optional):
              </label>
              <input
                type="password"
                value={gitHubToken}
                onChange={(e) => setGitHubToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchMode === 'single-file' ? fetchSingleGitHubFile() : fetchGitHubRepo();
                  }
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className={`w-full px-3 py-2 ${colors.background} ${colors.border} border rounded text-sm ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <p className={`text-xs ${colors.textMuted} mt-1`}>
                Required for private repos. Provides higher rate limits for public repos.
                <br />
                <a 
                  href="https://github.com/settings/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Create token →
                </a>
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowGitHubDialog(false);
                  setGitHubRepoUrl('');
                  setGitHubToken('');
                  setGitHubFilePath('');
                  setGitHubBranch('main');
                  setFetchMode('repository');
                }}
                className={`px-4 py-2 text-sm ${colors.textMuted} hover:${colors.text} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={fetchMode === 'single-file' ? fetchSingleGitHubFile : fetchGitHubRepo}
                disabled={!gitHubRepoUrl.trim() || (fetchMode === 'single-file' && !gitHubFilePath.trim()) || isLoadingGitHub}
                className={`px-4 py-2 text-sm ${colors.accent} hover:opacity-80 disabled:opacity-50 rounded transition-opacity`}
              >
                {isLoadingGitHub ? 'Loading...' : (fetchMode === 'single-file' ? 'Fetch File' : 'Add Repository')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create File Dialog */}
      {showCreateFileDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.background} ${colors.border} border rounded-lg p-6 w-80 max-w-md`}>
            <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>
              Create New File
            </h3>
            <div className="mb-4">
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                Folder: {selectedFolderForNewFile?.name}
              </label>
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                File Name:
              </label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createFile();
                  } else if (e.key === 'Escape') {
                    setShowCreateFileDialog(false);
                    setNewFileName('');
                    setSelectedFolderForNewFile(null);
                  }
                }}
                placeholder="Enter file name (e.g., script.py, data.csv)"
                className={`w-full px-3 py-2 ${colors.background} ${colors.border} border rounded text-sm ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                autoFocus
              />
              <p className={`text-xs ${colors.textMuted} mt-1`}>
                Tip: Include the file extension (e.g., .py, .js, .txt)
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowCreateFileDialog(false);
                  setNewFileName('');
                  setSelectedFolderForNewFile(null);
                }}
                className={`px-4 py-2 text-sm ${colors.textMuted} hover:${colors.text} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={createFile}
                disabled={!newFileName.trim()}
                className={`px-4 py-2 text-sm ${colors.accent} hover:opacity-80 disabled:opacity-50 rounded transition-opacity`}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Dialog */}
      {showRenameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.background} ${colors.border} border rounded-lg p-6 w-80 max-w-md`}>
            <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>
              Rename File
            </h3>
            <div className="mb-4">
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                Current name: {renamingFile?.name}
              </label>
              <label className={`block text-sm ${colors.textSecondary} mb-2`}>
                New name:
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameFile();
                  } else if (e.key === 'Escape') {
                    setShowRenameDialog(false);
                    setNewName('');
                    setRenamingFile(null);
                  }
                }}
                placeholder="Enter new file name"
                className={`w-full px-3 py-2 ${colors.background} ${colors.border} border rounded text-sm ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                autoFocus
              />
              <p className={`text-xs ${colors.textMuted} mt-1`}>
                Extension will be preserved if not specified
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowRenameDialog(false);
                  setNewName('');
                  setRenamingFile(null);
                }}
                className={`px-4 py-2 text-sm ${colors.textMuted} hover:${colors.text} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={renameFile}
                disabled={!newName.trim()}
                className={`px-4 py-2 text-sm ${colors.accent} hover:opacity-80 disabled:opacity-50 rounded transition-opacity`}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.background} ${colors.border} border rounded-lg p-6 w-80 max-w-md`}>
            <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>
              Delete File
            </h3>
            <div className="mb-4">
              <p className={`text-sm ${colors.textSecondary} mb-2`}>
                Are you sure you want to delete this file?
              </p>
              <p className={`text-sm font-medium ${colors.text}`}>
                {deletingFile?.name}
              </p>
              <p className={`text-xs ${colors.textMuted} mt-2`}>
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletingFile(null);
                }}
                className={`px-4 py-2 text-sm ${colors.textMuted} hover:${colors.text} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={deleteFile}
                className={`px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded transition-colors`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.show && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={closeContextMenu}
          />
          <div
            className={`fixed z-50 border rounded-md shadow-xl py-1 min-w-36`}
            style={{ 
              left: `${contextMenu.x}px`, 
              top: `${contextMenu.y}px`,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '13px',
              lineHeight: '1.4',
              backgroundColor: '#2d2d30',
              borderColor: '#3e3e42',
              color: '#cccccc'
            }}
          >
            {contextMenu.item?.type === 'file' ? (
              <>
                <button
                  onClick={() => {
                    handleRenameFile(contextMenu.item);
                    closeContextMenu();
                  }}
                  className={`w-full text-left px-3 py-1.5 transition-colors`}
                  style={{ 
                    fontWeight: '400',
                    letterSpacing: '0.01em',
                    color: '#cccccc',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#37373d'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  Rename
                </button>
                
                {/* Download option for GitHub files */}
                {contextMenu.item?.isGitHub && (
                  <button
                    onClick={() => {
                      downloadFileToLocal(contextMenu.item);
                      closeContextMenu();
                    }}
                    className={`w-full text-left px-3 py-1.5 transition-colors`}
                    style={{ 
                      fontWeight: '400',
                      letterSpacing: '0.01em',
                      color: '#cccccc',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#37373d'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    📥 Download
                  </button>
                )}
                <button
                  onClick={() => {
                    handleDeleteFile(contextMenu.item);
                    closeContextMenu();
                  }}
                  className={`w-full text-left px-3 py-1.5 transition-colors`}
                  style={{ 
                    fontWeight: '400',
                    letterSpacing: '0.01em',
                    color: '#cccccc',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#37373d'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  selectFolderForNewFile(contextMenu.item);
                  closeContextMenu();
                }}
                className={`w-full text-left px-3 py-1.5 transition-colors`}
                style={{ 
                  fontWeight: '400',
                  letterSpacing: '0.01em',
                  color: '#cccccc',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#37373d'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                New File
              </button>
            )}
          </div>
        </>
      )}

      {/* Cloud Connect Dialog */}
      {showCloudConnectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.background} ${colors.border} border rounded-lg p-6 w-96 max-w-md`}>
            <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>
              Connect to Cloud Storage
            </h3>
            <div className="mb-4">
              <p className={`text-sm ${colors.textSecondary} mb-4`}>
                Choose a cloud storage provider to connect:
              </p>
              <div className="space-y-3">
                {cloudProviders.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => connectToCloudProvider(provider.id)}
                    disabled={isLoadingCloud}
                    className={`w-full p-3 border rounded-lg text-left flex items-center gap-3 transition-colors ${
                      isLoadingCloud 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-gray-700 border-gray-600'
                    }`}
                  >
                    <span className="text-xl">{provider.icon}</span>
                    <div>
                      <div className={`font-medium ${colors.text}`}>{provider.name}</div>
                      <div className={`text-xs ${colors.textMuted}`}>
                        Access your {provider.name.toLowerCase()} files
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCloudConnectDialog(false)}
                disabled={isLoadingCloud}
                className={`px-4 py-2 text-sm ${colors.textMuted} hover:${colors.text} transition-colors disabled:opacity-50`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default FileExplorer;
