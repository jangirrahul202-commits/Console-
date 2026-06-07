import React from 'react';
import { useApexStore } from '../store/apex-store';
import './TabBar.css';

export const TabBar: React.FC = () => {
  const { openTabs, activeTabId, switchTab, closeTab } = useApexStore();

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
          onClick={() => switchTab(tab.id)}
        >
          <span className="tab-name">{tab.className}</span>
          {tab.isDirty && <span className="dirty-indicator">●</span>}
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
