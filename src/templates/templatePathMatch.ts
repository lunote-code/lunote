export function normalizeWorkspaceRelPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
}

/** Whether `relativePath` is a file under the given workspace-relative folder. */
export function isFileUnderWorkspaceFolder(relativePath: string, folderRel: string): boolean {
  const fileParts = normalizeWorkspaceRelPath(relativePath).split('/').filter(Boolean)
  const folderParts = normalizeWorkspaceRelPath(folderRel).split('/').filter(Boolean)
  if (folderParts.length === 0 || fileParts.length <= folderParts.length) return false
  for (let i = 0; i < folderParts.length; i++) {
    if (fileParts[i]?.toLowerCase() !== folderParts[i]?.toLowerCase()) return false
  }
  return true
}

/** Whether a docKey points at a template file rather than a normal note. */
export function isWorkspaceTemplateDocKey(
  docKey: string,
  configuredTemplatesFolders: readonly string[] = [],
): boolean {
  const normalized = normalizeWorkspaceRelPath(docKey)
  if (!normalized) return false

  const folders = configuredTemplatesFolders.length > 0 ? configuredTemplatesFolders : ['Templates']
  for (const folder of folders) {
    if (isFileUnderWorkspaceFolder(normalized, folder)) return true
  }

  const parts = normalized.split('/').filter(Boolean)
  if (parts.length >= 2) {
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i]?.toLowerCase() === 'templates') return true
    }
  }
  return false
}
