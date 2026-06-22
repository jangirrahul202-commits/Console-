import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type FlatRecord = Record<string, string>;

function flattenValue(value: unknown, prefix = ''): FlatRecord {
  if (value === null || value === undefined) {
    return prefix ? { [prefix]: '' } : {};
  }
  if (typeof value !== 'object') {
    return prefix ? { [prefix]: String(value) } : {};
  }
  if (Array.isArray(value)) {
    return prefix ? { [prefix]: JSON.stringify(value) } : {};
  }

  const obj = value as Record<string, unknown>;
  if ('attributes' in obj) {
    const { attributes: _a, ...rest } = obj;
    const out: FlatRecord = {};
    for (const [k, v] of Object.entries(rest)) {
      const key = prefix ? `${prefix}.${k}` : k;
      Object.assign(out, flattenValue(v, key));
    }
    return out;
  }

  const out: FlatRecord = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    Object.assign(out, flattenValue(v, key));
  }
  return out;
}

export function flattenRecords(records: Record<string, unknown>[]): {
  rows: FlatRecord[];
  columns: string[];
} {
  const rows = records.map(r => flattenValue(r));
  const colSet = new Set<string>();
  rows.forEach(r => Object.keys(r).forEach(k => colSet.add(k)));
  const columns = Array.from(colSet).sort((a, b) => {
    if (a === 'Id') return -1;
    if (b === 'Id') return 1;
    return a.localeCompare(b);
  });
  return { rows, columns };
}

export function toCsv(columns: string[], rows: FlatRecord[]): string {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const header = columns.map(escape).join(',');
  const body = rows.map(r => columns.map(c => escape(r[c] ?? '')).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function toTsv(columns: string[], rows: FlatRecord[]): string {
  const header = columns.join('\t');
  const body = rows.map(r => columns.map(c => (r[c] ?? '').replace(/\t/g, ' ')).join('\t')).join('\n');
  return `${header}\n${body}`;
}

export function toJson(rows: FlatRecord[]): string {
  return JSON.stringify(rows, null, 2);
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function downloadBlob(content: string | Blob, filename: string, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadExcel(columns: string[], rows: FlatRecord[], filename: string): void {
  const data = [columns, ...rows.map(r => columns.map(c => r[c] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, filename);
}

export function downloadPdf(columns: string[], rows: FlatRecord[], filename: string): void {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
  autoTable(doc, {
    head: [columns],
    body: rows.map(r => columns.map(c => r[c] ?? '')),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [0, 120, 204] }
  });
  doc.save(filename);
}
