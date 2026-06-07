import { useState, useEffect } from 'react';
import { useApexStore } from './store/apex-store';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import CodeEditor from './components/CodeEditor';
import UnifiedBottomPanel from './components/UnifiedBottomPanel';
import ProblemsPanel from './components/ProblemsPanel';
import SoqlQueryBuilder from './components/SoqlQueryBuilder';
import DebugLogViewer from './components/DebugLogViewer';
import InlineDiffChecker from './components/InlineDiffChecker';
import Settings from './components/Settings';
import LoadingSpinner from './components/LoadingSpinner';
import { TabBar } from './components/TabBar';
import './App.css';

function App() {
  const { 
    session,
    selectedClass,
    classBody,
    isLoading,
    soqlBuilderOpen,
    diffCheckerOpen,
    panelVisibility,
    setSession,
    problems,
    error,
    setError
  } = useApexStore();

  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true);
  const [problemsPanelVisible, setProblemsPanelVisible] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  // Initialize: Load session from chrome.storage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const result = await chrome.storage.local.get(['session']);
        if (result.session) {
          setSession(result.session);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      }
    };
    
    loadSession();
    useApexStore.getState().loadTheme();
  }, [setSession]);

  // Handle sidebar resize
  const handleSidebarResize = (e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    }
  };

  // Handle bottom panel resize
  const handleBottomResize = (e: MouseEvent) => {
    if (isResizingBottom) {
      const newHeight = Math.max(150, Math.min(600, window.innerHeight - e.clientY));
      setBottomPanelHeight(newHeight);
    }
  };

  useEffect(() => {
    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleSidebarResize);
      document.addEventListener('mouseup', () => setIsResizingSidebar(false));
    }
    return () => {
      document.removeEventListener('mousemove', handleSidebarResize);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (isResizingBottom) {
      document.addEventListener('mousemove', handleBottomResize);
      document.addEventListener('mouseup', () => setIsResizingBottom(false));
    }
    return () => {
      document.removeEventListener('mousemove', handleBottomResize);
    };
  }, [isResizingBottom]);

  if (!session) {
    return (
      <div className="app-loading">
        <LoadingSpinner message="Initializing Console+..." size="large" />
      </div>
    );
  }

  // Show SOQL Builder as full overlay
  if (soqlBuilderOpen) {
    return (
      <div className="app">
        <Header />
        <div className="app-content">
          <SoqlQueryBuilder />
        </div>
      </div>
    );
  }

  // Show Debug Log Viewer as full overlay
  if (panelVisibility.debugLogs) {
    return (
      <div className="app">
        <Header />
        <div className="app-content">
          <DebugLogViewer />
        </div>
      </div>
    );
  }

  // Show Settings as full overlay
  if (panelVisibility.settings) {
    return (
      <div className="app">
        <Header />
        <div className="app-content">
          <Settings />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {isLoading && <LoadingSpinner message="Loading..." size="large" />}
      
      {/* Error notification */}
      {error && (
        <div className="error-notification">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <pre className="error-message">{error}</pre>
            <button className="error-close" onClick={() => setError(null)}>×</button>
          </div>
        </div>
      )}
      
      <Header />
      
      <div className="app-body">
        <Sidebar width={sidebarWidth} />
        
        <div 
          className="resize-handle resize-handle-vertical"
          onMouseDown={() => setIsResizingSidebar(true)}
        />
        
        <div className="app-main" style={{ width: `calc(100% - ${sidebarWidth}px - 4px)` }}>
          {/* Tab bar for multiple open classes - spans full width */}
          <TabBar />
          
          <div 
            className="editor-section"
            style={{ 
              height: bottomPanelVisible 
                ? `calc(100% - ${bottomPanelHeight}px - 4px)` 
                : '100%' 
            }}
          >
            <div className="editor-container">
              {diffCheckerOpen ? (
                <InlineDiffChecker />
              ) : selectedClass ? (
                <CodeEditor
                  classId={selectedClass.Id}
                  code={classBody}
                  className={selectedClass.Name}
                />
              ) : (
                <div className="editor-placeholder">
                  <h2>Welcome to Console+</h2>
                  <p>Select an Apex class from the sidebar to begin</p>
                </div>
              )}
            </div>
            
            {/* Problems panel on the right */}
            <div className={`problems-panel-container ${problemsPanelVisible ? 'visible' : ''}`}>
              <button 
                className="problems-toggle-btn"
                onClick={() => setProblemsPanelVisible(!problemsPanelVisible)}
                title={problemsPanelVisible ? "Hide Problems" : "Show Problems"}
              >
                {problemsPanelVisible ? '⮞' : '⮜'} Problems ({problems.length})
              </button>
              {problemsPanelVisible && <ProblemsPanel />}
            </div>
          </div>
          
          {bottomPanelVisible && (
            <>
              <div 
                className="resize-handle resize-handle-horizontal"
                onMouseDown={() => setIsResizingBottom(true)}
              />
              
              <UnifiedBottomPanel 
                height={bottomPanelHeight}
                onToggle={() => setBottomPanelVisible(!bottomPanelVisible)}
              />
            </>
          )}
          
          {!bottomPanelVisible && (
            <button 
              className="bottom-panel-toggle"
              onClick={() => setBottomPanelVisible(true)}
              title="Show Panel"
            >
              ▲
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
