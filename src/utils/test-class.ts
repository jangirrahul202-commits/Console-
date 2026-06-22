/** Heuristic match for Apex test classes (name ends with Test). */
export function isLikelyTestClass(name: string): boolean {
  return /test$/i.test(name);
}
