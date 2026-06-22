// Unified Bottom Panel with tabs for Coverage and Test Results

import { useMemo, useState } from 'react';
import { useApexStore } from '../store/apex-store';
import { CoverageOverview } from './CoverageOverview';
import { sortTestRunResults } from '../utils/test-run';
import type { TestRunResult } from '../types';
import './UnifiedBottomPanel.css';

interface UnifiedBottomPanelProps {
  height: number;
  onToggle: () => void;
}

type Tab = 'testResults' | 'coverage';

function formatDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function UnifiedBottomPanel({ height, onToggle }: UnifiedBottomPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('testResults');
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(new Set());
  const {
    coverage,
    testResults,
    openTab
  } = useApexStore();

  const allTestRuns = useMemo(
    () => sortTestRunResults(Array.from(testResults.values())),
    [testResults]
  );

  const runningCount = allTestRuns.filter(r => r.status === 'running').length;
  const completedRuns = allTestRuns.filter(r => r.status === 'completed');
  const totalPassed = completedRuns.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = completedRuns.reduce((sum, r) => sum + r.failed, 0);
  const totalCoveredClasses = coverage.size;

  const toggleExpanded = (entry: TestRunResult) => {
    if (entry.status === 'running') return;
    setExpandedClassIds(prev => {
      const next = new Set(prev);
      if (next.has(entry.classId)) next.delete(entry.classId);
      else next.add(entry.classId);
      return next;
    });
  };

  const renderStatusBadge = (entry: TestRunResult) => {
    if (entry.status === 'running') {
      return (
        <span className="test-class-status running">
          <span className="test-class-spinner" aria-hidden />
          Running
        </span>
      );
    }
    if (entry.status === 'failed') {
      return <span className="test-class-status failed">Failed</span>;
    }
    if (entry.failed > 0) {
      return (
        <span className="test-class-status fail">
          {entry.passed}/{entry.totalTests} passed
        </span>
      );
    }
    return (
      <span className="test-class-status pass">
        {entry.passed}/{entry.totalTests} passed
      </span>
    );
  };

  return (
    <div className="unified-bottom-panel" style={{ height: `${height}px` }}>
      <div className="panel-header">
        <div className="panel-tabs">
          <button
            className={`panel-tab ${activeTab === 'testResults' ? 'active' : ''}`}
            onClick={() => setActiveTab('testResults')}
          >
            🧪 Test Results
            {runningCount > 0 ? (
              <span className="tab-badge warning">{runningCount} running</span>
            ) : completedRuns.length > 0 ? (
              <span className={`tab-badge ${totalFailed === 0 ? 'success' : 'error'}`}>
                {totalPassed}/{totalPassed + totalFailed}
              </span>
            ) : null}
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
            {allTestRuns.length === 0 ? (
              <div className="panel-placeholder">
                <p>No test runs yet this session</p>
                <p className="hint">Run tests from the editor or select classes in the sidebar</p>
              </div>
            ) : (
              <div className="test-class-runs">
                {allTestRuns.map(entry => {
                  const isExpanded = expandedClassIds.has(entry.classId);
                  const canExpand = entry.status !== 'running';

                  return (
                    <div
                      key={entry.classId}
                      className={`test-class-run ${entry.status} ${isExpanded ? 'expanded' : ''}`}
                    >
                      <div className="test-class-run-header">
                        <button
                          type="button"
                          className="test-class-expand-btn"
                          onClick={() => toggleExpanded(entry)}
                          disabled={!canExpand}
                          title={
                            entry.status === 'running'
                              ? 'Test class is running'
                              : isExpanded
                                ? 'Collapse methods'
                                : 'Expand to see all test methods'
                          }
                        >
                          <span className={`test-class-chevron ${canExpand ? '' : 'hidden'}`}>
                            {isExpanded ? '▾' : '▸'}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="test-class-name"
                          onClick={() => openTab(entry.classId)}
                          title="Open class in editor"
                        >
                          {entry.className}
                        </button>
                        {renderStatusBadge(entry)}
                        {entry.status === 'completed' && (
                          <span className="test-class-meta">
                            {entry.runTime}ms
                            {entry.executionMode && ` · ${entry.executionMode}`}
                          </span>
                        )}
                        {entry.status === 'running' && entry.startedAt && (
                          <span className="test-class-meta">Started {new Date(entry.startedAt).toLocaleTimeString()}</span>
                        )}
                      </div>

                      {entry.status === 'running' && (
                        <div className="test-class-running-detail">
                          {entry.methodsEnqueued && entry.methodsEnqueued > 0 ? (
                            <>
                              {entry.methodsCompleted ?? entry.tests.length}/{entry.methodsEnqueued} methods complete
                              {entry.tests.length > 0 && ' — expand after finish to see details'}
                            </>
                          ) : entry.tests.length > 0 ? (
                            <>{entry.tests.length} method{entry.tests.length === 1 ? '' : 's'} reported so far…</>
                          ) : (
                            <>Waiting for Salesforce to finish all test methods in this class…</>
                          )}
                        </div>
                      )}

                      {isExpanded && entry.status === 'failed' && (
                        <div className="test-class-error">
                          <strong>Run failed:</strong> {entry.error ?? 'Unknown error'}
                        </div>
                      )}

                      {isExpanded && entry.tests.length > 0 && (
                        <div className="test-list">
                          {entry.tests.map((test, index) => (
                            <div
                              key={`${test.MethodName}-${index}`}
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
                      )}

                      {isExpanded && entry.status === 'completed' && (
                        <div className="test-class-footer">
                          Finished {new Date(entry.timestamp).toLocaleString()}
                          {entry.startedAt && ` · ${formatDuration(entry.startedAt, entry.timestamp)}`}
                        </div>
                      )}
                    </div>
                  );
                })}
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
