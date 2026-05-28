import { getDocumentMeta, hashContent, resolveDocKey } from '../knowledgeRuntime'
import { previewCache } from './contextCache'
import { emitInteractionEvent } from './interactionEvents'
import { bumpInteractionGeneration, scheduleInteractionTask, cancelInteractionTasksByPrefix } from './interactionScheduler'
import { buildPreviewFragment, schedulePreviewHydration } from './previewVirtualization'
import type { WikiLinkTarget } from '../knowledgeRuntime/types'
import type { PreviewFragment, PreviewTarget } from './types'

export type ContentResolver = (docKey: string) => Promise<string | null>

let contentResolver: ContentResolver | null = null
const activeHoverId = { current: null as string | null }

export function setKnowledgeContentResolver(resolver: ContentResolver | null): void {
  contentResolver = resolver
}

function previewCacheKey(target: PreviewTarget): string {
  const key = target.resolvedDocKey ?? target.docKey
  return `preview:${key}:${target.heading ?? ''}:${target.blockId ?? ''}`
}

export function resolvePreviewTarget(target: WikiLinkTarget): PreviewTarget {
  const resolvedDocKey = resolveDocKey(target.docKey)
  return { ...target, resolvedDocKey }
}

export function getCachedPreview(target: PreviewTarget): PreviewFragment | null {
  const key = previewCacheKey(target)
  const cached = previewCache.get(key) as PreviewFragment | undefined
  return cached ?? null
}

export function startHoverPreview(
  hoverId: string,
  target: WikiLinkTarget,
): void {
  const resolved = resolvePreviewTarget(target)
  activeHoverId.current = hoverId
  cancelInteractionTasksByPrefix(`hover:${hoverId}`)

  emitInteractionEvent('hover-start', {
    targetId: hoverId,
    docKey: resolved.resolvedDocKey,
  })

  const cached = getCachedPreview(resolved)
  if (cached) {
    emitInteractionEvent('preview-ready', {
      cacheKey: previewCacheKey(resolved),
      docKey: cached.docKey,
    })
    return
  }

  const gen = bumpInteractionGeneration()
  scheduleInteractionTask({
    key: `hover:${hoverId}`,
    kind: 'hover',
    priority: 'visible',
    generation: gen,
    run: async () => {
      if (activeHoverId.current !== hoverId) return
      await loadPreviewFragment(resolved, hoverId)
    },
  })
}

export function endHoverPreview(hoverId: string): void {
  if (activeHoverId.current === hoverId) activeHoverId.current = null
  cancelInteractionTasksByPrefix(`hover:${hoverId}`)
  emitInteractionEvent('hover-end', { targetId: hoverId })
}

async function loadPreviewFragment(
  target: PreviewTarget,
  hoverId: string,
): Promise<void> {
  const docKey = target.resolvedDocKey
  if (!docKey) return

  return new Promise((resolve) => {
    schedulePreviewHydration(async () => {
      if (activeHoverId.current !== hoverId) {
        resolve()
        return
      }
      const meta = getDocumentMeta(docKey)
      let markdown = ''
      if (contentResolver) {
        markdown = (await contentResolver(docKey)) ?? ''
      }
      if (!markdown && meta) {
        markdown = `# ${meta.title}\n\n*(preview unavailable — open note to load)*`
      }
      const contentHash = hashContent(markdown)
      const fragment = buildPreviewFragment(docKey, meta?.title ?? docKey, markdown, contentHash, {
        heading: target.heading,
        blockId: target.blockId,
      })
      previewCache.set(previewCacheKey(target), fragment, contentHash)
      emitInteractionEvent('preview-ready', {
        cacheKey: previewCacheKey(target),
        docKey,
      })
      resolve()
    })
  })
}

export function resetHoverPreviewRuntime(): void {
  contentResolver = null
  activeHoverId.current = null
}
