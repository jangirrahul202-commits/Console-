// Salesforce Tooling API client for Console+

import type {
  ApexClass,
  ApexClassWithBody,
  ToolingQueryResponse,
  ApexTestQueueItem,
  ApexTestResult,
  CoverageResult,
  CompilationResult,
  SalesforceObject,
  SalesforceField,
  QueryResult,
  ApexLog
} from '../types';
import { normalizeAggregateCoverageRecord } from '../utils/coverage';
import { formatApiParseError, isHtmlResponse } from '../utils/salesforce-url';

export class SalesforceAPI {
  private baseUrl: string;
  private sessionId: string;

  constructor(instanceUrl: string, sessionId: string) {
    this.baseUrl = `${instanceUrl}/services/data/v59.0`;
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

  // Run tests for a class
  async runTests(classId: string): Promise<string> {
    const body = {
      tests: [{
        classId: classId
      }]
    };
    
    const response = await this.request<any>('/tooling/runTestsAsynchronous/', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    // The response is a string (the job ID)
    return response || '';
  }

  // Check test queue status
  async checkTestQueueStatus(queueId: string): Promise<ApexTestQueueItem[]> {
    const query = `SELECT Id, Status, ApexClassId FROM ApexTestQueueItem WHERE ParentJobId = '${queueId}'`;
    const response = await this.request<ToolingQueryResponse<ApexTestQueueItem>>(
      `/tooling/query?q=${encodeURIComponent(query)}`
    );
    return response.records;
  }

  // Fetch test results
  async fetchTestResults(parentJobId: string): Promise<ApexTestResult[]> {
    // First get all queue items for this parent job
    const queueQuery = `SELECT Id FROM ApexTestQueueItem WHERE ParentJobId = '${parentJobId}'`;
    const queueResponse = await this.request<ToolingQueryResponse<{ Id: string }>>(
      `/tooling/query?q=${encodeURIComponent(queueQuery)}`
    );
    
    if (queueResponse.records.length === 0) {
      return [];
    }
    
    const queueItemIds = queueResponse.records.map(r => `'${r.Id}'`).join(',');
    
    // Then get test results for these queue items
    const resultsQuery = `SELECT Id, QueueItemId, ApexClassId, MethodName, Outcome, Message, StackTrace, RunTime, TestTimestamp FROM ApexTestResult WHERE QueueItemId IN (${queueItemIds})`;
    const response = await this.request<ToolingQueryResponse<ApexTestResult>>(
      `/tooling/query?q=${encodeURIComponent(resultsQuery)}`
    );
    return response.records;
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

  // Execute SOQL query
  async executeQuery(query: string): Promise<QueryResult> {
    try {
      return await this.request<QueryResult>(`/query?q=${encodeURIComponent(query)}`);
    } catch (error: any) {
      // Extract more meaningful error message
      let errorMessage = 'Query execution failed';
      
      if (error.message) {
        const errorText = error.message;
        
        // Try to parse JSON error response
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
      
      throw new Error(errorMessage);
    }
  }

  // Get all objects
  async getAllObjects(): Promise<SalesforceObject[]> {
    type SObjectsResponse = { sobjects: SalesforceObject[] };
    const response = await this.request<SObjectsResponse>('/sobjects/') as SObjectsResponse;
    return response.sobjects.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Get object fields
  async getObjectFields(objectName: string): Promise<SalesforceField[]> {
    const response = await this.request<{ fields: SalesforceField[] }>(`/sobjects/${objectName}/describe/`);
    return response.fields.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Debug Logs
  async getCurrentUserId(): Promise<string> {
    const query = `SELECT Id FROM User WHERE Username = '${await this.getUserName()}'`;
    const response = await this.request<QueryResult>(`/query?q=${encodeURIComponent(query)}`);
    return response.records[0]?.Id;
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
