/** Normalize SOQL extracted from Apex source. */
function normalizeSoqlQuery(raw: string): string {
  return raw
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidSoql(query: string): boolean {
  return /^SELECT\s+/i.test(query) && /\bFROM\b/i.test(query);
}

/** Bracket SOQL: [ SELECT ... FROM ... ] including multi-line. */
function detectBracketSoql(lines: string[]): Array<{ line: number; query: string }> {
  const queries: Array<{ line: number; query: string }> = [];
  let inBracket = false;
  let bracketStartIndex = 0;
  let bracketLines: string[] = [];

  const flush = () => {
    const content = bracketLines.join('\n');
    const match = content.match(/\[\s*(SELECT[\s\S]*?)\s*\]/i);
    if (!match) return;

    const query = normalizeSoqlQuery(match[1]);
    if (!isValidSoql(query)) return;

    let selectLine = bracketStartIndex + 1;
    for (let k = 0; k < bracketLines.length; k++) {
      if (/\bSELECT\b/i.test(bracketLines[k])) {
        selectLine = bracketStartIndex + k + 1;
        break;
      }
    }

    queries.push({ line: selectLine, query });
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!inBracket && (trimmed.startsWith('//') || trimmed.startsWith('*'))) continue;

    if (!inBracket) {
      const openIdx = line.indexOf('[');
      if (openIdx === -1) continue;

      inBracket = true;
      bracketStartIndex = index;
      bracketLines = [line];

      const closeIdx = line.indexOf(']', openIdx + 1);
      if (closeIdx !== -1) {
        flush();
        inBracket = false;
        bracketLines = [];
      }
    } else {
      bracketLines.push(line);
      if (line.includes(']')) {
        flush();
        inBracket = false;
        bracketLines = [];
      }
    }
  }

  return queries;
}

/** Database.query('SELECT ...') on one line. */
function detectDatabaseQuerySoql(lines: string[]): Array<{ line: number; query: string }> {
  const queries: Array<{ line: number; query: string }> = [];
  const patterns = [
    /Database\.query\s*\(\s*['"](SELECT[\s\S]*?)['"]\s*\)/i,
    /Database\.getQueryLocator\s*\(\s*['"](SELECT[\s\S]*?)['"]\s*\)/i,
    /Database\.countQuery\s*\(\s*['"](SELECT[\s\S]*?)['"]\s*\)/i
  ];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const query = normalizeSoqlQuery(match[1]);
      if (isValidSoql(query)) {
        queries.push({ line: index + 1, query });
      }
    }
  });

  return queries;
}

/**
 * Detect SOQL queries in Apex for editor gutter icons.
 * Supports multi-line bracket queries and Database.query strings.
 */
export function detectSoqlQueries(code: string): Array<{ line: number; query: string }> {
  const lines = code.split('\n');
  const seen = new Set<string>();
  const results: Array<{ line: number; query: string }> = [];

  for (const entry of [...detectBracketSoql(lines), ...detectDatabaseQuerySoql(lines)]) {
    const key = `${entry.line}:${entry.query}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(entry);
  }

  return results.sort((a, b) => a.line - b.line);
}
