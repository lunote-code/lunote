import { rebuildBacklinksForTarget } from './backlinkEngine'
import { emitKnowledgeEvent } from './knowledgeEvents'
import {
  hashContent,
  isDocumentIndexStale,
  markDocumentIndexed,
  removeFromKnowledgeIndex,
} from './knowledgeIndex'
import {
  checkLinkGraphIndexInvariants,
  linkRefsFromParsedWikiLinks,
  rebuildLinkGraphIndexForDocument,
  removeLinkGraphIndexForDocument,
} from './linkGraphIndex'
import { registerHeadingTargets, unregisterHeadingTargets } from './headingLinkTargets'
import { registerDocumentMeta, unregisterDocument } from './knowledgeRegistry'
import { finalizeLinkGraphSync } from './linkGraphSync'
import { indexTagsForDocument, removeDocumentFromTagIndex } from './tagIndex'
import type { AbsoluteDocPath, DocKey, DocumentKnowledgeMeta } from './types'
import { extractTags, extractTitle, parseDocumentKnowledge } from './wikiLinkParser'
import { registerBlockRefs, unregisterBlockRefs } from './blockReference'
import { removeSearchIndexEntry, upsertSearchIndexEntry } from './searchRuntime'
import { getLinkIndexState, markLinkIndexReadyIfUpdating, markLinkIndexUpdating } from './linkIndexState'
import { absolutePathToDocKey } from './vaultRuntime'

type PendingJob = {
  docKey: DocKey
  absolutePath: AbsoluteDocPath
  content: string
  generation: number
}

const pending = new Map<DocKey, PendingJob>()
/** parseChangedDocument is temporarily stored during BOOTSTRAPPING and flushed after finishBootstrap.*/
const bootstrapPending = new Map<DocKey, PendingJob>()
let generation = 0
let idleHandle: ReturnType<typeof requestIdleCallback> | number | null = null
let draining = false

const VAULT_ROOT_REF = { current: '' as string }

export function setIndexerVaultRoot(rootDir: string): void {
  VAULT_ROOT_REF.current = rootDir
}

function scheduleIdleDrain(): void {
  if (idleHandle != null) return
  if (typeof requestIdleCallback === 'function') {
    idleHandle = requestIdleCallback(
      () => {
        idleHandle = null
        void drainIndexerQueue()
      },
      { timeout: 120 },
    )
  } else {
    idleHandle = window.setTimeout(() => {
      idleHandle = null
      void drainIndexerQueue()
    }, 16) as unknown as number
  }
}

export function parseChangedDocument(
  absolutePath: AbsoluteDocPath,
  content: string,
  rootDir?: string,
): void {
  const root = rootDir ?? VAULT_ROOT_REF.current
  if (!root) return
  const docKey = absolutePathToDocKey(root, absolutePath)
  if (!isDocumentIndexStale(docKey, content)) return

  generation += 1
  const job: PendingJob = {
    docKey,
    absolutePath,
    content,
    generation,
  }
  if (getLinkIndexState() === 'BOOTSTRAPPING') {
    bootstrapPending.set(docKey, job)
    return
  }
  pending.set(docKey, job)
  scheduleIdleDrain()
}

export function removeDocumentFromIndex(docKey: DocKey, absolutePath: AbsoluteDocPath): void {
  pending.delete(docKey)
  bootstrapPending.delete(docKey)
  removeLinkGraphIndexForDocument(docKey)
  unregisterHeadingTargets(docKey)
  unregisterBlockRefs(docKey)
  removeDocumentFromTagIndex(docKey)
  removeSearchIndexEntry(docKey)
  removeFromKnowledgeIndex(docKey, absolutePath)
  unregisterDocument(docKey)
  if (getLinkIndexState() !== 'BOOTSTRAPPING') {
    finalizeLinkGraphSync()
  }
  emitKnowledgeEvent('document-removed', { docKey, absolutePath })
}

export async function drainIndexerQueue(): Promise<void> {
  if (draining) return
  markLinkIndexUpdating()
  draining = true
  let processedAny = false
  try {
    while (pending.size > 0) {
      processedAny = true
      const batch = [...pending.values()]
      pending.clear()
      for (const job of batch) {
        await indexSingleDocument(job)
      }
    }
    if (processedAny) {
      finalizeLinkGraphSync()
    }
  } finally {
    draining = false
    const invariant = checkLinkGraphIndexInvariants()
    if (
      import.meta.env.DEV &&
      (!invariant.ok || invariant.fragmentedTargetKeySlots > 0)
    ) {
      console.warn('[LinkGraphInvariant]', invariant)
    }
    markLinkIndexReadyIfUpdating()
    if (pending.size > 0) scheduleIdleDrain()
  }
}

/** Full bootstrap/single document direct indexing (bypassing pending queue).*/
export async function indexDocumentContent(
  absolutePath: AbsoluteDocPath,
  content: string,
  rootDir: string,
  options?: { force?: boolean },
): Promise<void> {
  const docKey = absolutePathToDocKey(rootDir, absolutePath)
  if (!options?.force && !isDocumentIndexStale(docKey, content)) return
  generation += 1
  await indexSingleDocument({
    docKey,
    absolutePath,
    content,
    generation,
  })
  if (getLinkIndexState() !== 'BOOTSTRAPPING') {
    finalizeLinkGraphSync()
  }
}

/** Flush the incremental index queued during BOOTSTRAPPING after bootstrap ends.*/
export async function flushBootstrapPendingDocuments(): Promise<void> {
  if (bootstrapPending.size === 0) return
  const jobs = [...bootstrapPending.values()]
  bootstrapPending.clear()
  for (const job of jobs) {
    await indexSingleDocument(job)
  }
}

async function indexSingleDocument(job: PendingJob): Promise<void> {
  const parsed = parseDocumentKnowledge(job.content)
  const title = extractTitle(job.docKey, parsed.frontmatter)
  const fmTags = extractTags(parsed.frontmatter)
  const allTags = [...new Set([...fmTags, ...parsed.inlineTags])]

  const meta: DocumentKnowledgeMeta = {
    docKey: job.docKey,
    absolutePath: job.absolutePath,
    title,
    frontmatter: parsed.frontmatter,
    links: parsed.links,
    embeds: parsed.embeds,
    blockRefs: parsed.blockRefs,
    outboundTags: allTags,
    indexedAt: performance.now(),
    contentHash: hashContent(job.content),
    bodySample: job.content.slice(0, 2000),
  }

  registerDocumentMeta(meta)
  registerHeadingTargets(job.docKey, job.content)
  markDocumentIndexed(meta)
  registerBlockRefs(job.docKey, parsed.blockRefs)
  indexTagsForDocument(job.docKey, allTags)

  const linkRefs = linkRefsFromParsedWikiLinks(job.docKey, [...parsed.links, ...parsed.embeds])
  rebuildLinkGraphIndexForDocument(job.docKey, linkRefs)

  const affectedTargets = new Set<DocKey>(linkRefs.map((r) => r.targetDocKey))
  for (const targetDocKey of affectedTargets) {
    rebuildBacklinksForTarget(targetDocKey)
    emitKnowledgeEvent('link-added', {
      sourceDocKey: job.docKey,
      targetDocKey,
      kind: 'link',
    })
  }
  rebuildBacklinksForTarget(job.docKey)
  upsertSearchIndexEntry(
    job.docKey,
    job.absolutePath,
    title,
    allTags,
    job.content,
  )

  emitKnowledgeEvent('index-updated', {
    docKey: job.docKey,
    revision: generation,
  })
}

export function resetIncrementalIndexer(): void {
  pending.clear()
  bootstrapPending.clear()
  generation = 0
  if (idleHandle != null) {
    if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idleHandle as number)
    else clearTimeout(idleHandle as number)
    idleHandle = null
  }
}

/** Worker-ready: After serializing the parsing task, parseDocumentKnowledge can be called in the Worker*/
export function serializeParseJob(absolutePath: string, content: string): PendingJob {
  const docKey = absolutePathToDocKey(VAULT_ROOT_REF.current, absolutePath)
  return { docKey, absolutePath, content, generation: ++generation }
}
