// Unified Bottom Panel with tabs for Coverage and Test Results

import { useState } from 'react';
import { useApexStore } from '../store/apex-store';
import { CoverageOverview } from './CoverageOverview';
import './UnifiedBottomPanel.css';

interface UnifiedBottomPanelProps {
  height: number;
  onToggle: () => void;
}

type Tab = 'testResults' | 'coverage';

export default function UnifiedBottomPanel({ height, onToggle }: UnifiedBottomPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('testResults');
  const { 
    selectedClass,
    coverage,
    testResults
  } = useApexStore();

  const currentTestResults = selectedClass ? testResults.get(selectedClass.Id) : null;

  // Count total classes with coverage
  const totalCoveredClasses = coverage.size;

  return (
    <div className="unified-bottom-panel" style={{ height: `${height}px` }}>
      <div className="panel-header">
        <div className="panel-tabs">
          <button
            className={`panel-tab ${activeTab === 'testResults' ? 'active' : ''}`}
            onClick={() => setActiveTab('testResults')}
          >
            🧪 Test Results
            {currentTestResults && (
              <span className={`tab-badge ${currentTestResults.failed === 0 ? 'success' : 'error'}`}>
                {currentTestResults.passed}/{currentTestResults.totalTests}
              </span>
            )}
          </button>

          <button
            className={`panel-tab ${activeTab === 'coverage' ? 'active' : ''}`}
            onClick={() => setActiveTab('coverage')}
          >
            📊 Coverage
            {totalCoveredClasses > 0 && (
              <span className="tab-badge success">
                {totalCoveredClasses}
              </span>
            )}
          </button>
        </div>
        
        <button 
          className="panel-collapse-btn"
          onClick={onToggle}
          title="Hide Panel"
        >
          ▼
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'testResults' && (
          <div className="test-results-tab">
            {!currentTestResults ? (
              <div className="panel-placeholder">
                <p>No test results available</p>
                {selectedClass && (
                  <p className="hint">Run tests to see results here</p>
                )}
              </div>
            ) : (
              <div className="test-results-content">
                <div className="test-summary">
                  <div className="summary-item">
                    <span className="label">Run Time:</span>
                    <span className="value">{currentTestResults.runTime}ms</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Timestamp:</span>
                    <span className="value">
                      {new Date(currentTestResults.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="test-list">
                  {currentTestResults.tests.map((test, index) => (
                    <div 
                      key={index} 
                      className={`test-item ${test.Outcome.toLowerCase()}`}
                    >
                      <div className="test-header">
                        <span className={`test-icon ${test.Outcome.toLowerCase()}`}>
                          {test.Outcome === 'Pass' ? '✓' : '✗'}
                        </span>
                        <span className="test-name">{test.MethodName}</span>
                        <span className="test-time">{test.RunTime}ms</span>
                      </div>
                      
                      {test.Message && (
                        <div className="test-message">
                          <strong>Message:</strong> {test.Message}
                        </div>
                      )}
                      
                      {test.StackTrace && (
                        <div className="test-stacktrace">
                          <strong>Stack Trace:</strong>
                          <pre>{test.StackTrace}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'coverage' && (
          <CoverageOverview />
        )}
      </div>
    </div>
  );
}
