import { useRef, useCallback, useState, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import { useApexStore } from '../store/apex-store';
import { setupMonacoEnvironment } from '../utils/monaco-env';
import {
  computeTextDiff,
  applyHunkToLeft,
  applyHunkToRight,
  type DiffHighlight,
  type DiffHunk
} from '../utils/text-diff';
import './InlineDiffChecker.css';

setupMonacoEnvironment();
loader.config({ monaco });

const EDITOR_OPTS: monaco.editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  lineHeight: 20,
  lineNumbers: 'on',
  wordWrap: 'off',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  glyphMargin: false,
  scrollbar: {
    vertical: 'auto',
    horizontal: 'auto',
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10
  }
};

interface GutterArrow {
  hunk: DiffHunk;
  top: number;
}

function highlightsToDecorations(
  monacoApi: typeof monaco,
  highlights: DiffHighlight[]
): monaco.editor.IModelDeltaDecoration[] {
  return highlights.map(h => ({
    range: new monacoApi.Range(h.line, 1, h.line, 1),
    options: {
      isWholeLine: true,
      className: h.kind === 'removed' ? 'diff-line-removed' : 'diff-line-added'
    }
  }));
}

export default function InlineDiffChecker() {
  const {
    closeDiffChecker,
    diffOriginalCode,
    diffComparisonCode,
    setDiffOriginalCode,
    setDiffComparisonCode,
    updateTabBody,
    activeTabId,
    selectedClass,
    theme
  } = useApexStore();

  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

  const splitRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const rightEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const leftDecoRef = useRef<string[]>([]);
  const rightDecoRef = useRef<string[]>([]);
  const leftZoneRef = useRef<string[]>([]);
  const rightZoneRef = useRef<string[]>([]);
  const syncingRef = useRef(false);
  const scrollSyncRef = useRef<'left' | 'right' | null>(null);
  const hunksRef = useRef<DiffHunk[]>([]);
  const mountedRef = useRef(false);
  const diffCheckedRef = useRef(false);

  const [diffChecked, setDiffChecked] = useState(false);
  const [changeCount, setChangeCount] = useState(0);
  const [hunks, setHunks] = useState<DiffHunk[]>([]);
  const [gutterArrows, setGutterArrows] = useState<GutterArrow[]>([]);
  const [activeChangeIdx, setActiveChangeIdx] = useState(-1);
  const [rightHasContent, setRightHasContent] = useState(false);
  const [showPastePrompt, setShowPastePrompt] = useState(true);

  const clearDiffVisuals = useCallback(() => {
    const leftEd = leftEditorRef.current;
    const rightEd = rightEditorRef.current;

    hunksRef.current = [];
    setHunks([]);
    setChangeCount(0);
    setGutterArrows([]);
    setActiveChangeIdx(-1);

    if (leftEd) {
      leftDecoRef.current = leftEd.deltaDecorations(leftDecoRef.current, []);
      leftEd.changeViewZones(accessor => {
        leftZoneRef.current.forEach(id => accessor.removeZone(id));
        leftZoneRef.current = [];
      });
    }
    if (rightEd) {
      rightDecoRef.current = rightEd.deltaDecorations(rightDecoRef.current, []);
      rightEd.changeViewZones(accessor => {
        rightZoneRef.current.forEach(id => accessor.removeZone(id));
        rightZoneRef.current = [];
      });
    }
  }, []);

  const updateGutterArrows = useCallback(() => {
    const leftEd = leftEditorRef.current;
    const splitEl = splitRef.current;
    if (!leftEd || !splitEl || !diffCheckedRef.current || hunksRef.current.length === 0) {
      setGutterArrows([]);
      return;
    }

    const scrollTop = leftEd.getScrollTop();
    const lineHeight = leftEd.getOption(monaco.editor.EditorOption.lineHeight);
    const splitHeight = splitEl.clientHeight;

    const arrows: GutterArrow[] = hunksRef.current
      .map(hunk => {
        const line = hunk.displayLine;
        const top =
          leftEd.getTopForLineNumber(line) - scrollTop + lineHeight / 2 - 14;
        return { hunk, top };
      })
      .filter(a => a.top >= -20 && a.top <= splitHeight - 10);

    setGutterArrows(arrows);
  }, []);

  const applyAlignmentZones = useCallback(
    (leftEd: monaco.editor.IStandaloneCodeEditor, rightEd: monaco.editor.IStandaloneCodeEditor, diffHunks: DiffHunk[]) => {
      const lineHeight = leftEd.getOption(monaco.editor.EditorOption.lineHeight);

      leftEd.changeViewZones(accessor => {
        leftZoneRef.current.forEach(id => accessor.removeZone(id));
        leftZoneRef.current = [];

        for (const hunk of diffHunks) {
          const leftCount =
            hunk.leftEnd >= hunk.leftStart ? hunk.leftEnd - hunk.leftStart + 1 : 0;
          const rightCount =
            hunk.rightEnd >= hunk.rightStart ? hunk.rightEnd - hunk.rightStart + 1 : 0;

          if (rightCount > leftCount) {
            const afterLine = Math.max(0, hunk.leftStart - 1);
            const id = accessor.addZone({
              afterLineNumber: afterLine,
              heightInPx: (rightCount - leftCount) * lineHeight,
              domNode: document.createElement('div')
            });
            leftZoneRef.current.push(id);
          }
        }
      });

      rightEd.changeViewZones(accessor => {
        rightZoneRef.current.forEach(id => accessor.removeZone(id));
        rightZoneRef.current = [];

        for (const hunk of diffHunks) {
          const leftCount =
            hunk.leftEnd >= hunk.leftStart ? hunk.leftEnd - hunk.leftStart + 1 : 0;
          const rightCount =
            hunk.rightEnd >= hunk.rightStart ? hunk.rightEnd - hunk.rightStart + 1 : 0;

          if (leftCount > rightCount) {
            const afterLine = Math.max(0, hunk.rightStart - 1);
            const id = accessor.addZone({
              afterLineNumber: afterLine,
              heightInPx: (leftCount - rightCount) * lineHeight,
              domNode: document.createElement('div')
            });
            rightZoneRef.current.push(id);
          }
        }
      });
    },
    []
  );

  const runDiffCheck = useCallback(() => {
    const leftEd = leftEditorRef.current;
    const rightEd = rightEditorRef.current;
    if (!leftEd || !rightEd) return;

    const leftText = leftEd.getValue();
    const rightText = rightEd.getValue();

    if (!rightText.trim()) {
      clearDiffVisuals();
      diffCheckedRef.current = false;
      setDiffChecked(false);
      setShowPastePrompt(true);
      rightEd.focus();
      return;
    }

    const result = computeTextDiff(leftText, rightText);
    hunksRef.current = result.hunks;
    setHunks(result.hunks);
    setChangeCount(result.changeCount);
    diffCheckedRef.current = true;
    setDiffChecked(true);
    setShowPastePrompt(false);

    leftDecoRef.current = leftEd.deltaDecorations(
      leftDecoRef.current,
      highlightsToDecorations(monaco, result.leftHighlights)
    );
    rightDecoRef.current = rightEd.deltaDecorations(
      rightDecoRef.current,
      highlightsToDecorations(monaco, result.rightHighlights)
    );

    applyAlignmentZones(leftEd, rightEd, result.hunks);
    requestAnimationFrame(() => {
      leftEd.layout();
      rightEd.layout();
      updateGutterArrows();
    });
  }, [applyAlignmentZones, clearDiffVisuals, updateGutterArrows]);

  const invalidateDiff = useCallback(() => {
    if (diffCheckedRef.current) {
      diffCheckedRef.current = false;
      setDiffChecked(false);
      clearDiffVisuals();
    }
  }, [clearDiffVisuals]);

  const bindScrollSync = useCallback(
    (leftEditor: monaco.editor.IStandaloneCodeEditor, rightEditor: monaco.editor.IStandaloneCodeEditor) => {
      const syncFrom = (source: 'left' | 'right') => {
        if (scrollSyncRef.current && scrollSyncRef.current !== source) return;
        scrollSyncRef.current = source;
        const src = source === 'left' ? leftEditor : rightEditor;
        const dst = source === 'left' ? rightEditor : leftEditor;
        dst.setScrollTop(src.getScrollTop());
        dst.setScrollLeft(src.getScrollLeft());
        updateGutterArrows();
        scrollSyncRef.current = null;
      };

      leftEditor.onDidScrollChange(() => syncFrom('left'));
      rightEditor.onDidScrollChange(() => syncFrom('right'));
    },
    [updateGutterArrows]
  );

  const focusRightEditor = useCallback(() => {
    const rightEd = rightEditorRef.current;
    if (!rightEd) return;
    setShowPastePrompt(false);
    rightEd.focus();
    const model = rightEd.getModel();
    if (model && model.getLineCount() === 1 && model.getLineContent(1) === '') {
      rightEd.setPosition({ lineNumber: 1, column: 1 });
    }
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const rightEd = rightEditorRef.current;
      if (!rightEd) return;

      syncingRef.current = true;
      rightEd.setValue(text);
      syncingRef.current = false;

      setDiffComparisonCode(text);
      setRightHasContent(text.trim().length > 0);
      setShowPastePrompt(false);
      invalidateDiff();
      rightEd.focus();
    } catch {
      focusRightEditor();
    }
  }, [focusRightEditor, invalidateDiff, setDiffComparisonCode]);

  useEffect(() => {
    monaco.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // Mount dual editors
  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;

    monaco.editor.setTheme(monacoTheme);

    const leftEditor = monaco.editor.create(leftRef.current, {
      ...EDITOR_OPTS,
      value: diffOriginalCode,
      language: 'apex',
      readOnly: true
    });
    const rightEditor = monaco.editor.create(rightRef.current, {
      ...EDITOR_OPTS,
      value: diffComparisonCode || '\n',
      language: 'apex'
    });

    leftEditorRef.current = leftEditor;
    rightEditorRef.current = rightEditor;
    mountedRef.current = true;

    setRightHasContent((diffComparisonCode || '').trim().length > 0);
    setShowPastePrompt((diffComparisonCode || '').trim().length === 0);

    bindScrollSync(leftEditor, rightEditor);
    clearDiffVisuals();

    const onRightChange = rightEditor.onDidChangeModelContent(() => {
      if (syncingRef.current) return;
      const v = rightEditor.getValue();
      const trimmed = v.trim();
      setDiffComparisonCode(v);
      setRightHasContent(trimmed.length > 0);
      if (trimmed.length > 0) setShowPastePrompt(false);
      invalidateDiff();
    });

    setTimeout(() => focusRightEditor(), 150);

    const ro = new ResizeObserver(() => {
      leftEditor.layout();
      rightEditor.layout();
      updateGutterArrows();
    });
    if (splitRef.current) ro.observe(splitRef.current);

    return () => {
      onRightChange.dispose();
      ro.disconnect();
      leftEditor.dispose();
      rightEditor.dispose();
      leftEditorRef.current = null;
      rightEditorRef.current = null;
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  // Sync left from store when class changes (original file only)
  useEffect(() => {
    const leftEd = leftEditorRef.current;
    if (!leftEd || !mountedRef.current) return;
    if (leftEd.getValue() !== diffOriginalCode) {
      syncingRef.current = true;
      leftEd.setValue(diffOriginalCode);
      syncingRef.current = false;
      invalidateDiff();
    }
  }, [diffOriginalCode, invalidateDiff]);

  const goToChange = (direction: 1 | -1) => {
    if (!diffChecked || hunks.length === 0) return;
    const next =
      activeChangeIdx < 0
        ? 0
        : (activeChangeIdx + direction + hunks.length) % hunks.length;
    setActiveChangeIdx(next);
    const hunk = hunks[next];
    const line = hunk.displayLine;
    leftEditorRef.current?.revealLineInCenter(line);
    rightEditorRef.current?.revealLineInCenter(
      hunk.kind === 'add' ? hunk.rightStart : line
    );
    updateGutterArrows();
  };

  const applyLeftToEditor = useCallback(
    (updated: string) => {
      setDiffOriginalCode(updated);
      if (activeTabId) {
        updateTabBody(activeTabId, updated);
      }
    },
    [activeTabId, setDiffOriginalCode, updateTabBody]
  );

  const acceptRightToLeft = (hunk: DiffHunk) => {
    const leftEd = leftEditorRef.current;
    const left = leftEd?.getValue() ?? '';
    const right = rightEditorRef.current?.getValue() ?? '';
    const updated = applyHunkToLeft(left, right, hunk);
    syncingRef.current = true;
    leftEd?.updateOptions({ readOnly: false });
    leftEd?.setValue(updated);
    leftEd?.updateOptions({ readOnly: true });
    syncingRef.current = false;
    applyLeftToEditor(updated);
    runDiffCheck();
  };

  const acceptLeftToRight = (hunk: DiffHunk) => {
    const left = leftEditorRef.current?.getValue() ?? '';
    const right = rightEditorRef.current?.getValue() ?? '';
    const updated = applyHunkToRight(left, right, hunk);
    syncingRef.current = true;
    rightEditorRef.current?.setValue(updated);
    syncingRef.current = false;
    setDiffComparisonCode(updated);
    setRightHasContent(updated.trim().length > 0);
    runDiffCheck();
  };

  return (
    <div className="diff-checker">
      <div className="diff-toolbar">
        <div className="diff-toolbar-left">
          <span className="diff-toolbar-title">Diff Checker</span>
          <button
            type="button"
            className="diff-btn diff-btn-primary"
            onClick={runDiffCheck}
            title="Compare left and right code"
          >
            ⟳ Check Difference
          </button>
          {diffChecked && (
            <>
              <button type="button" className="diff-btn" onClick={() => goToChange(-1)} title="Previous change">
                ↑ Prev
              </button>
              <button type="button" className="diff-btn" onClick={() => goToChange(1)} title="Next change">
                ↓ Next
              </button>
              <span className="diff-stats">
                <strong>{changeCount}</strong> change{changeCount !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {!diffChecked && (
            <span className="diff-stats diff-stats-pending">Paste code on the right, then check difference</span>
          )}
        </div>

        <div className="diff-toolbar-right">
          <button type="button" className="diff-btn diff-btn-close" onClick={closeDiffChecker}>
            ✕ Close
          </button>
        </div>
      </div>

      <div className="diff-panes-labels">
        <div className="diff-pane-label">
          Original (left) — {selectedClass ? selectedClass.Name : 'current file'}
        </div>
        <div className="diff-pane-label">Compare with (right) — paste your code here</div>
      </div>

      <div className="diff-split" ref={splitRef}>
        <div className="diff-pane-host diff-pane-host-left" ref={leftRef} />
        <div className="diff-pane-host diff-pane-host-right">
          <div className="diff-pane-editor" ref={rightRef} />
          {showPastePrompt && !rightHasContent && (
            <div className="diff-paste-overlay" onClick={focusRightEditor}>
              <div className="diff-paste-card">
                <p className="diff-paste-title">Paste code to compare</p>
                <p className="diff-paste-desc">
                  Click here and press <kbd>Cmd+V</kbd> / <kbd>Ctrl+V</kbd>, or use the button below
                </p>
                <button
                  type="button"
                  className="diff-btn diff-btn-primary diff-paste-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePasteFromClipboard();
                  }}
                >
                  📋 Paste from clipboard
                </button>
              </div>
            </div>
          )}
        </div>

        {diffChecked && gutterArrows.length > 0 && (
          <div className="diff-gutter-overlay" aria-label="Merge changes">
            {gutterArrows.map(({ hunk, top }) => (
              <div key={hunk.id} className="diff-gutter-actions" style={{ top: `${top}px` }}>
                <button
                  type="button"
                  className="diff-merge-btn diff-merge-to-left"
                  onClick={() => acceptRightToLeft(hunk)}
                  title="Take right version → apply to left"
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="diff-merge-btn diff-merge-to-right"
                  onClick={() => acceptLeftToRight(hunk)}
                  title="Take left version → apply to right"
                >
                  ▶
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="diff-hint">
        {diffChecked
          ? 'Red = removed · Green = added · Use ← → at center to accept changes · Edit either side and click Check Difference again'
          : 'Step 1: Paste your comparison code on the right · Step 2: Click Check Difference'}
      </div>
    </div>
  );
}
