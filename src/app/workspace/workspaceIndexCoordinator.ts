import { listen } from '@tauri-apps/api/event'
import { indexWorkspaceFiles } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { resetWorkspaceLinkGraphBootstrap } from '../../editor/knowledgeRuntime/workspaceLinkGraphBootstrap'
import type { AbsoluteDocPath } from '../../editor/knowledgeRuntime/types'
import { isCompatibilityTraceEnabled } from '../../debug/compatibilityDebug'
import { readDocument } from '../../io/documentIO'
import { indexWorkspaceNotes, cancelWorkspaceIndexNotes, WORKSPACE_INDEX_CANCELLED, WORKSPACE_INDEX_PROGRESS_EVENT, type WorkspaceIndexProgress } from '../../platform/tauri/workspaceService'
import { isTauri } from '@tauri-apps/api/core'
import {
  clearWorkspaceIndexPrefetches,
  createWorkspaceIndexReadContent,
  drainWorkspaceIndexPrefetches,
} from './workspaceIndexContentPrefetch'
import {
  clearWorkspaceIndexProgress,
  patchWorkspaceIndexProgress,
} from './workspaceIndexProgressStore'

export type WorkspaceIndexRunResult = {
  noteCount: number
  graphIndexedCount: number
}

export class WorkspaceIndexingCancelledError extends Error {
  constructor(message = 'Workspace indexing cancelled') {
    super(message)
    this.name = 'WorkspaceIndexingCancelledError'
  }
}

let indexProgressUnlisten: (() => void) | undefined
let indexProgressListenerCount = 0

function ensureWorkspaceIndexProgressListener(): void {
  if (!isTauri() || indexProgressUnlisten) return
  indexProgressListenerCount += 1
  void listen<WorkspaceIndexProgress>(WORKSPACE_INDEX_PROGRESS_EVENT, (event) => {
      patchWorkspaceIndexProgress(event.payload.root, {
        phase: event.payload.phase === 'writing' ? 'writing' : 'reading',
        processed: event.payload.processed,
        total: event.payload.total,
      })
    }).then((unlisten) => {
      indexProgressUnlisten = () => {
        indexProgressListenerCount = Math.max(0, indexProgressListenerCount - 1)
        if (indexProgressListenerCount === 0) {
          unlisten()
          indexProgressUnlisten = undefined
        }
      }
    })
}

let backgroundIndexGeneration = 0

function assertBackgroundIndexingGeneration(generation: number): void {
  if (generation !== backgroundIndexGeneration) {
    throw new WorkspaceIndexingCancelledError()
  }
}

export function getBackgroundWorkspaceIndexGenerationForTests(): number {
  return backgroundIndexGeneration
}

export function isBackgroundWorkspaceIndexGenerationStale(generation: number): boolean {
  return generation !== backgroundIndexGeneration
}

export function cancelBackgroundWorkspaceIndexing(): void {
  backgroundIndexGeneration += 1
  resetWorkspaceLinkGraphBootstrap()
  clearWorkspaceIndexPrefetches()
  if (isTauri()) {
    void cancelWorkspaceIndexNotes()
  }
}

function isWorkspaceIndexCancelledError(error: unknown): boolean {
  if (error instanceof WorkspaceIndexingCancelledError) return true
  if (typeof error === 'string' && error === WORKSPACE_INDEX_CANCELLED) return true
  if (error instanceof Error && error.message === WORKSPACE_INDEX_CANCELLED) return true
  return false
}

export async function runWorkspaceIndexing(
  rootDir: string,
  paths: AbsoluteDocPath[],
  options?: { activeDocKey?: string | null; generation?: number },
): Promise<WorkspaceIndexRunResult> {
  const generation = options?.generation ?? backgroundIndexGeneration
  const trace = isCompatibilityTraceEnabled('workspaceIndex')
  if (trace) {
    console.info('[workspace-index] run start', {
      rootDir,
      pathCount: paths.length,
      activeDocKey: options?.activeDocKey ?? null,
      generation,
    })
  }
  ensureWorkspaceIndexProgressListener()
  patchWorkspaceIndexProgress(rootDir, { processed: 0, total: 0, phase: 'reading' })
  const rootNorm = rootDir.replace(/[/\\]+$/u, '')
  try {
    assertBackgroundIndexingGeneration(generation)
    const readContent = createWorkspaceIndexReadContent(rootNorm, (path) => readDocument(rootNorm, path))
    const graphIndexedCount = await indexWorkspaceFiles(rootDir, paths, {
      ...options,
      readContent,
    })
    assertBackgroundIndexingGeneration(generation)
    const prefetched = drainWorkspaceIndexPrefetches(rootNorm)
    let noteCount = 0
    try {
      noteCount = await indexWorkspaceNotes(rootNorm, prefetched)
    } catch (error) {
      if (isWorkspaceIndexCancelledError(error)) {
        throw new WorkspaceIndexingCancelledError()
      }
      throw error
    } finally {
      clearWorkspaceIndexPrefetches(rootNorm)
    }
    assertBackgroundIndexingGeneration(generation)
    if (trace) {
      console.info('[workspace-index] run done', {
        rootDir,
        noteCount,
        graphIndexedCount,
        generation,
      })
    }
    return { noteCount, graphIndexedCount }
  } finally {
    if (generation === backgroundIndexGeneration) {
      clearWorkspaceIndexProgress(rootDir)
    }
  }
}

export function startBackgroundWorkspaceIndexing(
  rootDir: string,
  paths: AbsoluteDocPath[],
  options?: {
    activeDocKey?: string | null
    onComplete?: (result: WorkspaceIndexRunResult) => void
    onError?: (error: unknown) => void
  },
): void {
  const generation = ++backgroundIndexGeneration
  ensureWorkspaceIndexProgressListener()
  patchWorkspaceIndexProgress(rootDir, { processed: 0, total: 0, phase: 'reading' })
  void runWorkspaceIndexing(rootDir, paths, {
    activeDocKey: options?.activeDocKey,
    generation,
  })
    .then((result) => {
      if (isBackgroundWorkspaceIndexGenerationStale(generation)) return
      options?.onComplete?.(result)
    })
    .catch((error) => {
      if (isBackgroundWorkspaceIndexGenerationStale(generation)) return
      if (error instanceof WorkspaceIndexingCancelledError) return
      clearWorkspaceIndexProgress(rootDir)
      options?.onError?.(error)
    })
}

export async function refreshWorkspaceIndex(rootDir: string): Promise<number> {
  const trace = isCompatibilityTraceEnabled('workspaceIndex')
  if (trace) {
    console.info('[workspace-index] refresh start', { rootDir })
  }
  ensureWorkspaceIndexProgressListener()
  patchWorkspaceIndexProgress(rootDir, { processed: 0, total: 0, phase: 'reading' })
  try {
    const noteCount = await indexWorkspaceNotes(rootDir)
    if (trace) {
      console.info('[workspace-index] refresh done', { rootDir, noteCount })
    }
    return noteCount
  } finally {
    clearWorkspaceIndexProgress(rootDir)
  }
}

export function resetBackgroundWorkspaceIndexingForTests(): void {
  backgroundIndexGeneration = 0
}
