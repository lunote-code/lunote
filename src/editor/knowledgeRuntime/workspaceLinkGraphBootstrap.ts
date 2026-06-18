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
import { vaultIdFromRoot } from './vaultRuntime'
import type { AbsoluteDocPath } from './types'

export type { LinkIndexState } from './linkIndexState'
export {
  getLinkIndexState,
  subscribeLinkIndexState,
  markLinkIndexUpdating,
  markLinkIndexReadyIfUpdating,
} from './linkIndexState'

const CHUNK_SIZE = 50

let bootstrapGeneration = 0

export function resetWorkspaceLinkGraphBootstrap(): void {
  bootstrapGeneration += 1
  setLinkIndexState('UNINITIALIZED')
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
): Promise<number> {
  let parsed = 0
  for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
    const chunk = paths.slice(i, i + CHUNK_SIZE)
    for (const path of chunk) {
      try {
        const content = await readContent(path)
        await indexDocumentContent(path, content, rootDir, { force: true })
        parsed += 1
      } catch {
        /* skip unreadable */
      }
    }
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
  void options
  const gen = ++bootstrapGeneration
  const vaultId = vaultIdFromRoot(rootDir)
  const revision = buildCacheRevision(paths)
  setLinkIndexState('BOOTSTRAPPING')
  return (async () => {
    resetLinkGraphIndex()
    resetLinkGraph()

    if (gen !== bootstrapGeneration) return 0

    const docsParsed = await scanAllDocuments(rootDir, paths, readContent)

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
