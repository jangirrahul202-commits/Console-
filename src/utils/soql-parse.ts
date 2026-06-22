/** Lightweight SOQL parsing for autocomplete and field suggestions */

export interface SoqlContext {
  type: 'object' | 'field' | 'none';
  partial: string;
  fromObject: string | null;
}

export function extractFromObject(query: string): string | null {
  const match = query.match(/\bFROM\s+([A-Za-z][A-Za-z0-9_]*)/i);
  return match?.[1] ?? null;
}

export function getSoqlContext(query: string, cursorPos: number): SoqlContext {
  const before = query.slice(0, cursorPos);
  const fromObject = extractFromObject(query);

  const fromTyping = before.match(/\bFROM\s+([A-Za-z0-9_]*)$/i);
  if (fromTyping) {
    return { type: 'object', partial: fromTyping[1], fromObject };
  }

  const upper = query.toUpperCase();
  const fromIdx = upper.indexOf(' FROM ');
  if (fromIdx === -1 && !upper.trimStart().startsWith('FROM ')) {
    return { type: 'none', partial: '', fromObject };
  }

  const selectEnd = fromIdx > -1 ? fromIdx : query.length;
  if (cursorPos > selectEnd) {
    return { type: 'none', partial: '', fromObject };
  }

  if (!fromObject) {
    return { type: 'none', partial: '', fromObject };
  }

  const partial = getFieldPartialInSelect(query, cursorPos);
  if (partial.length > 0 || isCursorInSelectClause(query, cursorPos)) {
    return { type: 'field', partial, fromObject };
  }

  return { type: 'none', partial: '', fromObject };
}

export function isCursorInSelectClause(query: string, cursorPos: number): boolean {
  const upper = query.toUpperCase();
  const fromIdx = upper.indexOf(' FROM ');
  const selectEnd = fromIdx > -1 ? fromIdx : query.length;
  return cursorPos <= selectEnd && /\bSELECT\b/i.test(query);
}

/** Token being typed at cursor within the SELECT clause (walk backwards). */
export function getFieldPartialInSelect(query: string, cursorPos: number): string {
  const upper = query.toUpperCase();
  const fromIdx = upper.indexOf(' FROM ');
  const selectEnd = fromIdx > -1 ? fromIdx : query.length;
  if (cursorPos > selectEnd || !/\bSELECT\b/i.test(query)) return '';

  let i = Math.min(cursorPos, selectEnd) - 1;
  let partial = '';
  while (i >= 0 && /[A-Za-z0-9_.]/.test(query[i])) {
    partial = query[i] + partial;
    i--;
  }
  return partial;
}

export function extractSelectFields(query: string): string[] {
  const upper = query.toUpperCase();
  const fromIdx = upper.indexOf(' FROM ');
  if (fromIdx === -1) return [];

  const selectPart = query.slice(0, fromIdx).replace(/^SELECT\s+/i, '').trim();
  if (!selectPart || selectPart === '*') return ['*'];

  const fields: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of selectPart) {
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      if (current.trim()) fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}
