import { useState, useMemo } from 'react';
import { useApexStore } from '../store/apex-store';
import { isLikelyTestClass } from '../utils/test-class';
import './Sidebar.css';

interface SidebarProps {
  width: number;
}

export default function Sidebar({ width }: SidebarProps) {
  const {
    classes,
    selectedClass,
    openTab,
    isLoading,
    isRunningTest,
    selectedTestClassIds,
    toggleTestClassSelection,
    clearTestClassSelection,
    runTestsForClasses
  } = useApexStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) {
      return classes;
    }

    const query = searchQuery.toLowerCase();
    return classes.filter(cls => cls.Name.toLowerCase().includes(query));
  }, [classes, searchQuery]);

  const selectedCount = selectedTestClassIds.length;

  const handleRunSelected = () => {
    if (!selectedCount || isRunningTest) return;
    void runTestsForClasses(selectedTestClassIds);
  };

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
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="sidebar-test-actions">
          <button
            type="button"
            className="sidebar-run-selected-btn"
            onClick={handleRunSelected}
            disabled={isRunningTest}
            title="Run all selected test classes in one job"
          >
            {isRunningTest ? '⏳ Running…' : `▶ Run ${selectedCount} Test${selectedCount === 1 ? '' : 's'}`}
          </button>
          <button
            type="button"
            className="sidebar-clear-selection-btn"
            onClick={clearTestClassSelection}
            disabled={isRunningTest}
            title="Clear selection"
          >
            Clear
          </button>
        </div>
      )}

      <div className="sidebar-section">
        <div className="section-header">
          <span>CLASSES ({filteredClasses.length}{searchQuery ? ` of ${classes.length}` : ''})</span>
        </div>

        <div className="class-list">
          {isLoading && classes.length === 0 ? (
            <div className="loading-text">Loading classes...</div>
          ) : filteredClasses.length === 0 ? (
            <div className="loading-text">No classes found</div>
          ) : (
            filteredClasses.map(cls => {
              const isTest = isLikelyTestClass(cls.Name);
              const isChecked = selectedTestClassIds.includes(cls.Id);

              return (
                <div
                  key={cls.Id}
                  className={`class-item ${selectedClass?.Id === cls.Id ? 'active' : ''} ${isTest ? 'class-item-test' : ''}`}
                  onClick={() => openTab(cls.Id, { refresh: true })}
                >
                  {isTest ? (
                    <input
                      type="checkbox"
                      className="class-test-checkbox"
                      checked={isChecked}
                      onChange={() => toggleTestClassSelection(cls.Id)}
                      onClick={e => e.stopPropagation()}
                      title="Select for multi-class test run"
                    />
                  ) : (
                    <span className="class-icon">📄</span>
                  )}
                  <span className="class-name">{cls.Name}</span>
                  {isTest && <span className="class-test-badge">Test</span>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
