import { pathsEqual } from '../../lib/workspacePathUtils'
import {
  resolveEditorAnchor,
  type EditorAnchorRevealRequest,
} from './editorAnchorNavigation'

export type MainPaneMode = 'visual' | 'source'

export type VisualNavigationHydrationStatus = {
  editorMounted: boolean
  /** The current PM document is mounted and belongs to the target documentKey*/
  pmDocReady: boolean
  isHeadingSlugIndexed: (slug: string) => boolean
}

export type EditorNavigationReadinessProbe = {
  getActiveAbsolutePath: () => string
  getActiveMarkdown: () => string
  getMainPaneMode: () => MainPaneMode
  getVisualHydrationStatus: (documentKey: string) => VisualNavigationHydrationStatus
  getSourceEditorMounted: () => boolean
}

export type EditorNavigationReadyRequest = EditorAnchorRevealRequest

export type EditorNavigationReadyResult =
  | { ok: true; markdown: string; mainPaneMode: MainPaneMode }
  | { ok: false; reason: string; cancelled?: boolean }

let navigationRevealGeneration = 0

/** It is incremented before each "open document + reveal" is initiated to prevent expired reveal from falling on the wrong document.*/
export function beginNavigationReveal(): number {
  navigationRevealGeneration += 1
  return navigationRevealGeneration
}

export function getNavigationRevealGeneration(): number {
  return navigationRevealGeneration
}

export function isNavigationRevealCurrent(generation: number): boolean {
  return generation === navigationRevealGeneration
}

/** Whether the anchor is resolvable on the currently active markdown (and PM title index under Visual).*/
export function isEditorNavigationAnchorReady(
  request: Pick<EditorAnchorRevealRequest, 'docKey' | 'heading' | 'blockId'>,
  _activeMarkdown: string,
  visual?: Pick<VisualNavigationHydrationStatus, 'isHeadingSlugIndexed'>,
): boolean {
  const needsAnchor = Boolean(request.heading?.trim() || request.blockId?.trim())
  if (!needsAnchor) return true

  const anchor = resolveEditorAnchor(request, _activeMarkdown)
  if (!anchor) return false

  if (visual && anchor.kind === 'heading' && anchor.headingSlug) {
    return visual.isHeadingSlugIndexed(anchor.headingSlug)
  }

  return true
}

function schedulePoll(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Navigation Readiness Barrier: Only document identity + editor mounts + anchors are resolvable.
 * Do not compare markdown bytes/hashes/serialized full text.
 */
export async function waitUntilEditorNavigationReady(
  request: EditorNavigationReadyRequest,
  probe: EditorNavigationReadinessProbe,
  options?: { navigationGeneration?: number; timeoutMs?: number },
): Promise<EditorNavigationReadyResult> {
  const timeoutMs = options?.timeoutMs ?? 8000
  const generation = options?.navigationGeneration
  const deadline = performance.now() + timeoutMs
  const targetPath = request.absolutePath

  while (performance.now() < deadline) {
    if (generation != null && !isNavigationRevealCurrent(generation)) {
      return { ok: false, reason: 'navigation_superseded', cancelled: true }
    }

    if (!pathsEqual(probe.getActiveAbsolutePath(), targetPath)) {
      await schedulePoll()
      continue
    }

    const activeMarkdown = probe.getActiveMarkdown()
    const anchorMarkdown = request.markdown ?? activeMarkdown
    const paneMode = probe.getMainPaneMode()

    if (paneMode === 'visual') {
      const visual = probe.getVisualHydrationStatus(request.docKey)
      if (!visual.editorMounted || !visual.pmDocReady) {
        await schedulePoll()
        continue
      }
      if (!isEditorNavigationAnchorReady(request, anchorMarkdown, visual)) {
        await schedulePoll()
        continue
      }
      return { ok: true, markdown: activeMarkdown, mainPaneMode: 'visual' }
    }

    if (!probe.getSourceEditorMounted()) {
      await schedulePoll()
      continue
    }
    if (!isEditorNavigationAnchorReady(request, anchorMarkdown)) {
      await schedulePoll()
      continue
    }

    return { ok: true, markdown: activeMarkdown, mainPaneMode: 'source' }
  }

  if (generation != null && !isNavigationRevealCurrent(generation)) {
    return { ok: false, reason: 'navigation_superseded', cancelled: true }
  }

  return { ok: false, reason: 'navigation_ready_timeout' }
}
