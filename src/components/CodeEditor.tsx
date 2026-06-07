import { useRef, useEffect } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import { useApexStore } from '../store/apex-store';
import { detectSoqlQueries } from '../utils/linter';
import { coveragePercent } from '../utils/coverage';
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
  const {
    saveCode,
    runTests,
    isRunningTest,
    openSoqlBuilder,
    openDiffChecker,
    activeTabId,
    updateTabBody,
    coverage,
    coverageVisible,
    setCoverageVisible,
    refreshClassFromOrg,
    isLoading,
    theme
  } = useApexStore();

  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

  // Check if this is a test class
  const isTestClass = className.toLowerCase().endsWith('test') || 
                      code.toLowerCase().includes('@istest');

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
    updateSoqlDecorations();
  }, [classId, code]);

  useEffect(() => {
    // Update coverage decorations when coverage visibility or data changes
    if (editorRef.current && monacoRef.current) {
      updateCoverageDecorations();
    }
  }, [coverageVisible, classCoverage, classId]);

  const handleEditorDidMount = (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    // Add SOQL query decorations
    updateSoqlDecorations();
    
    // Add coverage decorations if available
    updateCoverageDecorations();

    // Register Ctrl+S / Cmd+S for save
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    // Register click handler for glyph margin (for SOQL icon clicks)
    editorInstance.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber) {
          const queries = detectSoqlQueries(code);
          const query = queries.find(q => q.line === lineNumber);
          if (query) {
            openSoqlBuilder(query.query);
          }
        }
      }
    });
  };

  const updateSoqlDecorations = () => {
    if (!editorRef.current || !monacoRef.current) return;

    const queries = detectSoqlQueries(code);
    const decorations = queries.map(q => ({
      range: new monacoRef.current!.Range(q.line, 1, q.line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'soql-query-glyph',
        glyphMarginHoverMessage: { value: 'Click to open in Query Builder' }
      }
    }));

    editorRef.current.deltaDecorations([], decorations);
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
            <button 
              className="toolbar-btn toolbar-btn-test"
              onClick={handleRunTests}
              disabled={isRunningTest}
              title="Run Tests"
            >
              {isRunningTest ? '⏳ Running...' : '▶️ Run Tests'}
            </button>
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
