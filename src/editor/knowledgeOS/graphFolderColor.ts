/** Deterministic folder colors for the local knowledge graph. */
const FOLDER_COLOR_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
] as const

export function graphFolderKeyFromDocKey(docKey: string): string {
  const normalized = docKey.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const slash = normalized.indexOf('/')
  if (slash === -1) return ''
  return normalized.slice(0, slash)
}

function hashFolderKey(folderKey: string): number {
  let hash = 0
  for (let i = 0; i < folderKey.length; i += 1) {
    hash = (hash * 31 + folderKey.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function graphFolderColor(folderKey: string): string {
  const index = hashFolderKey(folderKey) % FOLDER_COLOR_PALETTE.length
  return FOLDER_COLOR_PALETTE[index] ?? FOLDER_COLOR_PALETTE[0]
}

export function collectGraphFolderLegendEntries(
  nodes: readonly { docKey: string; status: string; id: string }[],
): Array<{ folderKey: string; color: string }> {
  const seen = new Map<string, string>()
  for (const node of nodes) {
    if (node.status === 'unresolved' || node.id.startsWith('heading:')) continue
    const folderKey = graphFolderKeyFromDocKey(node.docKey)
    if (!seen.has(folderKey)) {
      seen.set(folderKey, graphFolderColor(folderKey))
    }
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folderKey, color]) => ({ folderKey, color }))
}
