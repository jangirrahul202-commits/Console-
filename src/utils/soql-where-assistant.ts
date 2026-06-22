import type { SalesforceField } from '../types';
import { extractFromObject } from './soql-parse';

export interface WhereClauseBounds {
  start: number;
  end: number;
  text: string;
}

export interface WhereSuggestion {
  insert: string;
  label: string;
  kind: 'field' | 'operator' | 'picklist' | 'literal' | 'boolean';
}

export interface WhereSuggestionContext {
  partial: string;
  partialStart: number;
  fieldName: string | null;
  kind: 'field' | 'operator' | 'value' | 'literal';
}

const OPERATORS = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'INCLUDES', 'EXCLUDES'];
const DATE_LITERALS = [
  'TODAY', 'YESTERDAY', 'TOMORROW', 'THIS_WEEK', 'LAST_WEEK', 'NEXT_WEEK',
  'THIS_MONTH', 'LAST_MONTH', 'NEXT_MONTH', 'THIS_QUARTER', 'LAST_QUARTER',
  'THIS_YEAR', 'LAST_YEAR', 'LAST_N_DAYS:7', 'LAST_N_DAYS:30', 'LAST_90_DAYS'
];

export function getWhereClauseBounds(query: string): WhereClauseBounds | null {
  const upper = query.toUpperCase();
  const whereIdx = upper.search(/\bWHERE\b/);
  if (whereIdx === -1) return null;

  const start = query.indexOf(' ', whereIdx) + 1;
  let end = query.length;
  for (const marker of [' ORDER BY ', ' GROUP BY ', ' LIMIT ', ' OFFSET ', ' HAVING ']) {
    const idx = upper.indexOf(marker, start);
    if (idx !== -1 && idx < end) end = idx;
  }
  return { start, end, text: query.slice(start, end) };
}

export function isCursorInWhereClause(query: string, cursorPos: number): boolean {
  const bounds = getWhereClauseBounds(query);
  if (!bounds) return false;
  return cursorPos >= bounds.start && cursorPos <= bounds.end;
}

function tokenAtCursor(text: string, offset: number): { partial: string; start: number } {
  let i = Math.min(offset, text.length) - 1;
  let partial = '';
  while (i >= 0 && /[A-Za-z0-9_:.']/.test(text[i])) {
    partial = text[i] + partial;
    i--;
  }
  return { partial, start: i + 1 };
}

function fieldBeforeCursor(whereBefore: string): string | null {
  const trimmed = whereBefore.trimEnd();
  const match = trimmed.match(
    /(?:^|\bAND\s+|\bOR\s+)([A-Za-z][A-Za-z0-9_.]*)\s*(?:=|!=|<>|<=|>=|<|>|LIKE|IN|INCLUDES|EXCLUDES)?\s*'?([^']*)?'?\s*$/i
  );
  return match?.[1] ?? null;
}

function hasOperatorBeforeValue(whereBefore: string, fieldName: string): boolean {
  const re = new RegExp(
    `\\b${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:=|!=|<>|<=|>=|<|>|LIKE|IN|INCLUDES|EXCLUDES)\\s*'?([^']*)?'?\\s*$`,
    'i'
  );
  return re.test(whereBefore.trimEnd());
}

export function getWhereSuggestionContext(
  query: string,
  cursorPos: number
): WhereSuggestionContext | null {
  const bounds = getWhereClauseBounds(query);
  if (!bounds || cursorPos < bounds.start || cursorPos > bounds.end) return null;

  const offset = cursorPos - bounds.start;
  const before = bounds.text.slice(0, offset);
  const { partial, start } = tokenAtCursor(bounds.text, offset);
  const fieldName = fieldBeforeCursor(before);

  if (fieldName && hasOperatorBeforeValue(before, fieldName)) {
    return {
      partial,
      partialStart: bounds.start + start,
      fieldName,
      kind: 'value'
    };
  }

  if (fieldName && /\s$/.test(before) && !hasOperatorBeforeValue(before, fieldName)) {
    const lastWord = before.trimEnd().split(/\s+/).pop() ?? '';
    if (lastWord === fieldName) {
      return { partial, partialStart: bounds.start + start, fieldName, kind: 'operator' };
    }
  }

  if (/'\s*$/.test(before) || /\=\s*'$/.test(before)) {
    return { partial, partialStart: bounds.start + start, fieldName, kind: 'literal' };
  }

  return {
    partial,
    partialStart: bounds.start + start,
    fieldName: null,
    kind: 'field'
  };
}

export function buildWhereSuggestions(
  ctx: WhereSuggestionContext,
  fields: SalesforceField[],
  partial: string
): WhereSuggestion[] {
  const q = partial.trim().toLowerCase();
  const results: WhereSuggestion[] = [];

  if (ctx.kind === 'field') {
    for (const f of fields) {
      if (f.name === 'attributes') continue;
      if (!q || f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)) {
        results.push({ insert: f.name, label: `${f.label} (${f.type})`, kind: 'field' });
      }
    }
    if (!q || 'and'.startsWith(q)) results.push({ insert: 'AND ', label: 'AND', kind: 'literal' });
    if (!q || 'or'.startsWith(q)) results.push({ insert: 'OR ', label: 'OR', kind: 'literal' });
    return results.slice(0, 30);
  }

  if (ctx.kind === 'operator') {
    for (const op of OPERATORS) {
      if (!q || op.toLowerCase().startsWith(q)) {
        results.push({ insert: `${op} `, label: op, kind: 'operator' });
      }
    }
    return results;
  }

  if (ctx.kind === 'value' && ctx.fieldName) {
    const field = fields.find(f => f.name === ctx.fieldName);
    if (field?.type === 'boolean') {
      for (const v of ['true', 'false']) {
        if (!q || v.startsWith(q)) results.push({ insert: v, label: v, kind: 'boolean' });
      }
      return results;
    }
    if (field?.picklistValues?.length) {
      for (const pv of field.picklistValues) {
        if (!q || pv.value.toLowerCase().includes(q) || pv.label.toLowerCase().includes(q)) {
          results.push({
            insert: `'${pv.value.replace(/'/g, "\\'")}'`,
            label: pv.label,
            kind: 'picklist'
          });
        }
      }
      return results.slice(0, 40);
    }
  }

  for (const lit of DATE_LITERALS) {
    if (!q || lit.toLowerCase().includes(q)) {
      results.push({ insert: lit, label: lit, kind: 'literal' });
    }
  }
  if (!q || 'null'.startsWith(q)) results.push({ insert: 'NULL', label: 'NULL', kind: 'literal' });

  return results.slice(0, 30);
}

export function buildCountQuery(query: string): string | null {
  const objectName = extractFromObject(query);
  if (!objectName) return null;
  const bounds = getWhereClauseBounds(query);
  const whereSuffix = bounds ? ` WHERE ${bounds.text.trim()}` : '';
  return `SELECT COUNT() FROM ${objectName}${whereSuffix}`;
}
