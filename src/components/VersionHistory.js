import React, { useState } from 'react';
import { useTheme } from './ThemeContext';

const VersionHistory = ({ 
  fileId, 
  fileName, 
  versions = [], 
  currentContent, 
  onRestoreVersion, 
  onClearHistory, 
  onClose 
}) => {
  const { colors } = useTheme();
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showDiff, setShowDiff] = useState(false);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatDescription = (description, generationId) => {
    if (description.includes('AI modification')) {
      return '🤖 ' + description;
    } else if (description.includes('Manual edit')) {
      return '✏️ ' + description;
    } else if (description.includes('restore')) {
      return '↩️ ' + description;
    }
    return description;
  };

  const getVersionAge = (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleRestore = (versionIndex) => {
    if (window.confirm('Are you sure you want to restore this version? Current changes will be saved as a new version.')) {
      onRestoreVersion(fileId, versionIndex);
      onClose();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all version history? This cannot be undone.')) {
      onClearHistory(fileId);
    }
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`}>
      <div className={`${colors.primary} ${colors.border} border rounded-lg w-11/12 max-w-4xl h-5/6 flex flex-col`}>
        {/* Header */}
        <div className={`p-4 border-b ${colors.borderLight} flex items-center justify-between`}>
          <div>
            <h2 className={`text-lg font-semibold text-gray-100`}>Version History</h2>
            <p className={`text-sm text-gray-400 mt-1`}>{fileName}</p>
          </div>
          <div className="flex gap-2">
            {versions.length > 0 && (
              <button
                onClick={handleClearHistory}
                className={`px-3 py-1 text-xs ${colors.border} text-gray-400 hover:text-gray-200 rounded transition-colors`}
              >
                Clear History
              </button>
            )}
            <button
              onClick={onClose}
              className={`px-3 py-2 ${colors.border} text-gray-400 hover:text-gray-200 rounded transition-colors`}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Version List */}
          <div className={`w-1/3 border-r ${colors.borderLight} flex flex-col`}>
            <div className={`p-3 border-b ${colors.borderLight}`}>
              <h3 className={`text-sm font-medium text-gray-100 mb-2`}>Versions ({versions.length})</h3>
              {versions.length === 0 && (
                <p className={`text-xs text-gray-500`}>No previous versions available</p>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {/* Current Version */}
              <div 
                className={`p-3 border-b ${colors.borderLight} ${
                  selectedVersion === null ? `${colors.secondary}` : `hover:${colors.hover} cursor-pointer`
                }`}
                onClick={() => setSelectedVersion(null)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${selectedVersion === null ? 'text-gray-100' : 'text-gray-300'}`}>
                    Current Version
                  </span>
                  <span className={`text-xs ${selectedVersion === null ? 'text-green-400' : 'text-gray-500'}`}>
                    ● Active
                  </span>
                </div>
                <p className={`text-xs ${selectedVersion === null ? 'text-gray-300' : 'text-gray-500'}`}>
                  Latest changes
                </p>
              </div>

              {/* Version History */}
              {versions.map((version, index) => (
                <div 
                  key={index}
                  className={`p-3 border-b ${colors.borderLight} cursor-pointer ${
                    selectedVersion === index ? `${colors.secondary}` : `hover:${colors.hover}`
                  }`}
                  onClick={() => setSelectedVersion(index)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${selectedVersion === index ? 'text-gray-100' : 'text-gray-300'}`}>
                      Version {versions.length - index}
                    </span>
                    <span className={`text-xs ${selectedVersion === index ? 'text-gray-300' : 'text-gray-500'}`}>
                      {getVersionAge(version.timestamp)}
                    </span>
                  </div>
                  <p className={`text-xs ${selectedVersion === index ? 'text-gray-300' : 'text-gray-500'} mb-1`}>
                    {formatDescription(version.description, version.generationId)}
                  </p>
                  <p className={`text-xs ${selectedVersion === index ? 'text-gray-400' : 'text-gray-600'}`}>
                    {formatTimestamp(version.timestamp)}
                  </p>
                  
                  {selectedVersion === index && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(index);
                      }}
                      className={`mt-2 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-gray-100 rounded transition-colors`}
                    >
                      Restore This Version
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content Preview */}
          <div className="flex-1 flex flex-col">
            <div className={`p-3 border-b ${colors.borderLight} flex items-center justify-between`}>
              <h3 className={`text-sm font-medium text-gray-100`}>
                {selectedVersion === null 
                  ? 'Current Content' 
                  : `Version ${versions.length - selectedVersion} Preview`
                }
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDiff(!showDiff)}
                  className={`px-2 py-1 text-xs ${showDiff ? 'bg-blue-600' : colors.border} text-gray-100 rounded transition-colors`}
                  disabled={selectedVersion === null}
                >
                  {showDiff ? 'Hide Diff' : 'Show Diff'}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <pre className={`p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap leading-relaxed`}>
                {selectedVersion === null 
                  ? (currentContent || 'No content yet') 
                  : (versions[selectedVersion]?.content || 'No content available')
                }
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-3 border-t ${colors.borderLight} flex justify-between items-center`}>
          <div className={`text-xs text-gray-500`}>
            {versions.length > 0 
              ? `${versions.length} version${versions.length !== 1 ? 's' : ''} available`
              : 'No version history yet'
            }
          </div>
          <div className="flex gap-2">
            {selectedVersion !== null && (
              <button
                onClick={() => handleRestore(selectedVersion)}
                className={`px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-gray-100 rounded transition-colors`}
              >
                Restore Selected Version
              </button>
            )}
            <button
              onClick={onClose}
              className={`px-3 py-1 text-xs ${colors.border} text-gray-400 hover:text-gray-200 rounded transition-colors`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionHistory;
