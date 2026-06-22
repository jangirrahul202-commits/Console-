import { useRef, useEffect, useCallback } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import { useApexStore } from '../store/apex-store';
import { coveragePercent } from '../utils/coverage';
import { detectSoqlQueries } from '../utils/linter';
import { isLikelyTestClass } from '../utils/test-class';
import { editor } from 'monaco-editor';
import './CodeEditor.css';

import * as monaco from 'monaco-editor';
import { setupMonacoEnvironment } from '../utils/monaco-env';

setupMonacoEnvironment();
loader.config({ monaco });

interface CodeEditorProps {
  classId: string;
  code: string;
  className: string;
}

export default function CodeEditor({ classId, code, className }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const coverageDecorationsRef = useRef<string[]>([]);
  const soqlDecorationsRef = useRef<string[]>([]);
  const {
    saveCode,
    runTests,
    isRunningTest,
    openDiffChecker,
    openSoqlBuilder,
    activeTabId,
    updateTabBody,
    coverage,
    coverageVisible,
    setCoverageVisible,
    refreshClassFromOrg,
    isLoading,
    theme,
    testRunSettings,
    setTestRunParallel
  } = useApexStore();

  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

  const isTestClass = isLikelyTestClass(className) || code.toLowerCase().includes('@istest');

  // Get aggregate coverage for this class
  const classCoverage = coverage.get(classId);
  const hasCoverage =
    classCoverage &&
    (classCoverage.NumLinesCovered + classCoverage.NumLinesUncovered) > 0;

  // Sync editor when tab/file changes without polluting undo stack
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !monacoRef.current) return;
    const model = ed.getModel();
    if (model && model.getValue() !== code) {
      ed.pushUndoStop();
      model.setValue(code);
      ed.pushUndoStop();
    }
  }, [classId, code]);

  useEffect(() => {
    // Update coverage decorations when coverage visibility or data changes
    if (editorRef.current && monacoRef.current) {
      updateCoverageDecorations();
    }
  }, [coverageVisible, classCoverage, classId]);

  const updateSoqlDecorations = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const queries = detectSoqlQueries(code);
    const decorations = queries.map(q => ({
      range: new monacoRef.current!.Range(q.line, 1, q.line, 1),
      options: {
        glyphMarginClassName: 'soql-query-glyph',
        glyphMarginHoverMessage: {
          value: `Open in Data Explorer\n${q.query.length > 120 ? q.query.slice(0, 120) + '…' : q.query}`
        }
      }
    }));

    soqlDecorationsRef.current = editorRef.current.deltaDecorations(
      soqlDecorationsRef.current,
      decorations
    );
  }, [code]);

  useEffect(() => {
    updateSoqlDecorations();
  }, [updateSoqlDecorations]);

  const handleEditorDidMount = (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    // Add coverage decorations if available
    updateCoverageDecorations();
    updateSoqlDecorations();

    editorInstance.onMouseDown(e => {
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
      const line = e.target.position?.lineNumber;
      if (!line) return;
      const match = detectSoqlQueries(editorInstance.getValue()).find(q => q.line === line);
      if (match) openSoqlBuilder(match.query);
    });

    // Register Ctrl+S / Cmd+S for save
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  const updateCoverageDecorations = () => {
    if (!editorRef.current || !monacoRef.current) return;

    // Clear existing coverage decorations
    if (coverageDecorationsRef.current.length > 0) {
      editorRef.current.deltaDecorations(coverageDecorationsRef.current, []);
      coverageDecorationsRef.current = [];
    }

    // Only show coverage if enabled and we have coverage data
    if (!coverageVisible || !classCoverage || !classCoverage.Coverage || !Array.isArray(classCoverage.Coverage)) return;

    const decorations = classCoverage.Coverage.map(loc => {
      const isCovered = loc.covered === 1;
      return {
        range: new monacoRef.current!.Range(loc.line, 1, loc.line, 1),
        options: {
          isWholeLine: true,
          className: isCovered ? 'line-covered' : 'line-uncovered',
          glyphMarginClassName: isCovered ? 'glyph-covered' : 'glyph-uncovered',
          hoverMessage: { 
            value: isCovered 
              ? '✅ This line is covered by tests' 
              : '❌ This line is NOT covered by tests' 
          }
        }
      };
    });

    coverageDecorationsRef.current = editorRef.current.deltaDecorations([], decorations);
  };

  const toggleCoverage = () => {
    setCoverageVisible(!coverageVisible);
  };

  const handleSave = () => {
    if (editorRef.current) {
      const currentCode = editorRef.current.getValue();
      saveCode(currentCode);
    }
  };

  const handleRunTests = () => {
    runTests(classId);
  };

  return (
    <div className="code-editor">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-filename">{className}.cls</span>
          {hasCoverage && classCoverage && (
            <span className="coverage-badge">
              {coveragePercent(classCoverage.NumLinesCovered, classCoverage.NumLinesUncovered)}% Coverage
            </span>
          )}
        </div>
        <div className="toolbar-right">
          {hasCoverage && (
            <button 
              className={`toolbar-btn toolbar-btn-coverage ${coverageVisible ? 'active' : ''}`}
              onClick={toggleCoverage}
              title={coverageVisible ? "Hide Coverage" : "Show Coverage"}
            >
              {coverageVisible ? '🎨 Hide Coverage' : '🎨 Show Coverage'}
            </button>
          )}
          <button
            className="toolbar-btn"
            onClick={() => openDiffChecker()}
            title="Compare with pasted code (split diff view)"
          >
            ⇄ Diff
          </button>
          <button
            className="toolbar-btn"
            onClick={() => refreshClassFromOrg(classId)}
            disabled={isLoading}
            title="Reload latest code from Salesforce org"
          >
            {isLoading ? '⏳' : '🔄'} Refresh
          </button>
          <button 
            className="toolbar-btn"
            onClick={handleSave}
            title="Save (Cmd+S)"
          >
            💾 Save
          </button>
          {isTestClass && (
            <>
              <label
                className="toolbar-test-parallel"
                title="Parallel runs test methods concurrently (Developer Console default). Uncheck for serial execution."
              >
                <input
                  type="checkbox"
                  checked={testRunSettings.parallel}
                  onChange={e => setTestRunParallel(e.target.checked)}
                  disabled={isRunningTest}
                />
                Parallel
              </label>
              <button
                className="toolbar-btn toolbar-btn-test"
                onClick={handleRunTests}
                disabled={isRunningTest}
                title={testRunSettings.parallel
                  ? 'Run tests in parallel (async)'
                  : 'Run tests serially (sync)'}
              >
                {isRunningTest ? '⏳ Running...' : '▶️ Run Tests'}
              </button>
            </>
          )}
        </div>
      </div>

      <Editor
        key={classId}
        height="100%"
        language="apex"
        path={`apex-${classId}`}
        defaultValue={code}
        theme={monacoTheme}
        onMount={handleEditorDidMount}
        onChange={(value) => {
          if (value !== undefined && activeTabId) {
            updateTabBody(activeTabId, value);
          }
        }}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'off',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          glyphMargin: true,
          lineDecorationsWidth: 10
        }}
      />
    </div>
  );
}
