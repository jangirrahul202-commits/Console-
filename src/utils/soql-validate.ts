import { extractFromObject } from './soql-parse';

const LARGE_OBJECTS = new Set([
  'Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event',
  'User', 'Asset', 'Campaign', 'CampaignMember', 'EmailMessage', 'Note'
]);

export interface LimitWarning {
  shouldWarn: boolean;
  message: string;
  objectName: string | null;
}

export function getLimitWarning(query: string): LimitWarning {
  const trimmed = query.trim();
  if (!trimmed) {
    return { shouldWarn: false, message: '', objectName: null };
  }

  if (/\bLIMIT\s+\d+/i.test(trimmed)) {
    return { shouldWarn: false, message: '', objectName: extractFromObject(trimmed) };
  }

  if (/\bCOUNT\s*\(\s*\)/i.test(trimmed)) {
    return { shouldWarn: false, message: '', objectName: extractFromObject(trimmed) };
  }

  const objectName = extractFromObject(trimmed);
  if (objectName && LARGE_OBJECTS.has(objectName)) {
    return {
      shouldWarn: true,
      objectName,
      message: `${objectName} can contain a very large number of records. Running without LIMIT may be slow and fetch thousands of rows.`
    };
  }

  if (objectName) {
    return {
      shouldWarn: true,
      objectName,
      message: 'No LIMIT clause found. Consider adding LIMIT 200 to keep result sets manageable.'
    };
  }

  return { shouldWarn: false, message: '', objectName: null };
}

export function appendLimit(query: string, limit = 200): string {
  const trimmed = query.trim().replace(/;+\s*$/, '');
  if (/\bLIMIT\s+\d+/i.test(trimmed)) return trimmed;
  return `${trimmed} LIMIT ${limit}`;
}
