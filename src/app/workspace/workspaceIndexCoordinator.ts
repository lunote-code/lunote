import { indexWorkspaceFiles } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import type { AbsoluteDocPath } from '../../editor/knowledgeRuntime/types'
import { isCompatibilityTraceEnabled } from '../../debug/compatibilityDebug'
import { indexWorkspaceNotes } from '../../platform/tauri/workspaceService'

export type WorkspaceIndexRunResult = {
  noteCount: number
  graphIndexedCount: number
}

export async function runWorkspaceIndexing(
  rootDir: string,
  paths: AbsoluteDocPath[],
  options?: { activeDocKey?: string | null },
): Promise<WorkspaceIndexRunResult> {
  const trace = isCompatibilityTraceEnabled('workspaceIndex')
  if (trace) {
    console.info('[workspace-index] run start', {
      rootDir,
      pathCount: paths.length,
      activeDocKey: options?.activeDocKey ?? null,
    })
  }
  const noteCount = await indexWorkspaceNotes(rootDir)
  const graphIndexedCount = await indexWorkspaceFiles(rootDir, paths, options)
  if (trace) {
    console.info('[workspace-index] run done', {
      rootDir,
      noteCount,
      graphIndexedCount,
    })
  }
  return { noteCount, graphIndexedCount }
}

export async function refreshWorkspaceIndex(rootDir: string): Promise<number> {
  const trace = isCompatibilityTraceEnabled('workspaceIndex')
  if (trace) {
    console.info('[workspace-index] refresh start', { rootDir })
  }
  const noteCount = await indexWorkspaceNotes(rootDir)
  if (trace) {
    console.info('[workspace-index] refresh done', { rootDir, noteCount })
  }
  return noteCount
}
