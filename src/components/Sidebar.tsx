import { useState, useMemo } from 'react';
import { useApexStore } from '../store/apex-store';
import './Sidebar.css';

interface SidebarProps {
  width: number;
}

export default function Sidebar({ width }: SidebarProps) {
  const { classes, selectedClass, openTab, isLoading } = useApexStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter classes based on search query
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) {
      return classes;
    }
    
    const query = searchQuery.toLowerCase();
    return classes.filter(cls => 
      cls.Name.toLowerCase().includes(query)
    );
  }, [classes, searchQuery]);

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
          onChange={(e) => setSearchQuery(e.target.value)}
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
            filteredClasses.map(cls => (
              <div
                key={cls.Id}
                className={`class-item ${selectedClass?.Id === cls.Id ? 'active' : ''}`}
                onClick={() => openTab(cls.Id, { refresh: true })}
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
