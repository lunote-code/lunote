/**
 * Fold Windows CRLF and legacy Mac CR into Unix LF.
 * Used for dirty compare, status-bar stats, code-block lines, and disk writes.
 */
export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/gu, '\n')
}
