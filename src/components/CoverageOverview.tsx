import { useMemo, useState } from 'react';
import { useApexStore } from '../store/apex-store';
import { statsFromCoverageResult } from '../utils/coverage';
import './CoverageOverview.css';

type SortKey = 'name' | 'percentage' | 'totalLines' | 'coveredLines' | 'uncoveredLines' | 'linesNeeded';
type SortDir = 'asc' | 'desc';

type CoverageRow = {
  id: string;
  name: string;
  percentage: number;
  totalLines: number;
  coveredLines: number;
  uncoveredLines: number;
  linesNeeded: number;
  needsAttention: boolean;
};

function compareRows(a: CoverageRow, b: CoverageRow, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case 'name':
      cmp = a.name.localeCompare(b.name);
      break;
    case 'percentage':
      cmp = a.percentage - b.percentage;
      break;
    case 'totalLines':
      cmp = a.totalLines - b.totalLines;
      break;
    case 'coveredLines':
      cmp = a.coveredLines - b.coveredLines;
      break;
    case 'uncoveredLines':
      cmp = a.uncoveredLines - b.uncoveredLines;
      break;
    case 'linesNeeded':
      cmp = a.linesNeeded - b.linesNeeded;
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

export const CoverageOverview: React.FC = () => {
  const {
    classes,
    coverage,
    selectedClass,
    fetchAllCoverage,
    fetchCoverageContributors,
    isLoading,
    openTab,
    setCoverageVisible,
  } = useApexStore();

  const [sortKey, setSortKey] = useState<SortKey>('percentage');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const baseRows = useMemo(() => {
    return classes
      .map(cls => {
        const cov = coverage.get(cls.Id);
        if (!cov) return null;
        const stats = statsFromCoverageResult(cov);
        if (stats.totalLines === 0) return null;
        return { id: cls.Id, name: cls.Name, ...stats };
      })
      .filter((r): r is CoverageRow => r !== null);
  }, [classes, coverage]);

  const rows = useMemo(() => {
    const sorted = [...baseRows].sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return sorted;
  }, [baseRows, sortKey, sortDir]);

  const totalClasses = rows.length;
  const below75 = rows.filter(r => r.needsAttention).length;
  const overallPercent =
    totalClasses > 0
      ? Math.round(rows.reduce((s, r) => s + r.percentage, 0) / totalClasses)
      : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const handleViewCode = async (classId: string) => {
    await openTab(classId, { refresh: true });
    setCoverageVisible(true);
    fetchCoverageContributors(classId);
  };

  return (
    <div className="cc-panel">
      <div className="cc-toolbar">
        <div className="cc-toolbar-left">
          <span className="cc-title">
            <span className="cc-title-icon" aria-hidden>📊</span>
            Code Coverage
          </span>
          {totalClasses > 0 && (
            <div className="cc-summary">
              <span className={`cc-pill cc-pill-overall ${overallPercent >= 75 ? 'good-overall' : ''}`}>
                Overall: {overallPercent}%
              </span>
              <span className="cc-meta">{totalClasses} classes analyzed</span>
              {below75 > 0 && (
                <span className="cc-meta cc-meta-warn">
                  <span className="cc-warn-icon" aria-hidden>⚠</span>
                  {below75} below 75%
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="cc-btn-load"
          onClick={() => fetchAllCoverage()}
          disabled={isLoading}
          title="Load org-wide aggregate coverage (same as Developer Console)"
        >
          {isLoading ? 'Loading…' : 'Refresh org coverage'}
        </button>
      </div>

      {totalClasses === 0 ? (
        <div className="cc-empty">
          <p>No coverage data yet.</p>
          <p className="cc-empty-hint">Run tests or click Refresh org coverage.</p>
        </div>
      ) : (
        <div className="cc-table-wrap">
          <table className="cc-table">
            <thead>
              <tr>
                <th className="cc-th-sortable" onClick={() => handleSort('name')}>
                  Class Name{sortIndicator('name')}
                </th>
                <th className="cc-th-sortable cc-th-pct" onClick={() => handleSort('percentage')}>
                  Coverage %{sortIndicator('percentage')}
                </th>
                <th className="cc-th-sortable cc-th-lines" onClick={() => handleSort('totalLines')}>
                  Lines{sortIndicator('totalLines')}
                </th>
                <th className="cc-th-sortable" onClick={() => handleSort('coveredLines')}>
                  Covered{sortIndicator('coveredLines')}
                </th>
                <th className="cc-th-sortable" onClick={() => handleSort('uncoveredLines')}>
                  Uncovered{sortIndicator('uncoveredLines')}
                </th>
                <th className="cc-th-sortable" onClick={() => handleSort('linesNeeded')}>
                  To 75%{sortIndicator('linesNeeded')}
                </th>
                <th className="cc-th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  className={`${row.needsAttention ? 'cc-row-warn' : ''} ${
                    selectedClass?.Id === row.id ? 'cc-row-selected' : ''
                  }`}
                >
                  <td className="cc-td-name">{row.name}</td>
                  <td className="cc-td-pct">
                    <div className="cc-bar-track">
                      <div
                        className={`cc-bar-fill ${row.percentage >= 75 ? 'good' : row.percentage >= 50 ? 'mid' : 'low'}`}
                        style={{ width: `${Math.max(row.percentage, 4)}%` }}
                      />
                      <span className="cc-bar-label">{row.percentage}%</span>
                    </div>
                  </td>
                  <td className="cc-td-num">{row.totalLines}</td>
                  <td className="cc-td-num cc-covered">{row.coveredLines}</td>
                  <td className="cc-td-num cc-uncovered">{row.uncoveredLines}</td>
                  <td className="cc-td-num">
                    {row.linesNeeded > 0 ? (
                      <span className="cc-needed">+{row.linesNeeded}</span>
                    ) : (
                      <span className="cc-met">—</span>
                    )}
                  </td>
                  <td className="cc-td-action">
                    <button
                      type="button"
                      className="cc-btn-view"
                      onClick={() => handleViewCode(row.id)}
                    >
                      View Code
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
