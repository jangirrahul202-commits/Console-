import type {
  SalesforceField,
  SalesforceObject,
  SoqlFieldSuggestion,
  FieldSuggestionContext
} from '../types';
import { getFieldPartialInSelect } from './soql-parse';

function objectLabel(objects: SalesforceObject[], apiName: string): string {
  return objects.find(o => o.name === apiName)?.label ?? apiName;
}

function rankScore(query: string, ...parts: string[]): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  let best = 0;
  for (const part of parts) {
    const p = part.toLowerCase();
    if (p === q) best = Math.max(best, 100);
    else if (p.startsWith(q)) best = Math.max(best, 80);
    else if (p.includes(q)) best = Math.max(best, 50);
  }
  return best;
}

export function getFieldTypeIcon(type: string, isRelationship = false): string {
  if (isRelationship) return '↗';
  const t = type.toLowerCase();
  if (t === 'reference') return '⎘';
  if (t === 'id') return '🔑';
  if (t === 'string' || t === 'textarea' || t === 'encryptedstring') return 'Aa';
  if (t === 'boolean') return '☑';
  if (t === 'date' || t === 'datetime' || t === 'time') return '📅';
  if (t === 'currency' || t === 'double' || t === 'int' || t === 'percent' || t === 'long') return '#';
  if (t === 'picklist' || t === 'multipicklist' || t === 'combobox') return '▾';
  if (t === 'email') return '@';
  if (t === 'phone') return '☎';
  if (t === 'url') return '🔗';
  if (t === 'address') return '📍';
  if (t === 'base64') return '📎';
  return '◆';
}

export function resolveRelPathToObject(
  rootObject: string,
  relPath: string,
  rootFields: SalesforceField[],
  relatedFieldsMap: Map<string, SalesforceField[]>
): string | null {
  if (!relPath) return rootObject;

  const segments = relPath.split('.');
  let currentObject = rootObject;
  let currentFields = rootFields;

  for (const seg of segments) {
    const relField = currentFields.find(f => f.relationshipName === seg);
    if (!relField?.referenceTo?.[0]) return null;
    currentObject = relField.referenceTo[0];
    currentFields = relatedFieldsMap.get(currentObject) ?? [];
  }
  return currentObject;
}

export function getFieldSuggestionContext(
  query: string,
  cursorPos: number,
  fromObject: string,
  rootFields: SalesforceField[],
  relatedFieldsMap: Map<string, SalesforceField[]>,
  objects: SalesforceObject[]
): FieldSuggestionContext | null {
  if (!fromObject) return null;

  const upper = query.toUpperCase();
  const fromIdx = upper.indexOf(' FROM ');
  const selectEnd = fromIdx > -1 ? fromIdx : query.length;
  if (cursorPos > selectEnd || !/\bSELECT\b/i.test(query)) return null;

  const before = query.slice(0, Math.min(cursorPos, selectEnd));
  const tokenPartial = getFieldPartialInSelect(query, cursorPos);

  const afterRelDot = before.match(/([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\.([A-Za-z0-9_]*)$/);
  if (afterRelDot) {
    const pathPart = afterRelDot[1];
    const fieldPartial = afterRelDot[2];
    const resolved = resolveRelPathToObject(fromObject, pathPart, rootFields, relatedFieldsMap);
    if (resolved) {
      return {
        contextObject: resolved,
        contextObjectLabel: objectLabel(objects, resolved),
        relationshipPrefix: pathPart,
        fieldPartial
      };
    }
  }

  if (tokenPartial.endsWith('.')) {
    const relPath = tokenPartial.slice(0, -1);
    const resolved = resolveRelPathToObject(fromObject, relPath, rootFields, relatedFieldsMap);
    if (resolved) {
      return {
        contextObject: resolved,
        contextObjectLabel: objectLabel(objects, resolved),
        relationshipPrefix: relPath,
        fieldPartial: ''
      };
    }
  }

  return {
    contextObject: fromObject,
    contextObjectLabel: objectLabel(objects, fromObject),
    relationshipPrefix: '',
    fieldPartial: tokenPartial
  };
}

/** Inspector-style: current-level fields + __r. drill entries only */
export function buildContextFieldSuggestions(
  ctx: FieldSuggestionContext,
  contextFields: SalesforceField[],
  objects: SalesforceObject[]
): SoqlFieldSuggestion[] {
  const prefix = ctx.relationshipPrefix ? `${ctx.relationshipPrefix}.` : '';
  const results: SoqlFieldSuggestion[] = [];

  for (const field of contextFields) {
    if (field.name === 'attributes') continue;

    results.push({
      path: `${prefix}${field.name}`,
      label: field.label,
      type: field.type,
      objectName: ctx.contextObject,
      objectLabel: ctx.contextObjectLabel,
      isRelationship: !!ctx.relationshipPrefix,
      isRelDrill: false
    });

    if (field.relationshipName && field.referenceTo?.[0]) {
      const refLabel = objectLabel(objects, field.referenceTo[0]);
      results.push({
        path: `${prefix}${field.relationshipName}.`,
        label: `${field.label} → ${refLabel}`,
        type: 'reference',
        objectName: field.referenceTo[0],
        objectLabel: refLabel,
        isRelationship: true,
        isRelDrill: true
      });
    }
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export function filterSoqlFieldSuggestions(
  suggestions: SoqlFieldSuggestion[],
  partial: string
): SoqlFieldSuggestion[] {
  const q = partial.trim().toLowerCase();
  if (!q) return suggestions;

  return suggestions
    .filter(s => {
      const pathMatch = s.path.toLowerCase().includes(q);
      const labelMatch = s.label.toLowerCase().includes(q);
      const objectMatch =
        s.objectName.toLowerCase().includes(q) ||
        s.objectLabel.toLowerCase().includes(q);
      return pathMatch || labelMatch || objectMatch;
    })
    .map(s => ({
      item: s,
      score: rankScore(q, s.path, s.label, s.objectName, s.objectLabel)
    }))
    .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path))
    .map(r => r.item);
}

export function filterObjectSuggestions(
  objects: SalesforceObject[],
  partial: string
): SalesforceObject[] {
  const q = partial.trim().toLowerCase();
  if (!q) return [...objects].sort((a, b) => a.name.localeCompare(b.name));

  return objects
    .filter(
      o =>
        o.name.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q)
    )
    .map(o => ({
      item: o,
      score: rankScore(q, o.name, o.label)
    }))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map(r => r.item);
}
