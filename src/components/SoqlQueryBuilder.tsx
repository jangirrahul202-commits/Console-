import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApexStore } from '../store/apex-store';
import { SalesforceAPI } from '../api/salesforce-api';
import type { SavedSoqlQuery, SoqlQueryHistoryEntry } from '../types';
import { extractFromObject, getSoqlContext, getFieldPartialInSelect } from '../utils/soql-parse';
import { insertAtCursor } from '../utils/soql-autocomplete';
import {
  getFieldSuggestionContext,
  buildContextFieldSuggestions,
  filterSoqlFieldSuggestions,
  filterObjectSuggestions,
  getFieldTypeIcon
} from '../utils/soql-field-suggestions';
import {
  flattenRecords,
  toCsv,
  toTsv,
  toJson,
  copyToClipboard,
  downloadBlob,
  downloadExcel,
  downloadPdf
} from '../utils/soql-export';
import { formatSoql } from '../utils/soql-format';
import { getLimitWarning, appendLimit } from '../utils/soql-validate';
import {
  isCursorInWhereClause,
  getWhereSuggestionContext,
  buildWhereSuggestions,
  buildCountQuery,
  type WhereSuggestion
} from '../utils/soql-where-assistant';
import './SoqlQueryBuilder.css';

const SHORTCUTS = [
  { keys: '⌘/Ctrl + Enter', action: 'Run query' },
  { keys: '⌘/Ctrl + S', action: 'Save query (with label)' },
  { keys: '⌘/Ctrl + Shift + F', action: 'Format SOQL' },
  { keys: 'Esc', action: 'Clear result search / cancel query' },
  { keys: '⌘/Ctrl + W', action: 'Close current query tab' },
  { keys: '?', action: 'Show keyboard shortcuts' }
];

const TEMPLATES = [
  { label: 'Account — Id & Name', query: 'SELECT Id, Name FROM Account LIMIT 200' },
  { label: 'Contact — basic fields', query: 'SELECT Id, FirstName, LastName, Email FROM Contact LIMIT 200' },
  { label: 'Opportunity — pipeline', query: 'SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT 200' },
  { label: 'User — active users', query: 'SELECT Id, Name, Username, IsActive FROM User WHERE IsActive = true LIMIT 200' },
  { label: 'ApexClass — metadata', query: 'SELECT Id, Name, Status, ApiVersion FROM ApexClass ORDER BY Name LIMIT 200' }
];

const HISTORY_KEY = 'soqlQueryHistory';
const SAVED_KEY = 'soqlSavedQueries';

interface QueryTab {
  id: string;
  label: string;
  query: string;
}

function newTab(query = 'SELECT Id, Name FROM Account LIMIT 200'): QueryTab {
  const objectName = extractFromObject(query);
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: objectName || 'Query',
    query
  };
}

export default function SoqlQueryBuilder() {
  const {
    session,
    closeSoqlBuilder,
    soqlAllObjects,
    soqlObjectFields,
    soqlQueryResult,
    soqlInitialQuery,
    soqlLoading,
    soqlError,
    soqlLastDurationMs,
    soqlFetchProgress,
    executeSoqlQuery,
    cancelSoqlQuery,
    getAllObjects,
    getObjectFields,
    setSoqlError
  } = useApexStore();

  const [tabs, setTabs] = useState<QueryTab[]>(() => [newTab(soqlInitialQuery || undefined)]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [cursorPos, setCursorPos] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [toolingApi, setToolingApi] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [queryPanelHeight, setQueryPanelHeight] = useState(280);
  const [history, setHistory] = useState<SoqlQueryHistoryEntry[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedSoqlQuery[]>([]);
  const [saveLabel, setSaveLabel] = useState('');
  const [showFieldInfo, setShowFieldInfo] = useState(false);
  const [showQueryPlan, setShowQueryPlan] = useState(false);
  const [queryPlanText, setQueryPlanText] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [limitWarning, setLimitWarning] = useState<{ message: string } | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const query = activeTab?.query ?? '';
  const fromObject = extractFromObject(query);

  const context = useMemo(
    () => getSoqlContext(query, cursorPos),
    [query, cursorPos]
  );

  const isFromContext = context.type === 'object';
  const allFieldsForObject = fromObject ? (soqlObjectFields.get(fromObject) ?? []) : [];
  const isWhereContext = useMemo(
    () => isCursorInWhereClause(query, cursorPos),
    [query, cursorPos]
  );

  const whereContext = useMemo(() => {
    if (!isWhereContext || !fromObject) return null;
    return getWhereSuggestionContext(query, cursorPos);
  }, [isWhereContext, fromObject, query, cursorPos]);

  const whereSuggestions = useMemo(() => {
    if (!whereContext || !allFieldsForObject.length) return [];
    return buildWhereSuggestions(whereContext, allFieldsForObject, whereContext.partial);
  }, [whereContext, allFieldsForObject]);

  const objectSuggestions = useMemo(() => {
    if (!isFromContext) return [];
    return filterObjectSuggestions(soqlAllObjects, context.partial);
  }, [isFromContext, context.partial, soqlAllObjects]);

  const fieldSuggestionContext = useMemo(() => {
    if (!fromObject || !allFieldsForObject.length || isFromContext || isWhereContext) return null;
    return getFieldSuggestionContext(
      query,
      cursorPos,
      fromObject,
      allFieldsForObject,
      soqlObjectFields,
      soqlAllObjects
    );
  }, [fromObject, allFieldsForObject, isFromContext, isWhereContext, query, cursorPos, soqlObjectFields, soqlAllObjects]);

  const contextFields = fieldSuggestionContext
    ? (soqlObjectFields.get(fieldSuggestionContext.contextObject) ?? [])
    : [];

  const displayFieldSuggestions = useMemo(() => {
    if (!fieldSuggestionContext || !contextFields.length) return [];
    const all = buildContextFieldSuggestions(
      fieldSuggestionContext,
      contextFields,
      soqlAllObjects
    );
    return filterSoqlFieldSuggestions(all, fieldSuggestionContext.fieldPartial);
  }, [fieldSuggestionContext, contextFields, soqlAllObjects, soqlObjectFields]);

  const fieldPartial = fieldSuggestionContext?.fieldPartial ?? '';

  const { rows: flatRows, columns } = useMemo(() => {
    if (!soqlQueryResult?.records?.length) return { rows: [], columns: [] as string[] };
    return flattenRecords(soqlQueryResult.records);
  }, [soqlQueryResult]);

  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return flatRows;
    const q = filterText.toLowerCase();
    return flatRows.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(q))
    );
  }, [flatRows, filterText]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = a[sortColumn] ?? '';
      const bv = b[sortColumn] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const updateActiveQuery = useCallback((nextQuery: string, label?: string) => {
    setTabs(prev => prev.map(t =>
      t.id === activeTabId
        ? {
            ...t,
            query: nextQuery,
            label: label ?? (extractFromObject(nextQuery) || t.label)
          }
        : t
    ));
  }, [activeTabId]);

  useEffect(() => {
    getAllObjects();
  }, [getAllObjects]);

  useEffect(() => {
    if (fromObject) getObjectFields(fromObject);
  }, [fromObject, getObjectFields]);

  useEffect(() => {
    if (fieldSuggestionContext?.contextObject) {
      getObjectFields(fieldSuggestionContext.contextObject);
    }
  }, [fieldSuggestionContext?.contextObject, getObjectFields]);

  useEffect(() => {
    chrome.storage.local.get([HISTORY_KEY, SAVED_KEY], result => {
      if (result[HISTORY_KEY]) setHistory(result[HISTORY_KEY]);
      if (result[SAVED_KEY]) setSavedQueries(result[SAVED_KEY]);
    });
  }, []);

  const executeRunQuery = useCallback(async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    setSoqlError(null);
    setSortColumn(null);
    let finalQuery = trimmed;
    if (includeDeleted && !/\bALL\s+ROWS\b/i.test(finalQuery)) {
      finalQuery += ' ALL ROWS';
    }
    await executeSoqlQuery(finalQuery, { toolingApi, fetchAll: true });
    const result = useApexStore.getState().soqlQueryResult;
    const duration = useApexStore.getState().soqlLastDurationMs ?? 0;
    if (result) {
      const entry: SoqlQueryHistoryEntry = {
        query: trimmed,
        ranAt: Date.now(),
        recordCount: result.records.length,
        durationMs: duration
      };
      setHistory(prev => {
        const next = [entry, ...prev.filter(h => h.query !== entry.query)].slice(0, 30);
        void chrome.storage.local.set({ [HISTORY_KEY]: next });
        return next;
      });
    }
  }, [includeDeleted, toolingApi, executeSoqlQuery]);

  const handleRunQuery = (skipLimitCheck = false) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (!skipLimitCheck) {
      const warning = getLimitWarning(trimmed);
      if (warning.shouldWarn) {
        setLimitWarning({ message: warning.message });
        return;
      }
    }
    void executeRunQuery(trimmed);
  };

  const handleAddLimitAndRun = () => {
    const withLimit = appendLimit(query);
    updateActiveQuery(withLimit);
    setLimitWarning(null);
    void executeRunQuery(withLimit);
  };

  const handleFormatQuery = () => {
    updateActiveQuery(formatSoql(query));
    editorRef.current?.focus();
  };

  const toggleSort = (col: string) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const handleCellCopy = async (value: string, cellId: string) => {
    if (!value) return;
    await copyToClipboard(value);
    setCopiedCell(cellId);
    setTimeout(() => setCopiedCell(null), 1200);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      handleRunQuery();
    } else if (mod && e.key === 's') {
      e.preventDefault();
      if (saveLabel.trim()) void handleSaveQuery();
    } else if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      handleFormatQuery();
    } else if (e.key === 'Escape') {
      if (soqlLoading) {
        e.preventDefault();
        cancelSoqlQuery();
      } else if (filterText) {
        e.preventDefault();
        setFilterText('');
        filterRef.current?.focus();
      }
    }
  };

  const applyObjectSuggestion = (name: string) => {
    const partialLen = context.partial.length;
    const { text, cursor } = insertAtCursor(query, cursorPos, name, partialLen);
    updateActiveQuery(text, name);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(cursor, cursor);
      setCursorPos(cursor);
    });
  };

  const applyWhereSuggestion = (suggestion: WhereSuggestion) => {
    if (!whereContext) return;
    const start = whereContext.partialStart;
    const partialLen = whereContext.partial.length;
    const insert = suggestion.insert;
    const nextQuery = query.slice(0, start) + insert + query.slice(start + partialLen);
    updateActiveQuery(nextQuery);
    const newCursor = start + insert.length;
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(newCursor, newCursor);
      setCursorPos(newCursor);
    });
  };

  const handleCountQuery = () => {
    const countQuery = buildCountQuery(query);
    if (!countQuery) return;
    updateActiveQuery(countQuery);
    void executeRunQuery(countQuery);
  };

  const applyFieldSuggestion = (fieldPath: string) => {
    const partial = getFieldPartialInSelect(query, cursorPos);
    const partialStart = cursorPos - partial.length;

    if (partial.length > 0) {
      const nextQuery = query.slice(0, partialStart) + fieldPath + query.slice(cursorPos);
      updateActiveQuery(nextQuery);
      const newCursor = partialStart + fieldPath.length;
      requestAnimationFrame(() => {
        editorRef.current?.focus();
        editorRef.current?.setSelectionRange(newCursor, newCursor);
        setCursorPos(newCursor);
      });
      return;
    }

    const upper = query.toUpperCase();
    const fromIdx = upper.indexOf(' FROM ');
    const selectPart = fromIdx > -1 ? query.slice(0, fromIdx) : query;
    const rest = fromIdx > -1 ? query.slice(fromIdx) : '';

    let nextSelect: string;
    if (/^SELECT\s+\*/i.test(selectPart.trim()) || /^SELECT\s*$/i.test(selectPart.trim())) {
      nextSelect = `SELECT ${fieldPath}`;
    } else if (/^SELECT\s+/i.test(selectPart)) {
      const trimmed = selectPart.trimEnd();
      nextSelect = trimmed.endsWith(',') ? `${trimmed} ${fieldPath}` : `${trimmed}, ${fieldPath}`;
    } else {
      nextSelect = `SELECT ${fieldPath}`;
    }
    updateActiveQuery(`${nextSelect}${rest}`);
    editorRef.current?.focus();
  };

  const handleExportQuery = () => {
    downloadBlob(query, 'query.soql', 'text/plain');
  };

  const handleQueryPlan = async () => {
    if (!session || !query.trim()) return;
    setPlanLoading(true);
    setShowQueryPlan(true);
    setQueryPlanText('Loading query plan...');
    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const plan = await api.explainQuery(query.trim());
      const lines = plan.plans?.map((p, i) => {
        const notes = p.notes?.map(n => `  • ${n.title}: ${n.description}`).join('\n') ?? '';
        return `Plan ${i + 1}\n  Leading op: ${p.leadingOperationType ?? '—'}\n  Cardinality: ${p.cardinality ?? '—'}\n${notes}`;
      }) ?? ['No plan data returned'];
      setQueryPlanText(lines.join('\n\n'));
    } catch (err: unknown) {
      setQueryPlanText(err instanceof Error ? err.message : 'Failed to load query plan');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!saveLabel.trim() || !query.trim()) return;
    const entry: SavedSoqlQuery = {
      id: `saved-${Date.now()}`,
      label: saveLabel.trim(),
      query: query.trim(),
      savedAt: Date.now()
    };
    const next = [entry, ...savedQueries];
    setSavedQueries(next);
    setSaveLabel('');
    await chrome.storage.local.set({ [SAVED_KEY]: next });
  };

  const handleDeleteRecords = async () => {
    if (!session || !fromObject) return;
    const ids = filteredRows.map(r => r.Id).filter(Boolean);
    if (!ids.length) return;
    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      await api.deleteRecords(ids);
      setDeleteConfirm(false);
      await handleRunQuery();
    } catch (err: unknown) {
      setSoqlError(err instanceof Error ? err.message : 'Delete failed');
      setDeleteConfirm(false);
    }
  };

  const exportData = { columns, rows: sortedRows };

  const addTab = () => {
    const tab = newTab();
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const closeTab = useCallback((tabId: string) => {
    if (tabId === activeTabId && soqlLoading) {
      cancelSoqlQuery();
    }

    setTabs(prev => {
      if (prev.length === 1) {
        closeSoqlBuilder();
        return prev;
      }

      const idx = prev.findIndex(t => t.id === tabId);
      const next = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[Math.max(0, idx - 1)].id);
      }
      return next;
    });
  }, [activeTabId, soqlLoading, cancelSoqlQuery, closeSoqlBuilder]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(s => !s);
      } else if (e.key === 'Escape') {
        setShowShortcuts(false);
        setLimitWarning(null);
        if (soqlLoading) {
          cancelSoqlQuery();
        } else if (filterText) {
          setFilterText('');
          filterRef.current?.focus();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        closeTab(activeTabId);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filterText, soqlLoading, activeTabId, cancelSoqlQuery, closeTab]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setQueryPanelHeight(Math.max(160, Math.min(window.innerHeight * 0.6, e.clientY - 50)));
    };
    const onUp = () => { isResizing.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const recordLink = (id: string) =>
    session ? `${session.instanceUrl}/${id}` : '#';

  const showSchemaPanel = isFromContext
    || (fromObject && allFieldsForObject.length > 0 && (isWhereContext || !isFromContext));
  const schemaCount = isFromContext
    ? objectSuggestions.length
    : isWhereContext
      ? whereSuggestions.length
      : displayFieldSuggestions.length;
  const schemaFilter = isFromContext
    ? context.partial
    : isWhereContext
      ? (whereContext?.partial ?? '')
      : fieldPartial;
  const schemaTitle = isFromContext
    ? 'Objects'
    : isWhereContext
      ? 'WHERE'
      : (fieldSuggestionContext?.contextObjectLabel ?? fromObject ?? 'Fields');

  return (
    <div className="soql-builder">
      <header className="soql-page-header">
        <div className="soql-page-title">
          <h2>Data Explorer</h2>
          <span>Query, preview, and export Salesforce records</span>
        </div>
        <div className="soql-page-actions">
          <div className="soql-library-group soql-toolbar-group">
            <select
              className="soql-select"
              defaultValue=""
              title="Templates"
              onChange={e => {
                const t = TEMPLATES.find(x => x.query === e.target.value);
                if (t) updateActiveQuery(t.query);
                e.target.value = '';
              }}
            >
              <option value="" disabled>Templates</option>
              {TEMPLATES.map(t => (
                <option key={t.query} value={t.query}>{t.label}</option>
              ))}
            </select>
            <select
              className="soql-select"
              defaultValue=""
              title="History"
              onChange={e => {
                if (e.target.value) updateActiveQuery(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="" disabled>History</option>
              {history.map(h => (
                <option key={`${h.ranAt}-${h.query}`} value={h.query}>
                  {h.recordCount} rows · {h.query.slice(0, 50)}…
                </option>
              ))}
            </select>
            <select
              className="soql-select"
              defaultValue=""
              title="Saved"
              onChange={e => {
                const s = savedQueries.find(x => x.id === e.target.value);
                if (s) updateActiveQuery(s.query);
                e.target.value = '';
              }}
            >
              <option value="" disabled>Saved</option>
              {savedQueries.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <input
              className="soql-input"
              placeholder="Save as…"
              value={saveLabel}
              onChange={e => setSaveLabel(e.target.value)}
            />
            <button type="button" className="soql-btn soql-btn-ghost" onClick={handleSaveQuery}>
              Save
            </button>
          </div>
          <button
            type="button"
            className="soql-btn soql-btn-ghost"
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
          <button type="button" className="soql-btn soql-btn-ghost" onClick={closeSoqlBuilder}>
            ← Editor
          </button>
        </div>
      </header>

      <div className="soql-workspace">
        <section className="soql-composer-card" style={{ height: queryPanelHeight }}>
          <div className="soql-composer-header">
            <div className="soql-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`soql-tab ${tab.id === activeTabId ? 'active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span className="soql-tab-label">{tab.label}</span>
                  <button
                    type="button"
                    className="soql-tab-close"
                    onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                    title={tabs.length === 1 ? 'Close tab and return to editor' : 'Close tab'}
                    aria-label={`Close ${tab.label}`}
                  >
                    ×
                  </button>
                </button>
              ))}
              <button type="button" className="soql-tab soql-tab-add" onClick={addTab}>+</button>
            </div>
            {soqlLoading ? (
              <button
                type="button"
                className="soql-btn soql-btn-danger"
                onClick={cancelSoqlQuery}
                title="Cancel running query"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="soql-run-btn"
                onClick={() => handleRunQuery()}
                title="Run query (⌘/Ctrl + Enter)"
              >
                <span className="soql-run-btn-icon">▶</span>
                Run Query
              </button>
            )}
            {soqlFetchProgress && (
              <span className="soql-fetch-progress">
                Page {soqlFetchProgress.page} · {soqlFetchProgress.fetched.toLocaleString()}
                {soqlFetchProgress.total > 0 && ` / ${soqlFetchProgress.total.toLocaleString()}`}
              </span>
            )}
          </div>

          <div className="soql-query-panel">
            <div className="soql-editor-wrap">
              <div className="soql-editor-gutter" aria-hidden>SOQL</div>
              <textarea
                ref={editorRef}
                className="soql-editor"
                value={query}
                spellCheck={false}
                onChange={e => {
                  updateActiveQuery(e.target.value);
                  setCursorPos(e.target.selectionStart);
                }}
                onClick={e => setCursorPos(e.currentTarget.selectionStart)}
                onKeyUp={e => setCursorPos(e.currentTarget.selectionStart)}
                onKeyDown={handleEditorKeyDown}
                placeholder="SELECT Id, Name FROM Account LIMIT 200"
              />
            </div>

            {showSchemaPanel && (
              <div className="soql-schema-panel">
                <div className="soql-schema-header">
                  <span className="soql-schema-label">Schema</span>
                  <span className="soql-schema-context">{schemaTitle}</span>
                  {schemaFilter && (
                    <span className="soql-schema-filter">matching &quot;{schemaFilter}&quot;</span>
                  )}
                  <span className="soql-schema-count">{schemaCount}</span>
                </div>
                <div className="soql-schema-list">
                  {isFromContext ? (
                    objectSuggestions.length === 0 ? (
                      <span className="soql-schema-empty">
                        {context.partial ? `No objects match "${context.partial}"` : 'Type after FROM'}
                      </span>
                    ) : (
                      objectSuggestions.map(o => (
                        <button
                          key={o.name}
                          type="button"
                          className="soql-schema-item"
                          onClick={() => applyObjectSuggestion(o.name)}
                          title={o.label}
                        >
                          <span className="soql-field-icon soql-field-icon-object" aria-hidden>📦</span>
                          <span className="soql-field-path">{o.name}</span>
                          <span className="soql-field-object">{o.label}</span>
                        </button>
                      ))
                    )
                  ) : isWhereContext ? (
                    whereSuggestions.length === 0 ? (
                      <span className="soql-schema-empty">
                        Type a field, operator, or picklist value in WHERE
                      </span>
                    ) : (
                      whereSuggestions.map(s => (
                        <button
                          key={`${s.kind}-${s.insert}-${s.label}`}
                          type="button"
                          className={`soql-schema-item soql-schema-item-${s.kind}`}
                          onClick={() => applyWhereSuggestion(s)}
                          title={s.label}
                        >
                          <span className="soql-field-icon" aria-hidden>
                            {s.kind === 'operator' ? '=' : s.kind === 'picklist' ? '▾' : s.kind === 'literal' ? '📅' : '◇'}
                          </span>
                          <span className="soql-field-path">{s.insert.trim()}</span>
                          {s.label !== s.insert.trim() && (
                            <span className="soql-field-object">{s.label}</span>
                          )}
                        </button>
                      ))
                    )
                  ) : displayFieldSuggestions.length === 0 ? (
                    <span className="soql-schema-empty">No fields match &quot;{fieldPartial}&quot;</span>
                  ) : (
                    displayFieldSuggestions.map(s => (
                      <button
                        key={s.path}
                        type="button"
                        className={`soql-schema-item ${s.isRelDrill ? 'soql-schema-item-drill' : ''}`}
                        onClick={() => applyFieldSuggestion(s.path)}
                        title={`${s.label} · ${s.objectLabel} (${s.type})`}
                      >
                        <span className="soql-field-icon" aria-hidden>
                          {getFieldTypeIcon(s.type, s.isRelDrill || s.isRelationship)}
                        </span>
                        <span className="soql-field-path">{s.path}</span>
                        <span className="soql-field-object">{s.objectName}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="soql-composer-footer">
              <div className="soql-composer-footer-actions">
                <button
                  type="button"
                  className="soql-btn soql-btn-ghost"
                  onClick={handleCountQuery}
                  disabled={!fromObject || soqlLoading}
                  title="Run COUNT() with current WHERE clause"
                >
                  Count
                </button>
                <button
                  type="button"
                  className="soql-btn soql-btn-ghost"
                  onClick={handleFormatQuery}
                  title="Format SOQL (⌘/Ctrl + Shift + F)"
                >
                  Format
                </button>
                <button type="button" className="soql-btn soql-btn-ghost" onClick={handleExportQuery}>
                  Save .soql
                </button>
                <button type="button" className="soql-btn soql-btn-ghost" onClick={handleQueryPlan} disabled={planLoading}>
                  Explain
                </button>
                <button
                  type="button"
                  className="soql-btn soql-btn-ghost soql-btn-close-tab"
                  onClick={() => closeTab(activeTabId)}
                  title={tabs.length === 1 ? 'Close tab and return to editor (⌘/Ctrl + W)' : 'Close current tab (⌘/Ctrl + W)'}
                >
                  Close tab
                </button>
                <button
                  type="button"
                  className="soql-btn soql-btn-ghost"
                  onClick={() => setShowFieldInfo(true)}
                  disabled={!fromObject}
                >
                  Schema Info
                </button>
              </div>
              <div className="soql-options">
                <label>
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={e => setIncludeDeleted(e.target.checked)}
                  />
                  Include deleted
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={toolingApi}
                    onChange={e => setToolingApi(e.target.checked)}
                  />
                  Tooling API
                </label>
              </div>
            </div>
          </div>
        </section>

        <div
          className="soql-resize-handle"
          onMouseDown={() => { isResizing.current = true; }}
        />

        {soqlError && <div className="soql-error-banner">{soqlError}</div>}

        <section className="soql-results-panel">
          <div className="soql-results-header">
            <span className="soql-results-title">Results</span>
            <div className="soql-stat-badges">
              {soqlQueryResult && (
                <>
                  <span className="soql-stat-badge soql-stat-badge-accent">
                    <strong>{filterText ? sortedRows.length : flatRows.length}</strong> rows
                  </span>
                  {soqlLastDurationMs != null && (
                    <span className="soql-stat-badge">
                      <strong>{soqlLastDurationMs}</strong> ms
                    </span>
                  )}
                  {filterText && (
                    <span className="soql-stat-badge">
                      filtered from <strong>{flatRows.length}</strong>
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="soql-search-wrap">
              <span className="soql-search-icon" aria-hidden>⌕</span>
              <input
                ref={filterRef}
                className="soql-input soql-filter-input"
                placeholder="Search results… (Esc to clear)"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setFilterText('');
                  }
                }}
              />
            </div>
            <div className="soql-export-group">
              <button
                type="button"
                className="soql-btn"
                disabled={!filteredRows.length}
                onClick={() => copyToClipboard(toTsv(exportData.columns, exportData.rows))}
              >
                Excel
              </button>
              <button
                type="button"
                className="soql-btn"
                disabled={!filteredRows.length}
                onClick={() => copyToClipboard(toCsv(exportData.columns, exportData.rows))}
              >
                CSV
              </button>
              <button
                type="button"
                className="soql-btn"
                disabled={!filteredRows.length}
                onClick={() => copyToClipboard(toJson(exportData.rows))}
              >
                JSON
              </button>
              <button
                type="button"
                className="soql-btn"
                disabled={!filteredRows.length}
                onClick={() => downloadExcel(exportData.columns, exportData.rows, 'export.xlsx')}
              >
                .xlsx
              </button>
              <button
                type="button"
                className="soql-btn"
                disabled={!filteredRows.length}
                onClick={() => downloadPdf(exportData.columns, exportData.rows, 'export.pdf')}
              >
                .pdf
              </button>
              <button
                type="button"
                className="soql-btn soql-btn-danger"
                disabled={!filteredRows.length || !fromObject}
                onClick={() => setDeleteConfirm(true)}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="soql-results-table-wrap">
            {!soqlQueryResult ? (
              <div className="soql-empty-state">
                <span className="soql-empty-icon">⊞</span>
                <h3>No data yet</h3>
                <p>Write a SOQL query above and click Run Query to preview records here.</p>
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="soql-empty-state">
                <span className="soql-empty-icon">⌕</span>
                <h3>No matching rows</h3>
                <p>Try adjusting your search filter or query.</p>
              </div>
            ) : (
              <table className="soql-data-grid">
                <thead>
                  <tr>
                    <th className="soql-row-num-header">#</th>
                    {columns.map(col => (
                      <th
                        key={col}
                        className={`soql-sortable-th ${sortColumn === col ? `soql-sorted-${sortDirection}` : ''}`}
                        onClick={() => toggleSort(col)}
                        title="Click to sort · click cell to copy"
                      >
                        {col}
                        {sortColumn === col && (
                          <span className="soql-sort-icon">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, ri) => (
                    <tr key={ri}>
                      <td className="soql-row-num">{ri + 1}</td>
                      {columns.map(col => {
                        const val = row[col] ?? '';
                        const cellId = `${ri}-${col}`;
                        if (col === 'Id' && val && session) {
                          return (
                            <td
                              key={col}
                              className={`soql-cell-copyable ${copiedCell === cellId ? 'soql-cell-copied' : ''}`}
                              onClick={() => handleCellCopy(val, cellId)}
                              title="Click to copy"
                            >
                              <a
                                href={recordLink(val)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                              >
                                {val}
                              </a>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={col}
                            className={`soql-cell-copyable ${copiedCell === cellId ? 'soql-cell-copied' : ''}`}
                            title={val ? `${val} — click to copy` : 'Click to copy'}
                            onClick={() => handleCellCopy(val, cellId)}
                          >
                            {copiedCell === cellId ? '✓ Copied' : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {showFieldInfo && fromObject && (
        <div className="soql-modal-overlay" onClick={() => setShowFieldInfo(false)}>
          <div className="soql-modal" onClick={e => e.stopPropagation()}>
            <div className="soql-modal-header">
              <h3>{fromObject} — Field Info</h3>
              <button type="button" className="soql-btn" onClick={() => setShowFieldInfo(false)}>×</button>
            </div>
            <div className="soql-modal-body">
              <table className="soql-modal-table">
                <thead>
                  <tr>
                    <th>API Name</th>
                    <th>Label</th>
                    <th>Type</th>
                    <th>Custom</th>
                  </tr>
                </thead>
                <tbody>
                  {allFieldsForObject.map(f => (
                    <tr key={f.name}>
                      <td><code>{f.name}</code></td>
                      <td>{f.label}</td>
                      <td>{f.type}</td>
                      <td>{f.custom ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showQueryPlan && (
        <div className="soql-modal-overlay" onClick={() => setShowQueryPlan(false)}>
          <div className="soql-modal" onClick={e => e.stopPropagation()}>
            <div className="soql-modal-header">
              <h3>Query Plan</h3>
              <button type="button" className="soql-btn" onClick={() => setShowQueryPlan(false)}>×</button>
            </div>
            <div className="soql-modal-body">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{queryPlanText}</pre>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="soql-modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="soql-modal soql-shortcuts-modal" onClick={e => e.stopPropagation()}>
            <div className="soql-modal-header">
              <h3>Keyboard shortcuts</h3>
              <button type="button" className="soql-btn" onClick={() => setShowShortcuts(false)}>×</button>
            </div>
            <div className="soql-modal-body">
              <table className="soql-shortcuts-table">
                <tbody>
                  {SHORTCUTS.map(s => (
                    <tr key={s.keys}>
                      <td><kbd>{s.keys}</kbd></td>
                      <td>{s.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="soql-shortcuts-tip">Click any result cell to copy its value.</p>
            </div>
          </div>
        </div>
      )}

      {limitWarning && (
        <div className="soql-modal-overlay" onClick={() => setLimitWarning(null)}>
          <div className="soql-modal soql-limit-modal" onClick={e => e.stopPropagation()}>
            <div className="soql-modal-header">
              <h3>No LIMIT clause</h3>
            </div>
            <div className="soql-modal-body">
              <p>{limitWarning.message}</p>
              <div className="soql-limit-actions">
                <button type="button" className="soql-btn soql-btn-primary" onClick={handleAddLimitAndRun}>
                  Add LIMIT 200 &amp; Run
                </button>
                <button
                  type="button"
                  className="soql-btn"
                  onClick={() => {
                    setLimitWarning(null);
                    void executeRunQuery(query);
                  }}
                >
                  Run anyway
                </button>
                <button type="button" className="soql-btn soql-btn-ghost" onClick={() => setLimitWarning(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="soql-modal-overlay" onClick={() => setDeleteConfirm(false)}>
          <div className="soql-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="soql-modal-header">
              <h3>Delete {filteredRows.length} records?</h3>
            </div>
            <div className="soql-modal-body">
              <p>This permanently deletes the filtered result records from your org. This cannot be undone.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="soql-btn soql-btn-danger" onClick={handleDeleteRecords}>
                  Delete
                </button>
                <button type="button" className="soql-btn" onClick={() => setDeleteConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
