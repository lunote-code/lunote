import { emitKnowledgeEvent } from './knowledgeEvents'
import { flushBootstrapPendingDocuments, indexDocumentContent } from './incrementalIndexer'
import { finalizeLinkGraphSync } from './linkGraphSync'
import { resetLinkGraph } from './linkGraph'
import {
  checkLinkGraphIndexInvariants,
  getLinkGraphEdgeCounts,
  resetLinkGraphIndex,
} from './linkGraphIndex'
import { getLinkIndexState, setLinkIndexState } from './linkIndexState'
import { rebuildSearchIndexFromRegistry } from './searchRuntime'
import { absolutePathToDocKey, vaultIdFromRoot } from './vaultRuntime'
import type { AbsoluteDocPath, DocKey } from './types'

export type { LinkIndexState } from './linkIndexState'
export {
  getLinkIndexState,
  subscribeLinkIndexState,
  markLinkIndexUpdating,
  markLinkIndexReadyIfUpdating,
} from './linkIndexState'

const CHUNK_SIZE = 50
const READ_CONCURRENCY = 6

let bootstrapGeneration = 0

export function resetWorkspaceLinkGraphBootstrap(): void {
  bootstrapGeneration += 1
  setLinkIndexState('UNINITIALIZED')
}

/** @internal test helper */
export function getWorkspaceLinkGraphBootstrapGenerationForTests(): number {
  return bootstrapGeneration
}

function buildCacheRevision(paths: readonly AbsoluteDocPath[]): string {
  return `${paths.length}`
}

function saveLinkGraphCache(vaultId: string, revision: string): void {
  void vaultId
  void revision
}

function scheduleIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 120 })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

function logLinkGraphBootstrap(docsParsed: number): void {
  void docsParsed
}

function prioritizeBootstrapPaths(
  paths: readonly AbsoluteDocPath[],
  activeDocKey: DocKey | null | undefined,
  rootDir: string,
): AbsoluteDocPath[] {
  if (!activeDocKey) return [...paths]
  const prioritized: AbsoluteDocPath[] = []
  const rest: AbsoluteDocPath[] = []
  for (const path of paths) {
    if (absolutePathToDocKey(rootDir, path) === activeDocKey) {
      prioritized.push(path)
    } else {
      rest.push(path)
    }
  }
  return [...prioritized, ...rest]
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  isCancelled?: () => boolean,
): Promise<void> {
  if (items.length === 0) return
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      if (isCancelled?.()) return
      const index = cursor
      cursor += 1
      await worker(items[index]!)
    }
  })
  await Promise.all(runners)
}

async function finishBootstrap(
  vaultId: string,
  revision: string,
  docsParsed: number,
): Promise<void> {
  await flushBootstrapPendingDocuments()
  finalizeLinkGraphSync()
  rebuildSearchIndexFromRegistry()
  saveLinkGraphCache(vaultId, revision)
  setLinkIndexState('READY')
  const { outgoingEdges } = getLinkGraphEdgeCounts()
  const invariant = checkLinkGraphIndexInvariants()
  if (
    import.meta.env.DEV &&
    (!invariant.ok || invariant.fragmentedTargetKeySlots > 0)
  ) {
    console.warn('[LinkGraphInvariant]', invariant)
  }
  emitKnowledgeEvent('graph-updated', { nodeCount: 0, edgeCount: outgoingEdges })
  logLinkGraphBootstrap(docsParsed)
}

/**
 * Full scan workspace: parse each document and write the complete outgoing map.
 * incoming is derived from the full amount of outgoing in one go only during finishBootstrap.
 */
export async function scanAllDocuments(
  rootDir: string,
  paths: readonly AbsoluteDocPath[],
  readContent: (path: AbsoluteDocPath) => Promise<string>,
  isCancelled?: () => boolean,
): Promise<number> {
  let parsed = 0
  for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
    if (isCancelled?.()) return parsed
    const chunk = paths.slice(i, i + CHUNK_SIZE)
    const indexedInChunk: AbsoluteDocPath[] = []
    await mapWithConcurrency(
      chunk,
      READ_CONCURRENCY,
      async (path) => {
        if (isCancelled?.()) return
        try {
          const content = await readContent(path)
          if (isCancelled?.()) return
          await indexDocumentContent(path, content, rootDir, { force: true })
          indexedInChunk.push(path)
        } catch {
          /* skip unreadable */
        }
      },
      isCancelled,
    )
    parsed += indexedInChunk.length
    await scheduleIdle()
  }
  return parsed
}

/**
 * Workspace open: always scan in full (disable snapshot short circuit to skip scanning).
 */
export function bootstrapWorkspaceLinkGraphIndex(
  rootDir: string,
  paths: AbsoluteDocPath[],
  readContent: (path: AbsoluteDocPath) => Promise<string>,
  options?: { activeDocKey?: string | null },
): Promise<number> {
  const gen = ++bootstrapGeneration
  const vaultId = vaultIdFromRoot(rootDir)
  const orderedPaths = prioritizeBootstrapPaths(paths, options?.activeDocKey ?? null, rootDir)
  const revision = buildCacheRevision(orderedPaths)
  setLinkIndexState('BOOTSTRAPPING')
  return (async () => {
    resetLinkGraphIndex()
    resetLinkGraph()

    if (gen !== bootstrapGeneration) return 0

    const docsParsed = await scanAllDocuments(
      rootDir,
      orderedPaths,
      readContent,
      () => gen !== bootstrapGeneration,
    )

    if (gen !== bootstrapGeneration) return 0
    await finishBootstrap(vaultId, revision, docsParsed)
    return docsParsed
  })()
}

/** @internal test: wait for bootstrap to enter READY*/
export async function waitForLinkIndexReady(timeoutMs = 5000): Promise<boolean> {
  if (getLinkIndexState() === 'READY') return true
  const start = performance.now()
  return new Promise((resolve) => {
    const check = () => {
      if (getLinkIndexState() === 'READY') {
        resolve(true)
        return
      }
      if (performance.now() - start > timeoutMs) {
        resolve(false)
        return
      }
      setTimeout(check, 16)
    }
    check()
  })
}
