// Zustand store for Console+ application state

import { create } from 'zustand';
import type {
  ApexClassWithBody,
  CoverageResult,
  TestRunResult,
  ApexStoreState,
  ApexLog,
  EditorTab
} from '../types';
import { SalesforceAPI } from '../api/salesforce-api';
import { lintApexCode } from '../utils/linter';

export const useApexStore = create<ApexStoreState>((set, get) => ({
  // Initial state
  session: null,
  classes: [],
  selectedClass: null,
  classBody: '',
  coverage: new Map(),
  allCoverageLoaded: false,
  coverageLoadedAt: null,
  lastTestRun: null,
  coverageContributors: new Map(),
  testResults: new Map(),
  isRunningTest: false,
  debugLogs: [],
  selectedDebugLog: null,
  debugLogAnalysis: null,
  soqlBuilderOpen: false,
  soqlAllObjects: [],
  soqlObjectFields: new Map(),
  soqlQueryResult: null,
  soqlInitialQuery: null,
  diffCheckerOpen: false,
  diffOriginalCode: '',
  diffComparisonCode: '',
  aiSettings: {
    apiKey: '',
    model: 'sonar',
    enabled: false
  },
  aiSuggestions: [],
  aiUsageStats: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastRequestTime: 0
  },
  theme: 'dark',
  isLoading: false,
  error: null,
  panelVisibility: {
    problems: true,
    coverage: true,
    testResults: true,
    soqlBuilder: false,
    debugLogs: false,
    diffChecker: false,
    settings: false
  },
  problems: [],
  // NEW: Multi-tab support
  openTabs: [],
  activeTabId: null,
  // Coverage visualization
  coverageVisible: false,

  // Actions
  setSession: (session) => {
    set({ session });
    get().fetchClasses();
  },

  fetchClasses: async () => {
    const { session } = get();
    
    if (!session) {
      console.error('No session available');
      return;
    }

    set({ isLoading: true, error: null });
    
    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const classes = await api.fetchAllClasses();
      set({ classes, isLoading: false });
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  selectClass: async (classId) => {
    // Use the new openTab function instead
    get().openTab(classId);
  },

  // Tab Management Actions
  openTab: async (classId, options) => {
    const refresh = options?.refresh !== false;
    const { session, classes, openTabs } = get();
    if (!session) return;

    const selectedClass = classes.find(c => c.Id === classId);
    if (!selectedClass) return;

    const existingTab = openTabs.find(tab => tab.classId === classId);
    if (existingTab && !refresh) {
      get().switchTab(existingTab.id);
      return;
    }

    if (existingTab && refresh) {
      await get().refreshClassFromOrg(classId);
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const classData: ApexClassWithBody = await api.fetchClassBody(classId);

      const newTab: EditorTab = {
        id: `tab-${classId}-${Date.now()}`,
        classId,
        className: selectedClass.Name,
        body: classData.Body,
        isDirty: false
      };

      const newTabs = [...openTabs, newTab];
      const problems = lintApexCode(classData.Body);

      set({
        openTabs: newTabs,
        activeTabId: newTab.id,
        selectedClass,
        classBody: classData.Body,
        isLoading: false,
        problems
      });

      get().fetchCoverage(classId);
      get().fetchCoverageContributors(classId);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  refreshClassFromOrg: async (classId) => {
    const { session, classes, openTabs, activeTabId } = get();
    if (!session) return;

    const selectedClass = classes.find(c => c.Id === classId);
    if (!selectedClass) return;

    const tab = openTabs.find(t => t.classId === classId);
    if (tab?.isDirty) {
      const ok = window.confirm(
        'This tab has unsaved changes. Reload from org anyway?'
      );
      if (!ok) return;
    }

    set({ isLoading: true, error: null });

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const classData = await api.fetchClassBody(classId);
      const problems = lintApexCode(classData.Body);

      const newTabs = openTabs.map(t =>
        t.classId === classId
          ? { ...t, body: classData.Body, isDirty: false }
          : t
      );

      const isActive = tab?.id === activeTabId || get().selectedClass?.Id === classId;

      set({
        openTabs: newTabs,
        isLoading: false,
        problems: isActive ? problems : get().problems,
        ...(isActive
          ? {
              selectedClass,
              classBody: classData.Body
            }
          : {})
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  closeTab: (tabId) => {
    const { openTabs, activeTabId } = get();
    const tabIndex = openTabs.findIndex(t => t.id === tabId);
    
    if (tabIndex === -1) return;

    const newTabs = openTabs.filter(t => t.id !== tabId);
    
    let newActiveTabId = activeTabId;
    
    // If closing the active tab, switch to another
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        // Switch to the tab to the left, or the first tab
        const newActiveTab = newTabs[Math.max(0, tabIndex - 1)];
        newActiveTabId = newActiveTab.id;
        
        // Update selected class and body
        const selectedClass = get().classes.find(c => c.Id === newActiveTab.classId);
        set({ 
          selectedClass: selectedClass || null,
          classBody: newActiveTab.body
        });
        
        // Lint the code
        const problems = lintApexCode(newActiveTab.body);
        set({ problems });
      } else {
        newActiveTabId = null;
        set({ 
          selectedClass: null,
          classBody: '',
          problems: []
        });
      }
    }
    
    set({ 
      openTabs: newTabs,
      activeTabId: newActiveTabId
    });
  },

  switchTab: (tabId) => {
    const { openTabs, classes } = get();
    const tab = openTabs.find(t => t.id === tabId);
    
    if (!tab) return;
    
    const selectedClass = classes.find(c => c.Id === tab.classId);
    
    // Lint the code
    const problems = lintApexCode(tab.body);
    
    set({ 
      activeTabId: tabId,
      selectedClass: selectedClass || null,
      classBody: tab.body,
      problems
    });
    
    // Fetch coverage
    get().fetchCoverage(tab.classId);
  },

  updateTabBody: (tabId, body) => {
    const { openTabs, activeTabId } = get();
    const newTabs = openTabs.map(tab => {
      if (tab.id === tabId) {
        return { ...tab, body, isDirty: true };
      }
      return tab;
    });
    
    set({ openTabs: newTabs });
    
    // If this is the active tab, update the classBody
    if (activeTabId === tabId) {
      set({ classBody: body });
      
      // Lint the code
      const problems = lintApexCode(body);
      set({ problems });
    }
  },

  saveCode: async (body) => {
    const { session, selectedClass, openTabs, activeTabId } = get();
    if (!session || !selectedClass) return;

    set({ isLoading: true, error: null });

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const result = await api.saveClass(selectedClass.Id, body);

      if (result.success) {
        set({ classBody: body, isLoading: false });
        
        // Mark tab as not dirty
        if (activeTabId) {
          const newTabs = openTabs.map(tab => 
            tab.id === activeTabId ? { ...tab, body, isDirty: false } : tab
          );
          set({ openTabs: newTabs });
        }
        
        // Lint the new code
        const problems = lintApexCode(body);
        set({ problems });
        
        // Show success message (you could add a toast notification here)
        console.log('✅ Class saved successfully');
      } else {
        let errorMessage = result.errors?.map(e => e.message).join('\n') || 'Compilation failed';
        
        // Check for permission errors
        if (errorMessage.includes('INSUFFICIENT_ACCESS') || errorMessage.includes('insufficient access')) {
          errorMessage = '⚠️ Save Failed: Insufficient Permissions\n\n' +
                        'Your Salesforce user needs "Author Apex" permission to save classes.\n' +
                        'Please contact your Salesforce administrator to grant this permission.';
        }
        
        set({ error: errorMessage, isLoading: false });
      }
    } catch (error: any) {
      let errorMessage = error.message;
      
      // Check for permission errors
      if (errorMessage.includes('INSUFFICIENT_ACCESS') || errorMessage.includes('insufficient access')) {
        errorMessage = '⚠️ Save Failed: Insufficient Permissions\n\n' +
                      'Your Salesforce user needs "Author Apex" permission to save classes.\n' +
                      'Please contact your Salesforce administrator to grant this permission.';
      }
      
      set({ error: errorMessage, isLoading: false });
    }
  },

  runTests: async (classId) => {
    const { session, classes, testResults } = get();
    if (!session) return;

    const testClass = classes.find(c => c.Id === classId);
    if (!testClass) return;

    set({ isRunningTest: true, error: null });

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const queueId = await api.runTests(classId);
      
      if (!queueId) {
        throw new Error('Failed to start test run. No queue ID returned.');
      }

      // Poll for test completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 60;

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const queueItems = await api.checkTestQueueStatus(queueId);
          completed = queueItems.every(item => item.Status === 'Completed');
          attempts++;
        } catch (pollError) {
          console.error('Error polling test status:', pollError);
          attempts++;
        }
      }

      if (!completed) {
        throw new Error('Test execution timeout after ' + (maxAttempts * 2) + ' seconds');
      }

      // Fetch test results
      const results = await api.fetchTestResults(queueId);
      
      const testRunResult: TestRunResult = {
        classId: classId,
        className: testClass.Name,
        timestamp: new Date().toISOString(),
        totalTests: results.length,
        passed: results.filter(r => r.Outcome === 'Pass').length,
        failed: results.filter(r => r.Outcome === 'Fail').length,
        skipped: results.filter(r => r.Outcome === 'Skip').length,
        tests: results.map(r => ({
          Id: r.Id,
          ApexClassId: r.ApexClassId,
          TestTimestamp: r.TestTimestamp,
          Outcome: r.Outcome,
          MethodName: r.MethodName,
          Message: r.Message,
          StackTrace: r.StackTrace,
          ApexLogId: null,
          RunTime: r.RunTime
        })),
        runTime: results.reduce((sum, r) => sum + (r.RunTime || 0), 0)
      };

      const newTestResults = new Map(testResults);
      newTestResults.set(classId, testRunResult);

      set({
        testResults: newTestResults,
        isRunningTest: false,
        lastTestRun: {
          testClassId: classId,
          testClassName: testClass.Name,
          timestamp: new Date().toISOString()
        }
      });

      await get().fetchAllCoverage();
    } catch (error: any) {
      console.error('Test run error:', error);
      set({ error: 'Test run failed: ' + error.message, isRunningTest: false });
    }
  },

  fetchCoverage: async (classId) => {
    const { session, coverage } = get();
    if (!session) return;

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const coverageResult = await api.fetchCoverage(classId);

      if (coverageResult) {
        const newCoverage = new Map(coverage);
        newCoverage.set(classId, coverageResult);
        set({ coverage: newCoverage });
      }
    } catch (error: any) {
      console.error('Failed to fetch coverage:', error);
    }
  },

  fetchAllCoverage: async () => {
    const { session } = get();
    if (!session) return;

    set({ isLoading: true, error: null });

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const allCoverage = await api.fetchAllCoverage();

      const coverageMap = new Map<string, CoverageResult>();
      allCoverage.forEach(c => {
        coverageMap.set(c.ApexClassOrTriggerId, c);
      });

      set({
        coverage: coverageMap,
        allCoverageLoaded: true,
        coverageLoadedAt: new Date().toISOString(),
        isLoading: false
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchCoverageContributors: async (classId) => {
    const { session, coverageContributors } = get();
    if (!session) return;

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const names = await api.fetchCoverageContributors(classId);
      const next = new Map(coverageContributors);
      next.set(classId, names);
      set({ coverageContributors: next });
    } catch (error: any) {
      console.error('Failed to fetch coverage contributors:', error);
    }
  },

  // SOQL Query Builder
  openSoqlBuilder: (initialQuery) => {
    set({ 
      soqlBuilderOpen: true,
      soqlInitialQuery: initialQuery || null,
      panelVisibility: { 
        ...get().panelVisibility, 
        soqlBuilder: true 
      } 
    });
    
    // Load objects if not already loaded
    if (get().soqlAllObjects.length === 0) {
      get().getAllObjects();
    }
  },

  closeSoqlBuilder: () => {
    set({ 
      soqlBuilderOpen: false,
      soqlInitialQuery: null,
      panelVisibility: { 
        ...get().panelVisibility, 
        soqlBuilder: false 
      } 
    });
  },

  executeSoqlQuery: async (query) => {
    const { session } = get();
    if (!session) return;

    set({ isLoading: true, error: null });

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const result = await api.executeQuery(query);
      set({ soqlQueryResult: result, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  getAllObjects: async () => {
    const { session } = get();
    if (!session) return;

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const objects = await api.getAllObjects();
      set({ soqlAllObjects: objects });
    } catch (error: any) {
      console.error('Failed to fetch objects:', error);
    }
  },

  getObjectFields: async (objectName) => {
    const { session, soqlObjectFields } = get();
    if (!session) return;

    // Return if already fetched
    if (soqlObjectFields.has(objectName)) return;

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const fields = await api.getObjectFields(objectName);
      
      const newFields = new Map(soqlObjectFields);
      newFields.set(objectName, fields);
      set({ soqlObjectFields: newFields });
    } catch (error: any) {
      console.error('Failed to fetch fields:', error);
    }
  },

  // Diff Checker
  openDiffChecker: () => {
    const { classBody } = get();
    set({
      diffCheckerOpen: true,
      diffOriginalCode: classBody || '',
      diffComparisonCode: '',
      panelVisibility: {
        ...get().panelVisibility,
        diffChecker: true
      }
    });
  },

  closeDiffChecker: () => {
    const { diffOriginalCode, classBody, activeTabId } = get();
    // Keep merged/edited left-side code in the main editor (local only, not saved to org)
    if (activeTabId && diffOriginalCode !== classBody) {
      get().updateTabBody(activeTabId, diffOriginalCode);
    }
    set({
      diffCheckerOpen: false,
      panelVisibility: {
        ...get().panelVisibility,
        diffChecker: false
      }
    });
  },

  setDiffOriginalCode: (code) => set({ diffOriginalCode: code }),
  setDiffComparisonCode: (code) => set({ diffComparisonCode: code }),

  // Debug Logs
  fetchDebugLogs: async () => {
    const { session } = get();
    if (!session) return;

    set({ isLoading: true, error: null });

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const logs = await api.fetchDebugLogs();
      set({ debugLogs: logs, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  selectDebugLog: async (logId) => {
    const { session, debugLogs } = get();
    if (!session) return;

    const log = debugLogs.find(l => l.Id === logId);
    if (!log) return;

    set({ isLoading: true, error: null });

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      const body = await api.fetchDebugLogBody(logId);
      
      // Extract class and method name
      const classMatch = body.match(/Execute Anonymous: ([\w.]+)/);
      const methodMatch = body.match(/ENTERING_MANAGED_PKG.*?(\w+\.\w+)/);
      
      const updatedLog: ApexLog = {
        ...log,
        body,
        extractedClassName: classMatch ? classMatch[1] : undefined,
        extractedMethodName: methodMatch ? methodMatch[1] : undefined
      };

      const analysis = get().analyzeDebugLog(updatedLog);

      set({ 
        selectedDebugLog: updatedLog,
        debugLogAnalysis: analysis,
        isLoading: false 
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  deleteDebugLog: async (logId) => {
    const { session } = get();
    if (!session) return;

    try {
      const api = new SalesforceAPI(session.instanceUrl, session.sessionId);
      await api.deleteDebugLog(logId);
      
      // Refresh logs
      get().fetchDebugLogs();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  analyzeDebugLog: (log) => {
    if (!log.body) {
      return {
        totalEvents: 0,
        errors: 0,
        warnings: 0,
        dmlStatements: 0,
        soqlQueries: 0,
        cpuTime: 0,
        heapSize: 0,
        errorMessages: []
      };
    }

    const lines = log.body.split('\n');
    const errorMessages: string[] = [];
    let errors = 0;
    let warnings = 0;
    let dmlStatements = 0;
    let soqlQueries = 0;
    let cpuTime = 0;
    let heapSize = 0;

    lines.forEach(line => {
      if (line.includes('|ERROR|') || line.includes('|EXCEPTION|')) {
        errors++;
        errorMessages.push(line);
      }
      if (line.includes('|WARN|')) {
        warnings++;
      }
      if (line.includes('|DML_')) {
        dmlStatements++;
      }
      if (line.includes('|SOQL_EXECUTE_')) {
        soqlQueries++;
      }

      const cpuMatch = line.match(/LIMIT_USAGE.*CPU time: (\d+)/);
      if (cpuMatch) {
        cpuTime = parseInt(cpuMatch[1]);
      }

      const heapMatch = line.match(/LIMIT_USAGE.*Heap size: (\d+)/);
      if (heapMatch) {
        heapSize = parseInt(heapMatch[1]);
      }
    });

    return {
      totalEvents: lines.length,
      errors,
      warnings,
      dmlStatements,
      soqlQueries,
      cpuTime,
      heapSize,
      errorMessages
    };
  },

  openDebugLogViewer: () => {
    set({ 
      panelVisibility: { 
        ...get().panelVisibility, 
        debugLogs: true 
      } 
    });
    
    // Fetch logs if not already loaded
    if (get().debugLogs.length === 0) {
      get().fetchDebugLogs();
    }
  },

  // Settings
  openSettings: () => {
    set({ 
      panelVisibility: { 
        ...get().panelVisibility, 
        settings: true 
      } 
    });
  },

  closeSettings: () => {
    set({
      panelVisibility: {
        ...get().panelVisibility,
        settings: false
      }
    });
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
    chrome.storage.local.set({ appTheme: theme });
  },

  loadTheme: async () => {
    try {
      const stored = await chrome.storage.local.get(['appTheme']);
      const theme = stored.appTheme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      set({ theme });
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
      set({ theme: 'dark' });
    }
  },

  saveAISettings: async (settings) => {
    set({ aiSettings: settings });
    await chrome.storage.local.set({ aiSettings: settings });
  },

  requestAISuggestion: async (type, context) => {
    // Placeholder for AI integration
    console.log('AI suggestion requested:', type, context);
  },

  // Utility
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
  
  // Coverage visualization
  setCoverageVisible: (visible) => set({ coverageVisible: visible })
}));

// Initialize session from storage
chrome.storage.local.get(['session'], (result) => {
  if (result.session) {
    useApexStore.getState().setSession(result.session);
  }
});

// Load AI settings
chrome.storage.local.get(['aiSettings'], (result) => {
  if (result.aiSettings) {
    useApexStore.setState({ aiSettings: result.aiSettings });
  }
});
