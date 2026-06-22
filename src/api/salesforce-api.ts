// Salesforce Tooling API client for Console+

import type {
  ApexClass,
  ApexClassWithBody,
  ToolingQueryResponse,
  ApexTestRunProgress,
  ApexTestResult,
  CoverageResult,
  CompilationResult,
  SalesforceObject,
  SalesforceField,
  QueryResult,
  SoqlExplainResult,
  ApexLog,
  SyncTestRunResult
} from '../types';
import { normalizeAggregateCoverageRecord } from '../utils/coverage';
import { formatApiParseError, isHtmlResponse } from '../utils/salesforce-url';

export class SalesforceAPI {
  private instanceUrl: string;
  private baseUrl: string;
  private sessionId: string;

  constructor(instanceUrl: string, sessionId: string) {
    this.instanceUrl = instanceUrl.replace(/\/$/, '');
    this.baseUrl = `${this.instanceUrl}/services/data/v59.0`;
    this.sessionId = sessionId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.sessionId}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store'
    });
    
    const bodyText = await response.text();

    if (!response.ok) {
      console.error('API Error:', response.status, bodyText.slice(0, 500));
      if (isHtmlResponse(bodyText)) {
        throw new Error(formatApiParseError(bodyText));
      }
      throw new Error(`API Error (${response.status}): ${bodyText.slice(0, 300)}`);
    }

    if (!bodyText.trim()) {
      return {} as T;
    }

    if (isHtmlResponse(bodyText)) {
      throw new Error(formatApiParseError(bodyText));
    }

    try {
      return JSON.parse(bodyText) as T;
    } catch {
      throw new Error(formatApiParseError(bodyText));
    }
  }

  // Fetch all Apex classes (metadata only)
  async fetchAllClasses(): Promise<ApexClass[]> {
    const query = `SELECT Id, Name, Status, ApiVersion, LengthWithoutComments FROM ApexClass WHERE Status = 'Active' ORDER BY Name ASC`;
    let allClasses: ApexClass[] = [];
    let nextUrl: string | undefined = `/tooling/query?q=${encodeURIComponent(query)}`;

    while (nextUrl) {
      type Response = ToolingQueryResponse<ApexClass>;
      const response: Response = await this.request<Response>(nextUrl);
      allClasses = allClasses.concat(response.records);
      nextUrl = response.nextRecordsUrl;
    }

    return allClasses;
  }

  // Fetch single class body (SOQL so we always get latest Body from org)
  async fetchClassBody(classId: string): Promise<ApexClassWithBody> {
    const query = `SELECT Id, Name, Body, Status, ApiVersion, LengthWithoutComments FROM ApexClass WHERE Id = '${classId}'`;
    const response = await this.request<ToolingQueryResponse<ApexClassWithBody>>(
      `/tooling/query?q=${encodeURIComponent(query)}`
    );
    if (response.records.length === 0) {
      throw new Error('Class not found in org');
    }
    return response.records[0];
  }

  /** Test class names that have contributed coverage rows for this class (per-method records). */
  async fetchCoverageContributors(classId: string): Promise<string[]> {
    const query = `SELECT ApexTestClass.Name FROM ApexCodeCoverage WHERE ApexClassOrTriggerId = '${classId}'`;
    const names = new Set<string>();
    let nextUrl: string | undefined = `/tooling/query?q=${encodeURIComponent(query)}`;

    while (nextUrl) {
      type Row = { ApexTestClass?: { Name?: string } };
      type Response = ToolingQueryResponse<Row>;
      const response: Response = await this.request<Response>(nextUrl);
      for (const row of response.records) {
        const name = row.ApexTestClass?.Name;
        if (name) names.add(name);
      }
      nextUrl = response.nextRecordsUrl;
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  // Save class code using MetadataContainer (proper way that works)
  async saveClass(classId: string, body: string): Promise<CompilationResult> {
    try {
      // Method 1: Use MetadataContainer (most reliable)
      // Create a container
      const containerResponse = await this.request<any>('/tooling/sobjects/MetadataContainer/', {
        method: 'POST',
        body: JSON.stringify({ name: `Container_${Date.now()}` })
      });
      
      const containerId = containerResponse.id;
      
      try {
        // Create ApexClassMember
        await this.request<any>('/tooling/sobjects/ApexClassMember/', {
          method: 'POST',
          body: JSON.stringify({
            Body: body,
            ContentEntityId: classId,
            MetadataContainerId: containerId
          })
        });
        
        // Deploy the container
        const deployResponse = await this.request<any>('/tooling/sobjects/ContainerAsyncRequest/', {
          method: 'POST',
          body: JSON.stringify({
            MetadataContainerId: containerId,
            IsCheckOnly: false
          })
        });
        
        const requestId = deployResponse.id;
        
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const statusResponse = await this.request<any>(`/tooling/sobjects/ContainerAsyncRequest/${requestId}`);
          
          if (statusResponse.State === 'Completed') {
            return {
              success: true,
              compiled: true
            };
          } else if (statusResponse.State === 'Failed') {
            const errors = statusResponse.DeployDetails?.componentFailures || [];
            const compilationErrors = errors.map((e: any) => ({
              message: e.problem || 'Compilation failed',
              line: e.lineNumber || 1,
              column: e.columnNumber || 1
            }));
            
            return {
              success: false,
              compiled: false,
              errors: compilationErrors.length > 0 ? compilationErrors : [{
                message: statusResponse.ErrorMsg || 'Compilation failed',
                line: 1,
                column: 1
              }]
            };
          }
          
          attempts++;
        }
        
        throw new Error('Save timeout - please try again');
        
      } finally {
        // Clean up container
        try {
          await this.request(`/tooling/sobjects/MetadataContainer/${containerId}`, {
            method: 'DELETE'
          });
        } catch {
          // Ignore cleanup errors
        }
      }
      
    } catch (error: any) {
      // Parse the error message for better display
      let errorMessage = error.message || String(error);
      
      // Extract JSON error if present
      try {
        const jsonMatch = errorMessage.match(/\[{.*}\]/);
        if (jsonMatch) {
          const errors = JSON.parse(jsonMatch[0]);
          if (errors && errors.length > 0) {
            errorMessage = errors[0].message || errorMessage;
          }
        }
      } catch {
        // Keep original error message
      }
      
      const errors: Array<{ message: string; line: number; column: number }> = [];
      
      // Try to extract line/column info from error message
      const lineMatch = errorMessage.match(/line (\d+)/i);
      const columnMatch = errorMessage.match(/column (\d+)/i);
      
      errors.push({
        message: errorMessage,
        line: lineMatch ? parseInt(lineMatch[1]) : 1,
        column: columnMatch ? parseInt(columnMatch[1]) : 1
      });

      return {
        success: false,
        compiled: false,
        errors
      };
    }
  }

  // Match Developer Console "Disable Parallel Apex Testing" for this test run
  async setApexTestExecutionOptions(disableParallelApexTesting: boolean): Promise<void> {
    const body = new URLSearchParams({
      action: 'SET_OPTIONS',
      onlyStoreAggregateCoverage: 'false',
      disableParallelApexTesting: String(disableParallelApexTesting),
      testAutonumber: 'false'
    });

    const response = await fetch(
      `${this.instanceUrl}/_ui/common/apex/test/ApexTestQueueServlet`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.sessionId}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString(),
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to set test options (${response.status}): ${text.slice(0, 200)}`);
    }
  }

  private buildRunTestsBody(classIds: string[]) {
    return {
      tests: classIds.map(classId => ({ classId })),
      maxFailedTests: 0
    };
  }

  // Run tests asynchronously — returns AsyncApexJob Id (same as ApexTestQueueItem.ParentJobId)
  async runTestsAsynchronous(classIds: string | string[]): Promise<string> {
    const ids = Array.isArray(classIds) ? classIds : [classIds];
    const response = await this.request<string | { id?: string }>(
      '/tooling/runTestsAsynchronous/',
      {
        method: 'POST',
        body: JSON.stringify(this.buildRunTestsBody(ids))
      }
    );

    return this.parseAsyncJobId(response);
  }

  private parseAsyncJobId(response: string | { id?: string }): string {
    if (typeof response === 'string') {
      return response.replace(/^"|"$/g, '').trim();
    }
    return response?.id ?? '';
  }

  private async queryRecords<T>(
    soql: string,
    options: { tooling?: boolean } = {}
  ): Promise<T[]> {
    const useTooling = options.tooling !== false;
    const base = useTooling ? '/tooling/query' : '/query';
    let records: T[] = [];
    let nextUrl: string | undefined = `${base}?q=${encodeURIComponent(soql)}`;

    while (nextUrl) {
      const path = nextUrl.includes('/services/data/') ? this.normalizePagedUrl(nextUrl) : nextUrl;
      const response: ToolingQueryResponse<T> = await this.request<ToolingQueryResponse<T>>(path);
      records = records.concat(response.records);
      nextUrl = response.nextRecordsUrl;
    }

    return records;
  }

  private async queryRecordsWithFallback<T>(soql: string): Promise<T[]> {
    try {
      return await this.queryRecords<T>(soql, { tooling: true });
    } catch {
      return await this.queryRecords<T>(soql, { tooling: false });
    }
  }

  /** Poll test run using AsyncApexJob + ApexTestRunResult (Salesforce-recommended). */
  async getAsyncTestProgress(jobId: string): Promise<ApexTestRunProgress> {
    const completeJobStatuses = new Set(['Completed', 'Failed', 'Aborted']);
    const completeRunStatuses = new Set(['Completed', 'Failed', 'Aborted']);

    let jobStatus: string | undefined;
    let runStatus: string | undefined;
    let methodsCompleted = 0;
    let methodsEnqueued = 0;
    let classesCompleted = 0;
    let classesEnqueued = 0;

    try {
      const jobs = await this.queryRecords<{ Id: string; Status: string }>(
        `SELECT Id, Status FROM AsyncApexJob WHERE Id = '${jobId}' LIMIT 1`,
        { tooling: false }
      );
      jobStatus = jobs[0]?.Status;
    } catch (error) {
      console.warn('AsyncApexJob poll failed:', error);
    }

    try {
      const runs = await this.queryRecordsWithFallback<{
        Id: string;
        Status: string;
        MethodsCompleted: number;
        MethodsEnqueued: number;
        ClassesCompleted: number;
        ClassesEnqueued: number;
      }>(
        `SELECT Id, Status, MethodsCompleted, MethodsEnqueued, ClassesCompleted, ClassesEnqueued FROM ApexTestRunResult WHERE AsyncApexJobId = '${jobId}' LIMIT 1`
      );
      if (runs[0]) {
        runStatus = runs[0].Status;
        methodsCompleted = runs[0].MethodsCompleted ?? 0;
        methodsEnqueued = runs[0].MethodsEnqueued ?? 0;
        classesCompleted = runs[0].ClassesCompleted ?? 0;
        classesEnqueued = runs[0].ClassesEnqueued ?? 0;
      }
    } catch (error) {
      console.warn('ApexTestRunResult poll failed:', error);
    }

    const methodsDone = methodsEnqueued > 0 && methodsCompleted >= methodsEnqueued;
    const classesDone = classesEnqueued > 0 && classesCompleted >= classesEnqueued;
    const isComplete = Boolean(
      (jobStatus && completeJobStatuses.has(jobStatus))
      || (runStatus && completeRunStatuses.has(runStatus))
      || methodsDone
      || classesDone
    );
    const isFailed = jobStatus === 'Failed' || jobStatus === 'Aborted' || runStatus === 'Failed';

    return {
      jobId,
      isComplete,
      isFailed,
      jobStatus,
      runStatus,
      methodsCompleted,
      methodsEnqueued,
      classesCompleted,
      classesEnqueued
    };
  }

  async waitForAsyncTestRun(
    jobId: string,
    options?: {
      timeoutMs?: number;
      onProgress?: (progress: ApexTestRunProgress) => void | Promise<void>;
    }
  ): Promise<ApexTestRunProgress> {
    const timeoutMs = options?.timeoutMs ?? 600_000;
    const start = Date.now();
    let attempt = 0;
    let lastProgress: ApexTestRunProgress = {
      jobId,
      isComplete: false,
      isFailed: false,
      methodsCompleted: 0,
      methodsEnqueued: 0,
      classesCompleted: 0,
      classesEnqueued: 0
    };

    while (Date.now() - start < timeoutMs) {
      const delay = attempt < 30 ? 1000 : 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;

      lastProgress = await this.getAsyncTestProgress(jobId);
      await options?.onProgress?.(lastProgress);

      if (lastProgress.isComplete) {
        return lastProgress;
      }
    }

    // Timeout — one last check; Salesforce may have finished while we slept
    lastProgress = await this.getAsyncTestProgress(jobId);
    if (lastProgress.isComplete) return lastProgress;

    const partialResults = await this.fetchTestResultsByJobId(jobId);
    if (partialResults.length > 0) {
      lastProgress.isComplete = true;
      return lastProgress;
    }

    throw new Error(`Test execution timeout after ${Math.round(timeoutMs / 1000)} seconds`);
  }

  // Run tests synchronously (serial execution — single class only)
  async runTestsSynchronous(classId: string): Promise<SyncTestRunResult> {
    return this.request<SyncTestRunResult>('/tooling/runTestsSynchronous/', {
      method: 'POST',
      body: JSON.stringify(this.buildRunTestsBody([classId]))
    });
  }

  // Run tests for one or more classes (uses async path)
  async runTests(classIds: string | string[]): Promise<string> {
    return this.runTestsAsynchronous(classIds);
  }

  // Fetch all ApexTestResult rows for an async test job (preferred — works even if queue items lag)
  async fetchTestResultsByJobId(asyncJobId: string): Promise<ApexTestResult[]> {
    const soql = `SELECT Id, QueueItemId, ApexClassId, MethodName, Outcome, Message, StackTrace, RunTime, TestTimestamp FROM ApexTestResult WHERE AsyncApexJobId = '${asyncJobId}' ORDER BY TestTimestamp`;
    return this.queryRecordsWithFallback<ApexTestResult>(soql);
  }

  // Legacy: fetch by parent job via queue items (fallback)
  async fetchTestResults(parentJobId: string): Promise<ApexTestResult[]> {
    const byJob = await this.fetchTestResultsByJobId(parentJobId);
    if (byJob.length > 0) return byJob;

    const queueItems = await this.queryRecords<{ Id: string }>(
      `SELECT Id FROM ApexTestQueueItem WHERE ParentJobId = '${parentJobId}'`
    );
    if (queueItems.length === 0) return [];

    const queueItemIds = queueItems.map(r => `'${r.Id}'`).join(',');
    return this.queryRecordsWithFallback<ApexTestResult>(
      `SELECT Id, QueueItemId, ApexClassId, MethodName, Outcome, Message, StackTrace, RunTime, TestTimestamp FROM ApexTestResult WHERE QueueItemId IN (${queueItemIds})`
    );
  }

  // Fetch aggregate code coverage for a class (matches Developer Console totals)
  async fetchCoverage(classId: string): Promise<CoverageResult | null> {
    const query = `SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate WHERE ApexClassOrTriggerId = '${classId}'`;
    const response = await this.request<ToolingQueryResponse<CoverageResult>>(
      `/tooling/query?q=${encodeURIComponent(query)}`
    );

    if (response.records.length === 0) return null;
    return normalizeAggregateCoverageRecord(response.records[0]);
  }

  // Fetch all aggregate code coverage (org-wide, same as Developer Console)
  async fetchAllCoverage(): Promise<CoverageResult[]> {
    const query = `SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate`;
    let allCoverage: CoverageResult[] = [];
    let nextUrl: string | undefined = `/tooling/query?q=${encodeURIComponent(query)}`;

    while (nextUrl) {
      type Response = ToolingQueryResponse<CoverageResult>;
      const response: Response = await this.request<Response>(nextUrl);
      allCoverage = allCoverage.concat(
        response.records.map(r => normalizeAggregateCoverageRecord(r))
      );
      nextUrl = response.nextRecordsUrl;
    }

    return allCoverage;
  }

  // Execute SOQL query (single page)
  async executeQuery(query: string, useToolingApi = false): Promise<QueryResult> {
    const base = useToolingApi ? '/tooling/query' : '/query';
    try {
      return await this.request<QueryResult>(`${base}?q=${encodeURIComponent(query)}`);
    } catch (error: any) {
      throw new Error(this.parseSoqlError(error));
    }
  }

  // Fetch all pages of a query result
  async executeQueryAll(
    query: string,
    useToolingApi = false,
    options?: {
      onProgress?: (fetched: number, total: number, page: number) => void;
      shouldCancel?: () => boolean;
    }
  ): Promise<QueryResult> {
    const first = await this.executeQuery(query, useToolingApi);
    let records = [...first.records];
    let nextUrl = first.nextRecordsUrl;
    let page = 1;

    options?.onProgress?.(records.length, first.totalSize, page);

    while (nextUrl) {
      if (options?.shouldCancel?.()) {
        throw new Error('Query cancelled');
      }
      page++;
      const pageResult = await this.request<QueryResult>(this.normalizePagedUrl(nextUrl));
      records = records.concat(pageResult.records);
      nextUrl = pageResult.nextRecordsUrl;
      options?.onProgress?.(records.length, first.totalSize, page);
    }

    return {
      totalSize: first.totalSize,
      done: true,
      records
    };
  }

  async explainQuery(query: string): Promise<SoqlExplainResult> {
    try {
      return await this.request<SoqlExplainResult>(
        `/query/?explain=${encodeURIComponent(query)}`
      );
    } catch (error: any) {
      throw new Error(this.parseSoqlError(error));
    }
  }

  async deleteRecords(ids: string[]): Promise<void> {
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await this.request(`/composite/sobjects?ids=${chunk.join(',')}&allOrNone=false`, {
        method: 'DELETE'
      });
    }
  }

  private normalizePagedUrl(nextRecordsUrl: string): string {
    const match = nextRecordsUrl.match(/\/services\/data\/v[\d.]+\/(.+)$/);
    return match ? `/${match[1]}` : nextRecordsUrl;
  }

  private parseSoqlError(error: unknown): string {
    let errorMessage = 'Query execution failed';
    if (error instanceof Error && error.message) {
      const errorText = error.message;
      try {
        const match = errorText.match(/\[(\{.*\})\]/);
        if (match) {
          const errorObj = JSON.parse(match[1]);
          errorMessage = errorObj.message || errorMessage;
        } else {
          errorMessage = errorText;
        }
      } catch {
        errorMessage = errorText;
      }
    }
    return errorMessage;
  }

  // Get all objects
  async getAllObjects(): Promise<SalesforceObject[]> {
    type SObjectsResponse = { sobjects: SalesforceObject[] };
    const response = await this.request<SObjectsResponse>('/sobjects/') as SObjectsResponse;
    return response.sobjects.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Get object fields
  async getObjectFields(objectName: string): Promise<SalesforceField[]> {
    type DescribeField = {
      name: string;
      label: string;
      type: string;
      referenceTo?: string[];
      relationshipName?: string | null;
      custom: boolean;
      picklistValues?: Array<{ value: string; label: string; active: boolean }>;
    };
    const response = await this.request<{ fields: DescribeField[] }>(
      `/sobjects/${objectName}/describe/`
    );
    return response.fields
      .map(f => ({
        name: f.name,
        label: f.label,
        type: f.type,
        referenceTo: f.referenceTo ?? [],
        relationshipName: f.relationshipName ?? undefined,
        custom: f.custom,
        picklistValues: f.picklistValues
          ?.filter(pv => pv.active)
          .map(pv => ({ value: pv.value, label: pv.label, active: pv.active }))
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Debug Logs
  async getCurrentUserId(): Promise<string> {
    const query = `SELECT Id FROM User WHERE Username = '${await this.getUserName()}'`;
    const response = await this.request<QueryResult>(`/query?q=${encodeURIComponent(query)}`);
    const id = response.records[0]?.Id;
    return id != null ? String(id) : '';
  }

  private async getUserName(): Promise<string> {
    const response = await this.request<{ Username: string }>('/chatter/users/me');
    return response.Username;
  }

  async createDebugLevel(): Promise<string> {
    const debugLevel = {
      DeveloperName: 'ConsoleDebug',
      MasterLabel: 'Console Debug',
      ApexCode: 'FINEST',
      Visualforce: 'FINER',
      System: 'FINE',
      Database: 'FINE',
      Workflow: 'FINE',
      Validation: 'INFO',
      Callout: 'INFO'
    };

    try {
      const response = await this.request<{ id: string }>('/tooling/sobjects/DebugLevel', {
        method: 'POST',
        body: JSON.stringify(debugLevel)
      });
      return response.id;
    } catch {
      // Debug level might already exist, query for it
      const query = `SELECT Id FROM DebugLevel WHERE DeveloperName = 'ConsoleDebug' LIMIT 1`;
      const response = await this.request<ToolingQueryResponse<{ Id: string }>>(
        `/tooling/query?q=${encodeURIComponent(query)}`
      );
      return response.records[0]?.Id;
    }
  }

  async createTraceFlag(userId: string, debugLevelId: string): Promise<string> {
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 1);

    const traceFlag = {
      TracedEntityId: userId,
      DebugLevelId: debugLevelId,
      LogType: 'USER_DEBUG',
      ExpirationDate: expirationDate.toISOString()
    };

    const response = await this.request<{ id: string }>('/tooling/sobjects/TraceFlag', {
      method: 'POST',
      body: JSON.stringify(traceFlag)
    });

    return response.id;
  }

  async fetchDebugLogs(limit: number = 50): Promise<ApexLog[]> {
    const query = `SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUserId, Operation, Request, StartTime, Status FROM ApexLog ORDER BY StartTime DESC LIMIT ${limit}`;
    const response = await this.request<ToolingQueryResponse<ApexLog>>(
      `/tooling/query?q=${encodeURIComponent(query)}`
    );
    return response.records;
  }

  async fetchDebugLogBody(logId: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/tooling/sobjects/ApexLog/${logId}/Body`,
      {
        headers: {
          'Authorization': `Bearer ${this.sessionId}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch log body: ${response.status}`);
    }

    return response.text();
  }

  async deleteDebugLog(logId: string): Promise<void> {
    await this.request(`/tooling/sobjects/ApexLog/${logId}`, {
      method: 'DELETE'
    });
  }
}
