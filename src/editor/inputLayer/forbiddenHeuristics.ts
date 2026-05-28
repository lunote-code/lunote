/**
 * Input layer suppressed heuristic API/symbol names (paste automatic code blocks, etc.).
 * `src/` is scanned by Vitest for use with CI to prevent regressions.
 */
export const FORBIDDEN_INPUT_LAYER_HEURISTICS = [
  'detectCodeLikeText',
  'detectCodeBlock',
  'autoWrapCodeBlock',
  'inferCodeFromPaste',
  'markdownNormalizeToCodeBlock',
  'LunaPasteSmartCodeBlock',
  'lunaPasteCodeBlock',
  'detectLanguageFromPaste',
  'mermaidPasteParser',
  'markdownNormalizeOnPaste',
  'autoFormatMermaidSource',
  'detectDiagramOnPaste',
] as const

export type ForbiddenHeuristicId = (typeof FORBIDDEN_INPUT_LAYER_HEURISTICS)[number]

/** Allow files with forbidden symbol names (manifest itself, test assertions, etc.)*/
const ALLOWLIST_PATH_SUFFIXES = [
  'editor/inputLayer/forbiddenHeuristics.ts',
  'tests/editor/forbiddenHeuristics.scan.test.ts',
  'tests/editor/inputLayerGuard.test.ts',
] as const

export type HeuristicScanHit = {
  id: ForbiddenHeuristicId
  file: string
  line: number
  column: number
  excerpt: string
}

function isAllowlisted(relativePath: string): boolean {
  return ALLOWLIST_PATH_SUFFIXES.some((suffix) => relativePath.replace(/\\/g, '/').endsWith(suffix))
}

/**
 * Scan `.ts`/`.tsx` files under relative paths and return all positions that hit forbidden symbols.
 */
export function scanForbiddenInputLayerHeuristicsInFiles(
  files: ReadonlyArray<{ path: string; content: string }>,
): HeuristicScanHit[] {
  const hits: HeuristicScanHit[] = []

  for (const { path, content } of files) {
    const rel = path.replace(/\\/g, '/')
    if (!rel.startsWith('src/')) continue
    if (!rel.endsWith('.ts') && !rel.endsWith('.tsx')) continue
    if (isAllowlisted(rel)) continue

    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!
      for (const id of FORBIDDEN_INPUT_LAYER_HEURISTICS) {
        let col = line.indexOf(id)
        while (col !== -1) {
          hits.push({
            id,
            file: rel,
            line: i + 1,
            column: col + 1,
            excerpt: line.trim().slice(0, 120),
          })
          col = line.indexOf(id, col + id.length)
        }
      }
    }
  }

  return hits
}
