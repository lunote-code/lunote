import type { FsTreeNode } from './workspace/types'

export const QA_BULK_WORKSPACE_ROOT = '/qa-bulk-vault'
export const QA_BULK_WORKSPACE_FILE_COUNT = 1000
export const QA_BULK_WORKSPACE_NOTES_DIR = `${QA_BULK_WORKSPACE_ROOT}/notes`

export function buildQaBulkWorkspaceFilePath(index: number): string {
  const padded = String(index).padStart(4, '0')
  return `${QA_BULK_WORKSPACE_NOTES_DIR}/doc-${padded}.md`
}

export function buildQaBulkWorkspaceFilePaths(
  count: number = QA_BULK_WORKSPACE_FILE_COUNT,
): string[] {
  const safeCount = Math.max(0, Math.floor(count))
  return Array.from({ length: safeCount }, (_, index) => buildQaBulkWorkspaceFilePath(index))
}

export function buildQaBulkWorkspaceTree(
  count: number = QA_BULK_WORKSPACE_FILE_COUNT,
): FsTreeNode[] {
  const safeCount = Math.max(0, Math.floor(count))
  const children: FsTreeNode[] = Array.from({ length: safeCount }, (_, index) => {
    const padded = String(index).padStart(4, '0')
    return {
      name: `doc-${padded}.md`,
      path: buildQaBulkWorkspaceFilePath(index),
      kind: 'file',
      children: [],
    }
  })
  return [
    {
      name: 'notes',
      path: QA_BULK_WORKSPACE_NOTES_DIR,
      kind: 'dir',
      children,
    },
  ]
}
