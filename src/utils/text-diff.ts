import { diffLines } from 'diff';

export type DiffLineKind = 'removed' | 'added' | 'unchanged';
export type DiffHunkKind = 'modify' | 'add' | 'remove';

export interface DiffHighlight {
  line: number;
  kind: DiffLineKind;
}

export interface DiffHunk {
  id: number;
  kind: DiffHunkKind;
  leftStart: number;
  leftEnd: number;
  rightStart: number;
  rightEnd: number;
  displayLine: number;
}

export interface TextDiffResult {
  leftHighlights: DiffHighlight[];
  rightHighlights: DiffHighlight[];
  hunks: DiffHunk[];
  changeCount: number;
}

/** Strip BOM and unify CRLF/LF so pasted code compares fairly. */
export function normalizeForDiff(text: string): string {
  return text.replace(/\uFEFF/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Per-line normalize for comparison (trailing CR/spaces). */
function normalizeLine(line: string): string {
  return line.replace(/\r$/, '').replace(/\uFEFF/g, '').trimEnd();
}

export function splitLines(text: string): string[] {
  if (!text) return [];
  const parts = normalizeForDiff(text).split('\n');
  if (parts.length > 1 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}

function lineCount(value: string): number {
  if (!value) return 0;
  const lines = splitLines(value);
  return lines.length || 1;
}

function pushHunk(
  hunks: DiffHunk[],
  kind: DiffHunkKind,
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
): void {
  hunks.push({
    id: hunks.length,
    kind,
    leftStart,
    leftEnd,
    rightStart,
    rightEnd,
    displayLine: leftStart > 0 ? leftStart : Math.max(1, rightStart)
  });
}

/** Walk a diff chunk and emit precise line highlights + hunks. */
function processDiffParts(
  parts: ReturnType<typeof diffLines>,
  leftLineStart: number,
  rightLineStart: number,
  leftHighlights: DiffHighlight[],
  rightHighlights: DiffHighlight[],
  hunks: DiffHunk[]
): { leftLine: number; rightLine: number } {
  let leftLine = leftLineStart;
  let rightLine = rightLineStart;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const next = parts[i + 1];

    if (part.removed && next?.added) {
      const removedCount = lineCount(part.value);
      const addedCount = lineCount(next.value);
      const ls = leftLine;
      const rs = rightLine;

      for (let j = 0; j < removedCount; j++) {
        leftHighlights.push({ line: leftLine++, kind: 'removed' });
      }
      for (let j = 0; j < addedCount; j++) {
        rightHighlights.push({ line: rightLine++, kind: 'added' });
      }

      pushHunk(hunks, 'modify', ls, ls + removedCount - 1, rs, rs + addedCount - 1);
      i += 1;
    } else if (part.removed) {
      const count = lineCount(part.value);
      const ls = leftLine;
      for (let j = 0; j < count; j++) {
        leftHighlights.push({ line: leftLine++, kind: 'removed' });
      }
      pushHunk(hunks, 'remove', ls, ls + count - 1, rightLine, rightLine - 1);
    } else if (part.added) {
      const count = lineCount(part.value);
      const rs = rightLine;
      for (let j = 0; j < count; j++) {
        rightHighlights.push({ line: rightLine++, kind: 'added' });
      }
      pushHunk(hunks, 'add', leftLine, leftLine - 1, rs, rs + count - 1);
    } else {
      const count = lineCount(part.value);
      leftLine += count;
      rightLine += count;
    }
  }

  return { leftLine, rightLine };
}

/**
 * When outer diff groups many lines as one change (e.g. CRLF mismatch),
 * re-diff the chunk line-by-line to find only real edits.
 */
function refineModifyBlock(
  removedValue: string,
  addedValue: string,
  leftLineStart: number,
  rightLineStart: number,
  leftHighlights: DiffHighlight[],
  rightHighlights: DiffHighlight[],
  hunks: DiffHunk[]
): void {
  const removedLines = splitLines(removedValue);
  const addedLines = splitLines(addedValue);

  const removedNorm = removedLines.map(normalizeLine).join('\n');
  const addedNorm = addedLines.map(normalizeLine).join('\n');

  if (removedNorm === addedNorm) {
    return;
  }

  const innerParts = diffLines(removedNorm, addedNorm);
  processDiffParts(innerParts, leftLineStart, rightLineStart, leftHighlights, rightHighlights, hunks);
}

/** Line-level diff with paired hunks (remove+add counts as one change). */
export function computeTextDiff(left: string, right: string): TextDiffResult {
  const normLeft = normalizeForDiff(left);
  const normRight = normalizeForDiff(right);
  const parts = diffLines(normLeft, normRight);

  const leftHighlights: DiffHighlight[] = [];
  const rightHighlights: DiffHighlight[] = [];
  const hunks: DiffHunk[] = [];
  let leftLine = 1;
  let rightLine = 1;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const next = parts[i + 1];

    if (part.removed && next?.added) {
      const removedCount = lineCount(part.value);
      const addedCount = lineCount(next.value);

      refineModifyBlock(
        part.value,
        next.value,
        leftLine,
        rightLine,
        leftHighlights,
        rightHighlights,
        hunks
      );

      leftLine += removedCount;
      rightLine += addedCount;
      i += 1;
    } else if (part.removed) {
      const count = lineCount(part.value);
      const ls = leftLine;
      for (let j = 0; j < count; j++) {
        leftHighlights.push({ line: leftLine++, kind: 'removed' });
      }
      pushHunk(hunks, 'remove', ls, ls + count - 1, rightLine, rightLine - 1);
    } else if (part.added) {
      const count = lineCount(part.value);
      const rs = rightLine;
      for (let j = 0; j < count; j++) {
        rightHighlights.push({ line: rightLine++, kind: 'added' });
      }
      pushHunk(hunks, 'add', leftLine, leftLine - 1, rs, rs + count - 1);
    } else {
      const count = lineCount(part.value);
      leftLine += count;
      rightLine += count;
    }
  }

  return {
    leftHighlights,
    rightHighlights,
    hunks,
    changeCount: hunks.length
  };
}

/** Copy right hunk content onto the left document. */
export function applyHunkToLeft(left: string, right: string, hunk: DiffHunk): string {
  const leftLines = splitLines(left);
  const rightLines = splitLines(right);
  const replacement = rightLines.slice(hunk.rightStart - 1, hunk.rightEnd);
  const deleteCount = hunk.leftEnd >= hunk.leftStart ? hunk.leftEnd - hunk.leftStart + 1 : 0;
  const insertAt = Math.max(0, hunk.leftStart - 1);
  leftLines.splice(insertAt, deleteCount, ...replacement);
  return leftLines.join('\n');
}

/** Copy left hunk content onto the right document. */
export function applyHunkToRight(left: string, right: string, hunk: DiffHunk): string {
  const leftLines = splitLines(left);
  const rightLines = splitLines(right);
  const replacement = leftLines.slice(hunk.leftStart - 1, hunk.leftEnd);
  const deleteCount = hunk.rightEnd >= hunk.rightStart ? hunk.rightEnd - hunk.rightStart + 1 : 0;
  const insertAt = Math.max(0, hunk.rightStart - 1);
  rightLines.splice(insertAt, deleteCount, ...replacement);
  return rightLines.join('\n');
}
