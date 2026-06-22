import type { TestResult, TestRunResult, TestExecutionMode } from '../types';

export function createRunningTestResult(classId: string, className: string): TestRunResult {
  const now = new Date().toISOString();
  return {
    classId,
    className,
    status: 'running',
    timestamp: now,
    startedAt: now,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    runTime: 0
  };
}

export function createCompletedTestResult(
  classId: string,
  className: string,
  tests: TestResult[],
  options: {
    runTime: number;
    executionMode?: TestExecutionMode;
    timestamp?: string;
    startedAt?: string;
  }
): TestRunResult {
  const timestamp = options.timestamp ?? new Date().toISOString();
  return {
    classId,
    className,
    status: 'completed',
    timestamp,
    startedAt: options.startedAt ?? timestamp,
    totalTests: tests.length,
    passed: tests.filter(t => t.Outcome === 'Pass').length,
    failed: tests.filter(t => t.Outcome === 'Fail').length,
    skipped: tests.filter(t => t.Outcome === 'Skip').length,
    tests,
    runTime: options.runTime,
    executionMode: options.executionMode
  };
}

export function applyPartialTestResults(
  existing: TestRunResult,
  tests: TestResult[],
  progress?: { methodsCompleted?: number; methodsEnqueued?: number }
): TestRunResult {
  return {
    ...existing,
    status: 'running',
    tests,
    totalTests: tests.length,
    passed: tests.filter(t => t.Outcome === 'Pass').length,
    failed: tests.filter(t => t.Outcome === 'Fail').length,
    skipped: tests.filter(t => t.Outcome === 'Skip').length,
    methodsCompleted: progress?.methodsCompleted,
    methodsEnqueued: progress?.methodsEnqueued
  };
}

export function createFailedTestResult(
  classId: string,
  className: string,
  error: string,
  existing?: TestRunResult
): TestRunResult {
  const now = new Date().toISOString();
  return {
    classId,
    className,
    status: 'failed',
    timestamp: now,
    startedAt: existing?.startedAt ?? now,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    runTime: 0,
    error,
    executionMode: existing?.executionMode
  };
}

export function sortTestRunResults(entries: TestRunResult[]): TestRunResult[] {
  return [...entries].sort((a, b) => {
    const statusOrder = { running: 0, failed: 1, completed: 2 };
    const aOrder = statusOrder[a.status];
    const bOrder = statusOrder[b.status];
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}
