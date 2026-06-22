// Apex Code Linter for Console+

import type { LintProblem } from '../types';

export function lintApexCode(code: string): LintProblem[] {
  const problems: LintProblem[] = [];
  const lines = code.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check for System.debug without proper logging
    if (line.match(/System\.debug\s*\(/i) && !line.match(/LoggingLevel\./)) {
      problems.push({
        line: lineNumber,
        column: line.indexOf('System.debug') + 1,
        endLine: lineNumber,
        endColumn: line.length,
        message: 'Consider using LoggingLevel with System.debug for better log control',
        severity: 'info',
        rule: 'SystemDebugLevel'
      });
    }

    // Check for hardcoded IDs
    if (line.match(/['"][a-zA-Z0-9]{15,18}['"]/)) {
      problems.push({
        line: lineNumber,
        column: line.search(/['"][a-zA-Z0-9]{15,18}['"]/) + 1,
        endLine: lineNumber,
        endColumn: line.length,
        message: 'Avoid hardcoding Salesforce IDs',
        severity: 'warning',
        rule: 'HardcodedId'
      });
    }

    // Check for missing @AuraEnabled(cacheable=true)
    if (line.match(/@AuraEnabled\s*$/) && !code.includes('cacheable=true')) {
      problems.push({
        line: lineNumber,
        column: 1,
        endLine: lineNumber,
        endColumn: line.length,
        message: 'Consider adding cacheable=true to @AuraEnabled for better performance',
        severity: 'info',
        rule: 'AuraEnabledCacheable'
      });
    }

    // Check for SOQL in loops
    if (line.match(/for\s*\(/) && code.slice(lines.slice(0, index + 5).join('\n').length).match(/\[SELECT/i)) {
      problems.push({
        line: lineNumber,
        column: 1,
        endLine: lineNumber,
        endColumn: line.length,
        message: 'Potential SOQL in loop detected - consider bulkifying your code',
        severity: 'error',
        rule: 'SOQLInLoop'
      });
    }

    // Check for DML in loops
    if (line.match(/for\s*\(/) && code.slice(lines.slice(0, index + 5).join('\n').length).match(/(insert|update|delete|upsert)\s+/i)) {
      problems.push({
        line: lineNumber,
        column: 1,
        endLine: lineNumber,
        endColumn: line.length,
        message: 'Potential DML in loop detected - consider bulkifying your code',
        severity: 'error',
        rule: 'DMLInLoop'
      });
    }

    // Check for missing null checks
    if (line.match(/\.get\(/) && !line.match(/!=\s*null|==\s*null/) && !lines[index - 1]?.match(/!=\s*null|==\s*null/)) {
      problems.push({
        line: lineNumber,
        column: 1,
        endLine: lineNumber,
        endColumn: line.length,
        message: 'Consider adding null check before accessing map or list elements',
        severity: 'warning',
        rule: 'MissingNullCheck'
      });
    }

    // Check for Test.startTest() and Test.stopTest() in test classes
    if (code.includes('@isTest') || code.includes('@IsTest')) {
      if (line.match(/testMethod|@isTest/i) && !code.includes('Test.startTest()')) {
        problems.push({
          line: lineNumber,
          column: 1,
          endLine: lineNumber,
          endColumn: line.length,
          message: 'Test methods should include Test.startTest() and Test.stopTest() for governor limit reset',
          severity: 'info',
          rule: 'MissingTestBlocks'
        });
      }
    }

    // Check for missing WITH SECURITY_ENFORCED
    if (line.match(/\[SELECT/i) && !code.includes('WITH SECURITY_ENFORCED')) {
      problems.push({
        line: lineNumber,
        column: line.search(/\[SELECT/i) + 1,
        endLine: lineNumber,
        endColumn: line.length,
        message: 'Consider adding WITH SECURITY_ENFORCED to SOQL queries for security',
        severity: 'warning',
        rule: 'MissingSecurityEnforced'
      });
    }
  });

  return problems;
}

export { detectSoqlQueries } from './soql-detect';
