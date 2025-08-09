import React, { useState } from 'react';
import { useTheme } from './ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import CustomScrollbar from './CustomScrollbar';

const TerminalPanel = () => {
  const { colors } = useTheme();
  const { state, actions } = useAppState();
  
  // Get terminal state from context
  const { panelSizes, isTerminalVisible } = state;
  const { toggleTerminal } = actions;
  const height = panelSizes.bottomPanelHeight;
  
  const [activeTab, setActiveTab] = useState('data');
  const [dataTabs, setDataTabs] = useState([
    { id: 'data', label: 'Data', icon: '📊' }
  ]);

  // If height is too small, don't render content
  const isCollapsed = height < 50;

  // Sample data for the data panel - will be replaced with real data later
  const sampleData = [];

  const addNewDataTab = () => {
    const newTabId = `data-${Date.now()}`;
    const newTab = {
      id: newTabId,
      label: `Data ${dataTabs.length}`,
      icon: '📄'
    };
    setDataTabs([...dataTabs, newTab]);
    setActiveTab(newTabId);
  };

  const removeDataTab = (tabId) => {
    if (dataTabs.length > 1) {
      const newTabs = dataTabs.filter(tab => tab.id !== tabId);
      setDataTabs(newTabs);
      if (activeTab === tabId) {
        setActiveTab(newTabs[0].id);
      }
    }
  };

  const tabs = [
    ...dataTabs.map(tab => ({
      ...tab,
      closable: dataTabs.length > 1
    })),
    {
      id: 'add-new',
      label: '+',
      icon: '',
      isAddButton: true
    }
  ];

  const renderContent = () => {
    const currentTab = dataTabs.find(tab => tab.id === activeTab);
    if (!currentTab) return null;

    return (
      <div className="p-4 h-full">
        <div className={`flex items-center justify-center h-full ${colors.textMuted}`}>
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-lg">Data Panel</div>
            <div className="text-sm">Data will be rendered here</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`${colors.secondary} ${colors.border} border-t flex flex-col`}
      style={{ height }}
    >
      {/* Always show header, but minimal when collapsed */}
      <div className={`${colors.border} border-b flex items-center px-2 ${isCollapsed ? 'py-1' : ''}`}>
        <div className="flex items-center">
          {!isCollapsed ? (
            tabs.map((tab) => (
              <div key={tab.id} className="flex items-center">
                {tab.isAddButton ? (
                  <button
                    onClick={addNewDataTab}
                    className={`
                      flex items-center justify-center w-8 h-8 text-lg font-bold
                      ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600 rounded
                    `}
                    title="Add new data tab"
                  >
                    +
                  </button>
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wide font-medium
                        ${activeTab === tab.id 
                          ? `${colors.text} border-b-2 border-blue-500` 
                          : `${colors.textSecondary} hover:${colors.text}`
                        }
                      `}
                    >
                      <span className="text-sm">{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                    {tab.closable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDataTab(tab.id);
                        }}
                        className={`ml-1 p-1 rounded text-xs ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600`}
                        title="Close tab"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className={`flex items-center gap-2 px-2 text-xs ${colors.textSecondary}`}>
              <span className="text-sm">{dataTabs.find(t => t.id === activeTab)?.icon}</span>
              <span>{dataTabs.find(t => t.id === activeTab)?.label}</span>
            </div>
          )}
        </div>
        
        {/* Simple close button */}
        {!isCollapsed && (
          <button
            onClick={toggleTerminal}
            className={`ml-auto px-3 py-2 text-lg ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600 rounded`}
            title="Close panel"
          >
            ×
          </button>
        )}
      </div>

      {/* Terminal Content - only show if not collapsed */}
      {!isCollapsed && (
        <CustomScrollbar 
          className="flex-1"
          showHorizontal={false}
          showVertical={true}
        >
          <div className={`${colors.primary} h-full`}>
            {renderContent()}
          </div>
        </CustomScrollbar>
      )}
    </div>
  );
};

export default TerminalPanel;
