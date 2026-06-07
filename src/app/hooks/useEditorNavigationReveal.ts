import { useCallback, useMemo, type MutableRefObject, type RefObject } from 'react'

import { scrollCodeMirrorViewToLine } from '../../editor/caretAnchorScroll'
import { jumpCodeMirrorToOutlineHeading } from '../../editor/cmOutlineJump'
import { getSourceModeIdentity } from '../../editor/sourceModeIdentity'
import {
  resolveEditorAnchor,
  type EditorAnchorRevealRequest,
} from '../../editor/knowledgeOS/editorAnchorNavigation'
import {
  waitUntilEditorNavigationReady,
  type EditorNavigationReadinessProbe,
} from '../../editor/knowledgeOS/editorNavigationReadiness'
import { consumeLastNavigationSource, getNavigationSnapshot } from '../../editor/knowledgeOS'
import { pathsEqual } from '../../lib/workspacePathUtils'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import type { EditorView } from '@codemirror/view'

export type EditorNavigationRevealDeps = {
  mainPaneMode: 'visual' | 'source'
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  mainPaneModeRef: MutableRefObject<'visual' | 'source'>
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  editorViewRef: RefObject<EditorView | null>
}

export function useEditorNavigationReveal(deps: EditorNavigationRevealDeps) {
  const {
    mainPaneMode,
    activePathRef,
    contentRef,
    mainPaneModeRef,
    visualEditorRef,
    editorViewRef,
  } = deps

  const scrollPreviewToHeading = useCallback(
    (id: string) => {
      if (!id) return
      if (mainPaneMode === 'visual') {
        requestAnimationFrame(() => {
          visualEditorRef.current?.scrollToHeading(id)
        })
        return
      }
      const v = editorViewRef.current
      if (!v) return
      const path = activePathRef.current
      const sourceMd =
        (path && path !== 'scratch' ? getSourceModeIdentity(path) : undefined) ?? contentRef.current
      jumpCodeMirrorToOutlineHeading(v, id, sourceMd)
    },
    [activePathRef, contentRef, editorViewRef, mainPaneMode, visualEditorRef],
  )

  const editorNavigationReadinessProbe = useMemo<EditorNavigationReadinessProbe>(
    () => ({
      getActiveAbsolutePath: () => activePathRef.current,
      getActiveMarkdown: () => contentRef.current,
      getMainPaneMode: () => mainPaneModeRef.current,
      getVisualHydrationStatus: (documentKey) =>
        visualEditorRef.current?.getNavigationHydrationStatus(documentKey) ?? {
          editorMounted: false,
          pmDocReady: false,
          isHeadingSlugIndexed: () => false,
        },
      getSourceEditorMounted: () => editorViewRef.current != null,
    }),
    [activePathRef, contentRef, editorViewRef, mainPaneModeRef, visualEditorRef],
  )

  const resolveActiveMarkdown = useCallback(() => {
    if (mainPaneModeRef.current === 'source') {
      const view = editorViewRef.current
      if (view) return view.state.doc.toString()
    }
    if (mainPaneModeRef.current === 'visual') {
      const visual = visualEditorRef.current
      if (visual?.getMarkdown) return visual.getMarkdown()
    }
    return contentRef.current
  }, [contentRef, editorViewRef, mainPaneModeRef, visualEditorRef])

  const scrollSourceEditorToMarkdownLine = useCallback((line1Based: number) => {
    if (line1Based < 1) return
    const v = editorViewRef.current
    if (!v) return
    scrollCodeMirrorViewToLine(v, line1Based)
  }, [editorViewRef])

  const applyNavigationAnchorReveal = useCallback(
    async (
      request: EditorAnchorRevealRequest & { markdown: string },
      paneMode: 'visual' | 'source',
    ): Promise<boolean> => {
      const anchor = resolveEditorAnchor(
        { docKey: request.docKey, heading: request.heading, blockId: request.blockId },
        request.markdown,
      )

      if (import.meta.env.DEV) {
        console.debug('[BacklinkAnchor]', {
          heading: request.heading,
          blockId: request.blockId,
          resolvedRange: anchor,
          source: request.source,
          paneMode,
        })
      }

      if (!anchor) {
        if (paneMode === 'visual') {
          const handled = await visualEditorRef.current?.revealNavigationAnchor({ line: 1 })
          return Boolean(handled)
        }
        scrollSourceEditorToMarkdownLine(1)
        return true
      }

      if (paneMode === 'visual') {
        const handled = await visualEditorRef.current?.revealNavigationAnchor({
          headingSlug: anchor.headingSlug,
          blockId: anchor.blockId,
          line: anchor.line,
        })
        return Boolean(handled)
      }
      scrollSourceEditorToMarkdownLine(anchor.line)
      return true
    },
    [scrollSourceEditorToMarkdownLine, visualEditorRef],
  )

  const revealNavigationAnchor = useCallback(
    async (
      request: EditorAnchorRevealRequest,
      options?: { navigationGeneration?: number },
    ) => {
      if (pathsEqual(request.absolutePath, activePathRef.current)) {
        const optimisticMarkdown = resolveActiveMarkdown()
        const handled = await applyNavigationAnchorReveal(
          { ...request, markdown: optimisticMarkdown },
          mainPaneModeRef.current,
        )
        if (handled) return
      }
      const ready = await waitUntilEditorNavigationReady(
        request,
        editorNavigationReadinessProbe,
        { navigationGeneration: options?.navigationGeneration, timeoutMs: 600 },
      )
      if (ready.ok === false) {
        if (import.meta.env.DEV && !ready.cancelled) {
          console.warn('[NavigationReveal] barrier failed', ready.reason, request.absolutePath)
        }
        if (ready.cancelled) return
        if (!pathsEqual(activePathRef.current, request.absolutePath)) return
        const markdown = pathsEqual(request.absolutePath, activePathRef.current)
          ? resolveActiveMarkdown()
          : (request.markdown ?? resolveActiveMarkdown())
        const paneMode = mainPaneModeRef.current
        await applyNavigationAnchorReveal({ ...request, markdown }, paneMode)
        return
      }
      await applyNavigationAnchorReveal({ ...request, markdown: ready.markdown }, ready.mainPaneMode)
    },
    [
      activePathRef,
      applyNavigationAnchorReveal,
      editorNavigationReadinessProbe,
      mainPaneModeRef,
      resolveActiveMarkdown,
    ],
  )

  const revealNavigationAnchorAfterOpen = useCallback(
    async (
      absolutePath: string,
      markdownOverride: string | undefined,
      navigationGeneration: number,
    ) => {
      const nav = getNavigationSnapshot().current
      const snapshotMatches = Boolean(nav && pathsEqual(nav.absolutePath, absolutePath))

      if (!nav) {
        return
      }

      if (!snapshotMatches && import.meta.env.DEV) {
        console.warn('[NavigationReveal] snapshot path differs from opened tab', {
          openedPath: absolutePath,
          navPath: nav.absolutePath,
          docKey: nav.docKey,
        })
      }

      const hasAnchor = Boolean(nav.heading?.trim() || nav.blockId?.trim())
      if (!hasAnchor) return

      const source = consumeLastNavigationSource() ?? 'wiki'
      const markdown = pathsEqual(activePathRef.current, absolutePath)
        ? resolveActiveMarkdown()
        : (markdownOverride ?? contentRef.current)
      await revealNavigationAnchor(
        {
          docKey: nav.docKey,
          absolutePath,
          heading: nav.heading,
          blockId: nav.blockId,
          source,
          markdown,
        },
        { navigationGeneration },
      )
    },
    [activePathRef, contentRef, revealNavigationAnchor, resolveActiveMarkdown],
  )

  return {
    scrollPreviewToHeading,
    revealNavigationAnchor,
    revealNavigationAnchorAfterOpen,
  }
}
