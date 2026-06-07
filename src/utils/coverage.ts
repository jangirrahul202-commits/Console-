// Salesforce coverage parsing and calculations
// Use ApexCodeCoverageAggregate for org-wide totals (matches Developer Console).
// ApexCodeCoverage is per test-method and understates coverage for a class.

import type { CoverageLocation, CoverageResult } from '../types';

export interface ParsedCoverageField {
  coveredLines: number[];
  uncoveredLines: number[];
}

/** Normalize Coverage from Tooling API (object, JSON string, or legacy tuple). */
export function parseCoverageField(raw: unknown): ParsedCoverageField {
  const empty = { coveredLines: [], uncoveredLines: [] };
  if (raw == null) return empty;

  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return empty;
    }
  }

  if (Array.isArray(data)) {
    if (data.length >= 2 && Array.isArray(data[0]) && Array.isArray(data[1])) {
      return {
        coveredLines: data[0].map(Number).filter(n => !Number.isNaN(n)),
        uncoveredLines: data[1].map(Number).filter(n => !Number.isNaN(n))
      };
    }
    if (data.every((x: unknown) => typeof x === 'object' && x !== null && 'line' in (x as object))) {
      const covered: number[] = [];
      const uncovered: number[] = [];
      for (const item of data as Array<{ line: number; covered?: number | boolean }>) {
        const line = Number(item.line);
        if (Number.isNaN(line)) continue;
        const isCovered = item.covered === 1 || item.covered === true;
        if (isCovered) covered.push(line);
        else uncovered.push(line);
      }
      return { coveredLines: covered, uncoveredLines: uncovered };
    }
    return empty;
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const covered = obj.coveredLines ?? obj.CoveredLines;
    const uncovered = obj.uncoveredLines ?? obj.UncoveredLines;
    return {
      coveredLines: Array.isArray(covered) ? covered.map(Number).filter(n => !Number.isNaN(n)) : [],
      uncoveredLines: Array.isArray(uncovered) ? uncovered.map(Number).filter(n => !Number.isNaN(n)) : []
    };
  }

  return empty;
}

export function coverageLocationsFromField(raw: unknown): CoverageLocation[] {
  const { coveredLines, uncoveredLines } = parseCoverageField(raw);
  const locations: CoverageLocation[] = [];
  for (const line of coveredLines) {
    locations.push({ line, covered: 1 });
  }
  for (const line of uncoveredLines) {
    locations.push({ line, covered: 0 });
  }
  return locations.sort((a, b) => a.line - b.line);
}

/** Percentage from aggregate line counts (same formula as Salesforce). */
export function coveragePercent(covered: number, uncovered: number): number {
  const total = covered + uncovered;
  if (total <= 0) return 0;
  return Math.round((covered / total) * 100);
}

export function linesNeededFor75(covered: number, uncovered: number): number {
  const total = covered + uncovered;
  if (total <= 0) return 0;
  const target = Math.ceil(total * 0.75);
  return Math.max(0, target - covered);
}

export interface CoverageRowStats {
  percentage: number;
  totalLines: number;
  coveredLines: number;
  uncoveredLines: number;
  linesNeeded: number;
  needsAttention: boolean;
}

export function statsFromCoverageResult(cov: CoverageResult): CoverageRowStats {
  const coveredLines = cov.NumLinesCovered ?? 0;
  const uncoveredLines = cov.NumLinesUncovered ?? 0;
  const percentage = coveragePercent(coveredLines, uncoveredLines);
  return {
    percentage,
    totalLines: coveredLines + uncoveredLines,
    coveredLines,
    uncoveredLines,
    linesNeeded: linesNeededFor75(coveredLines, uncoveredLines),
    needsAttention: percentage < 75
  };
}

/** Build store-ready result from aggregate API record. */
export function normalizeAggregateCoverageRecord(record: {
  ApexClassOrTriggerId: string;
  NumLinesCovered: number;
  NumLinesUncovered: number;
  Coverage?: unknown;
}): CoverageResult {
  return {
    ApexClassOrTriggerId: record.ApexClassOrTriggerId,
    NumLinesCovered: record.NumLinesCovered,
    NumLinesUncovered: record.NumLinesUncovered,
    Coverage: coverageLocationsFromField(record.Coverage)
  };
}
