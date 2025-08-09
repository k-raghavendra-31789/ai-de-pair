import React, { useState } from 'react';
import { useTheme } from './ThemeContext';

const MenuBar = ({ onToggleTerminal, isTerminalVisible }) => {
  const { colors } = useTheme();
  const [activeMenu, setActiveMenu] = useState(null);

  const menuItems = [
    {
      label: 'View',
      items: [
        {
          label: 'Toggle Terminal',
          shortcut: 'Ctrl+`',
          action: onToggleTerminal,
          checked: isTerminalVisible
        }
      ]
    }
  ];

  const handleMenuClick = (menuLabel) => {
    setActiveMenu(activeMenu === menuLabel ? null : menuLabel);
  };

  const handleItemClick = (item) => {
    item.action();
    setActiveMenu(null);
  };

  return (
    <div className={`${colors.secondary} ${colors.border} border-b flex items-center px-2 relative z-50`} style={{ height: '30px' }}>
      {menuItems.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            onClick={() => handleMenuClick(menu.label)}
            className={`px-3 py-1 text-sm rounded ${
              activeMenu === menu.label 
                ? `${colors.accent} ${colors.text}` 
                : `${colors.textSecondary} hover:${colors.text} hover:bg-gray-600`
            }`}
          >
            {menu.label}
          </button>
          
          {activeMenu === menu.label && (
            <>
              {/* Backdrop to close menu */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setActiveMenu(null)}
              />
              
              {/* Dropdown menu */}
              <div className={`absolute top-full left-0 ${colors.secondary} ${colors.border} border rounded shadow-lg py-1 min-w-48 z-20`}>
                {menu.items.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left px-3 py-2 text-sm ${colors.textSecondary} hover:${colors.text} hover:bg-gray-600 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-2">
                      {item.checked && (
                        <span className="text-green-400">✓</span>
                      )}
                      <span>{item.label}</span>
                    </div>
                    {item.shortcut && (
                      <span className={`text-xs ${colors.textMuted}`}>
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
      
      {/* Status bar info on the right */}
      <div className="ml-auto flex items-center gap-4 text-xs">
        <span className={colors.textMuted}>
          Terminal: {isTerminalVisible ? 'Open' : 'Closed'}
        </span>
        <span className={colors.textMuted}>
          Ctrl+` to toggle
        </span>
      </div>
    </div>
  );
};

export default MenuBar;
