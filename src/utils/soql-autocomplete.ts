import type { SalesforceField, SalesforceObject } from '../types';

export interface RankedItem<T> {
  item: T;
  score: number;
}

function rankByRelevance(query: string, name: string, label: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const n = name.toLowerCase();
  const l = label.toLowerCase();

  if (n === q || l === q) return 100;
  if (n.startsWith(q) || l.startsWith(q)) return 80;
  if (n.includes(q) || l.includes(q)) return 50;

  let qi = 0;
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 30;
  return 0;
}

export function rankObjects(
  objects: SalesforceObject[],
  partial: string,
  limit = 12
): SalesforceObject[] {
  return objects
    .map(obj => ({
      item: obj,
      score: rankByRelevance(partial, obj.name, obj.label)
    }))
    .filter(r => r.score > 0 || !partial.trim())
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map(r => r.item);
}

export function rankFields(
  fields: SalesforceField[],
  partial: string,
  limit = 15
): SalesforceField[] {
  return filterFieldsForSuggestions(fields, partial).slice(0, limit);
}

/** Inspector-style field list: all fields when empty, strict contains-filter when typing. */
export function filterFieldsForSuggestions(
  fields: SalesforceField[],
  partial: string
): SalesforceField[] {
  const usable = fields.filter(f => f.name !== 'attributes');
  const q = partial.trim().toLowerCase();

  if (!q) {
    return [...usable].sort((a, b) => a.name.localeCompare(b.name));
  }

  return usable
    .filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.label.toLowerCase().includes(q)
    )
    .map(field => ({
      item: field,
      score: rankByRelevance(partial, field.name, field.label)
    }))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map(r => r.item);
}

export function insertAtCursor(
  text: string,
  cursor: number,
  insert: string,
  replaceLength: number
): { text: string; cursor: number } {
  const before = text.slice(0, cursor - replaceLength);
  const after = text.slice(cursor);
  const next = before + insert + after;
  const newCursor = before.length + insert.length;
  return { text: next, cursor: newCursor };
}
