/** Format SOQL for readability */

function splitSelectFields(selectPart: string): string[] {
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

const CLAUSE_BREAKS = [
  ' FROM ',
  ' WHERE ',
  ' ORDER BY ',
  ' GROUP BY ',
  ' LIMIT ',
  ' OFFSET ',
  ' HAVING '
];

const UPPER_KEYWORDS = /\b(select|from|where|order by|group by|limit|offset|having|and|or|not|in|like|asc|desc|null|true|false)\b/gi;

export function formatSoql(raw: string): string {
  let q = raw.trim().replace(/\s+/g, ' ');

  for (const clause of CLAUSE_BREAKS) {
    const re = new RegExp(clause, 'gi');
    q = q.replace(re, `\n${clause.trim()} `);
  }

  const lines = q.split('\n').map(l => l.trim()).filter(Boolean);
  const out: string[] = [];

  for (const line of lines) {
    if (/^SELECT\s+/i.test(line)) {
      const fieldsPart = line.replace(/^SELECT\s+/i, '');
      const fields = splitSelectFields(fieldsPart);
      out.push('SELECT');
      fields.forEach((field, i) => {
        out.push(`  ${field}${i < fields.length - 1 ? ',' : ''}`);
      });
    } else {
      out.push(line.replace(UPPER_KEYWORDS, m => m.toUpperCase()));
    }
  }

  return out.join('\n');
}
