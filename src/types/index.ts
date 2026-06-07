// Core types for Console+ extension

export type AppTheme = 'dark' | 'light';

export interface Session {
  sessionId: string;
  instanceUrl: string;
}

// Apex Classes
export interface ApexClass {
  Id: string;
  Name: string;
  Status: string;
  ApiVersion: number;
  LengthWithoutComments: number;
  Body?: string;
}

export interface ApexClassWithBody extends ApexClass {
  Body: string;
}

// Code Coverage
export interface CoverageResult {
  ApexClassOrTriggerId: string;
  NumLinesCovered: number;
  NumLinesUncovered: number;
  Coverage: CoverageLocation[];
}

export interface CoverageLocation {
  line: number;
  covered: 0 | 1;  // Salesforce returns 0 for uncovered, 1 for covered
}

export interface CoverageSummary {
  totalLines: number;
  coveredLines: number;
  uncoveredLines: number;
  percentage: number;
  linesToReach75: number;
}

// Test Results
export interface TestResult {
  Id: string;
  ApexClassId: string;
  TestTimestamp: string;
  Outcome: 'Pass' | 'Fail' | 'CompileFail' | 'Skip';
  MethodName: string;
  Message: string | null;
  StackTrace: string | null;
  ApexLogId: string | null;
  RunTime: number;
}

/** Last test run started from Console+ (used to explain coverage context). */
export interface LastTestRunInfo {
  testClassId: string;
  testClassName: string;
  timestamp: string;
}

export interface TestRunResult {
  classId: string;
  className: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  tests: TestResult[];
  runTime: number;
}

// Linting & Problems
export interface LintProblem {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  rule: string;
}

// SOQL Query Builder
export interface SalesforceObject {
  name: string;
  label: string;
  keyPrefix: string;
  custom: boolean;
}

export interface SalesforceField {
  name: string;
  label: string;
  type: string;
  referenceTo: string[];
  custom: boolean;
}

export interface QueryResult {
  totalSize: number;
  done: boolean;
  records: any[];
}

// Debug Logs
export interface ApexLog {
  Id: string;
  Application: string;
  DurationMilliseconds: number;
  Location: string;
  LogLength: number;
  LogUserId: string;
  Operation: string;
  Request: string;
  StartTime: string;
  Status: string;
  body?: string;
  extractedClassName?: string;
  extractedMethodName?: string;
}

export interface ParsedLogEvent {
  timestamp: string;
  level: string;
  location: string;
  details: string;
}

export interface DebugLogAnalysis {
  totalEvents: number;
  errors: number;
  warnings: number;
  dmlStatements: number;
  soqlQueries: number;
  cpuTime: number;
  heapSize: number;
  errorMessages: string[];
}

// AI Assistant
export interface AISettings {
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface AISuggestion {
  type: 'coverage' | 'debug';
  title: string;
  content: string;
  timestamp: number;
}

export interface AIUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastRequestTime: number;
}

// Diff Checker
export interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'unchanged' | 'added' | 'removed' | 'modified';
}

// Commands
export interface Command {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  isEnabled?: () => boolean;
}

// UI State
export interface PanelVisibility {
  problems: boolean;
  coverage: boolean;
  testResults: boolean;
  soqlBuilder: boolean;
  debugLogs: boolean;
  diffChecker: boolean;
  settings: boolean;
}

// Tab management
export interface EditorTab {
  id: string;
  classId: string;
  className: string;
  body: string;
  isDirty: boolean;
}

// API Responses
export interface ToolingQueryResponse<T> {
  size: number;
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface ApexTestQueueItem {
  Id: string;
  Status: string;
  ApexClassId: string;
}

export interface ApexTestResult {
  Id: string;
  QueueItemId: string;
  ApexClassId: string;
  MethodName: string;
  Outcome: 'Pass' | 'Fail' | 'CompileFail' | 'Skip';
  Message: string | null;
  StackTrace: string | null;
  RunTime: number;
  TestTimestamp: string;
}

export interface CompilationResult {
  success: boolean;
  compiled: boolean;
  errors?: Array<{
    message: string;
    line: number;
    column: number;
  }>;
}

// Store State
export interface ApexStoreState {
  // Session
  session: Session | null;
  
  // Classes
  classes: ApexClass[];
  selectedClass: ApexClass | null;
  classBody: string;
  
  // Tab Management
  openTabs: EditorTab[];
  activeTabId: string | null;
  
  // Coverage
  coverage: Map<string, CoverageResult>;
  allCoverageLoaded: boolean;
  coverageLoadedAt: string | null;
  lastTestRun: LastTestRunInfo | null;
  /** Test classes that have executed code paths in a given class (from ApexCodeCoverage). */
  coverageContributors: Map<string, string[]>;
  
  // Test Results
  testResults: Map<string, TestRunResult>;
  isRunningTest: boolean;
  
  // Debug Logs
  debugLogs: ApexLog[];
  selectedDebugLog: ApexLog | null;
  debugLogAnalysis: DebugLogAnalysis | null;
  
  // SOQL
  soqlBuilderOpen: boolean;
  soqlAllObjects: SalesforceObject[];
  soqlObjectFields: Map<string, SalesforceField[]>;
  soqlQueryResult: QueryResult | null;
  soqlInitialQuery: string | null;
  
  // Diff Checker
  diffCheckerOpen: boolean;
  diffOriginalCode: string;
  diffComparisonCode: string;
  
  // AI Assistant
  aiSettings: AISettings;
  aiSuggestions: AISuggestion[];
  aiUsageStats: AIUsageStats;
  
  // UI State
  theme: AppTheme;
  isLoading: boolean;
  error: string | null;
  panelVisibility: PanelVisibility;
  problems: LintProblem[];
  coverageVisible: boolean;
  
  // Actions
  setSession: (session: Session) => void;
  fetchClasses: () => Promise<void>;
  selectClass: (classId: string) => Promise<void>;
  saveCode: (body: string) => Promise<void>;
  runTests: (classId: string) => Promise<void>;
  fetchCoverage: (classId: string) => Promise<void>;
  fetchAllCoverage: () => Promise<void>;
  fetchCoverageContributors: (classId: string) => Promise<void>;
  refreshClassFromOrg: (classId: string) => Promise<void>;
  openSoqlBuilder: (initialQuery?: string) => void;
  closeSoqlBuilder: () => void;
  executeSoqlQuery: (query: string) => Promise<void>;
  getAllObjects: () => Promise<void>;
  getObjectFields: (objectName: string) => Promise<void>;
  openDiffChecker: () => void;
  closeDiffChecker: () => void;
  setDiffOriginalCode: (code: string) => void;
  setDiffComparisonCode: (code: string) => void;
  fetchDebugLogs: () => Promise<void>;
  selectDebugLog: (logId: string) => Promise<void>;
  deleteDebugLog: (logId: string) => Promise<void>;
  analyzeDebugLog: (log: ApexLog) => DebugLogAnalysis;
  openDebugLogViewer: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  saveAISettings: (settings: AISettings) => void;
  requestAISuggestion: (type: 'coverage' | 'debug', context: any) => Promise<void>;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setCoverageVisible: (visible: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  loadTheme: () => Promise<void>;
  // Tab Management Actions
  openTab: (classId: string, options?: { refresh?: boolean }) => Promise<void>;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTabBody: (tabId: string, body: string) => void;
}
