#!/usr/bin/env python3
"""
Component Generator Script for Console+
Generates all remaining UI components needed for the extension
"""

import os

COMPONENTS = {
    "Header.tsx": """import { useApexStore } from '../store/apex-store';
import logoAnimated from '../../public/icons/logo-animated.svg';
import './Header.css';

export default function Header() {
  const { openDebugLogViewer, openSettings, openSoqlBuilder, openDiffChecker } = useApexStore();

  return (
    <header className="header">
      <div className="header-left">
        <img src={logoAnimated} alt="Console+" className="header-logo" />
        <h1 className="header-title">Console+</h1>
      </div>
      
      <div className="header-actions">
        <button className="header-btn" onClick={() => openSoqlBuilder()}>
          SOQL Query
        </button>
        <button className="header-btn" onClick={() => openDiffChecker()}>
          Diff Checker
        </button>
        <button className="header-btn" onClick={() => openDebugLogViewer()}>
          Debug Logs
        </button>
        <button className="header-btn" onClick={() => openSettings()}>
          ⚙️ Settings
        </button>
      </div>
    </header>
  );
}
""",

    "Header.css": """.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #2d2d30;
  border-bottom: 1px solid #3c3c3c;
  padding: 8px 16px;
  height: 50px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-logo {
  width: 32px;
  height: 32px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-btn {
  background: transparent;
  border: 1px solid #555;
  color: #cccccc;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.header-btn:hover {
  background: #3c3c3c;
  border-color: #007acc;
  color: #ffffff;
}
""",

    "Sidebar.tsx": """import { useApexStore } from '../store/apex-store';
import './Sidebar.css';

interface SidebarProps {
  width: number;
}

export default function Sidebar({ width }: SidebarProps) {
  const { classes, selectedClass, selectClass, isLoading } = useApexStore();

  return (
    <div className="sidebar" style={{ width: `${width}px` }}>
      <div className="sidebar-header">
        <h3>WORKSPACE</h3>
      </div>
      
      <div className="sidebar-search">
        <input 
          type="text" 
          placeholder="Search classes..." 
          className="search-input"
        />
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <span>CLASSES ({classes.length})</span>
        </div>
        
        <div className="class-list">
          {isLoading && classes.length === 0 ? (
            <div className="loading-text">Loading classes...</div>
          ) : (
            classes.map(cls => (
              <div
                key={cls.Id}
                className={`class-item ${selectedClass?.Id === cls.Id ? 'active' : ''}`}
                onClick={() => selectClass(cls.Id)}
              >
                <span className="class-icon">📄</span>
                <span className="class-name">{cls.Name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
""",

    "Sidebar.css": """.sidebar {
  background: #252526;
  border-right: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid #3c3c3c;
}

.sidebar-header h3 {
  font-size: 11px;
  color: #888;
  font-weight: 600;
}

.sidebar-search {
  padding: 8px;
  border-bottom: 1px solid #3c3c3c;
}

.search-input {
  width: 100%;
  background: #3c3c3c;
  border: 1px solid #555;
  color: #cccccc;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
}

.search-input:focus {
  outline: none;
  border-color: #007acc;
}

.sidebar-section {
  flex: 1;
  overflow-y: auto;
}

.section-header {
  padding: 8px 16px;
  font-size: 11px;
  color: #888;
  font-weight: 600;
  text-transform: uppercase;
}

.class-list {
  display: flex;
  flex-direction: column;
}

.class-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: #cccccc;
  font-size: 13px;
}

.class-item:hover {
  background: #2a2a2a;
}

.class-item.active {
  background: #094771;
  color: #ffffff;
}

.class-icon {
  font-size: 14px;
}

.loading-text {
  padding: 16px;
  text-align: center;
  color: #888;
  font-size: 13px;
}
""",

    "ProblemsPanel.tsx": """import { useApexStore } from '../store/apex-store';
import './ProblemsPanel.css';

export default function ProblemsPanel() {
  const { problems } = useApexStore();

  return (
    <div className="problems-panel">
      <div className="problems-header">
        <h3>PROBLEMS ({problems.length})</h3>
      </div>
      
      <div className="problems-list">
        {problems.length === 0 ? (
          <div className="problems-empty">
            No problems found
          </div>
        ) : (
          problems.map((problem, index) => (
            <div key={index} className={`problem-item severity-${problem.severity}`}>
              <span className="problem-icon">
                {problem.severity === 'error' ? '🔴' : problem.severity === 'warning' ? '🟡' : 'ℹ️'}
              </span>
              <div className="problem-content">
                <div className="problem-message">{problem.message}</div>
                <div className="problem-location">
                  Line {problem.line}, Column {problem.column}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
""",

    "ProblemsPanel.css": """.problems-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
}

.problems-header {
  padding: 8px 12px;
  border-bottom: 1px solid #3c3c3c;
  font-size: 11px;
  color: #888;
  font-weight: 600;
}

.problems-list {
  flex: 1;
  overflow-y: auto;
}

.problems-empty {
  padding: 16px;
  text-align: center;
  color: #888;
  font-size: 13px;
}

.problem-item {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #2d2d2d;
  cursor: pointer;
  transition: background 0.2s;
}

.problem-item:hover {
  background: #2a2a2a;
}

.problem-icon {
  font-size: 12px;
}

.problem-content {
  flex: 1;
}

.problem-message {
  font-size: 12px;
  color: #cccccc;
  margin-bottom: 4px;
}

.problem-location {
  font-size: 11px;
  color: #888;
}
"""
}

CSS_FILES = {
    "LoadingSpinner.css": """.loading-spinner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(10px);
  background: rgba(26, 29, 41, 0.5);
}

.loading-spinner-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: rgba(26, 29, 41, 0.95);
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.loading-spinner-animation {
  width: 200px;
  height: 200px;
}

.loading-spinner-text {
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
}
"""
}

def create_component(name, content):
    path = f"src/components/{name}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f"✅ Created {path}")

def main():
    print("🚀 Generating Console+ components...")
    
    for name, content in COMPONENTS.items():
        create_component(name, content)
    
    for name, content in CSS_FILES.items():
        create_component(name, content)
    
    print("✅ All components generated successfully!")

if __name__ == "__main__":
    main()
