import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import {
  SearchQuery as CodeMirrorSearchQuery,
  getSearchQuery as getCodeMirrorSearchQuery,
  findNext as findNextCodeMirrorSearch,
  searchPanelOpen as isCodeMirrorSearchPanelOpen,
  setSearchQuery as setCodeMirrorSearchQuery,
} from '@codemirror/search'
import type { EditorView } from '@codemirror/view'

import { findBestPlainTextSearchRange } from '../../editor/search/searchResultReveal'
import { pathsEqual } from '../../lib/workspacePathUtils'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'

export type GlobalSearchOpenOptions = {
  searchQuery?: string
  searchSnippetHtml?: string
}

export type GlobalSearchRevealControllerParams = {
  activePath: string
  mainPaneMode: 'visual' | 'source'
  activePathRef: RefObject<string>
  mainPaneModeRef: MutableRefObject<'visual' | 'source'>
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  editorViewRef: RefObject<EditorView | null>
  dispatchOpenDocumentInTab: (root: string, path: string, reason?: string) => Promise<void>
}

/** Global search open + post-navigation search reveal orchestration extracted from AppRoot. */
export function useGlobalSearchRevealController(params: GlobalSearchRevealControllerParams) {
  const {
    activePath,
    mainPaneMode,
    activePathRef,
    mainPaneModeRef,
    visualEditorRef,
    editorViewRef,
    dispatchOpenDocumentInTab,
  } = params

  const pendingGlobalSearchRevealRef = useRef<{ path: string; query: string; snippetHtml?: string } | null>(null)
  const transientSearchRevealTimerRef = useRef<number | null>(null)

  const revealSearchQueryInSourceEditor = useCallback((query: string, snippetHtml?: string) => {
    const trimmed = query.trim()
    const view = editorViewRef.current
    if (!view || !trimmed) return false
    const bestRange = findBestPlainTextSearchRange(view.state.doc.toString(), trimmed, snippetHtml)
    view.dispatch({
      effects: setCodeMirrorSearchQuery.of(
        new CodeMirrorSearchQuery({
          search: trimmed,
        }),
      ),
      selection: bestRange ? { anchor: bestRange.from, head: bestRange.to } : undefined,
      scrollIntoView: Boolean(bestRange),
    })
    if (!bestRange) {
      findNextCodeMirrorSearch(view)
    }
    view.focus()
    return true
  }, [editorViewRef])

  const clearTransientSearchRevealTimer = useCallback(() => {
    if (transientSearchRevealTimerRef.current != null) {
      window.clearTimeout(transientSearchRevealTimerRef.current)
      transientSearchRevealTimerRef.current = null
    }
  }, [])

  const scheduleTransientSearchRevealClear = useCallback(
    (path: string, query: string) => {
      clearTransientSearchRevealTimer()
      transientSearchRevealTimerRef.current = window.setTimeout(() => {
        transientSearchRevealTimerRef.current = null
        if (!pathsEqual(activePathRef.current, path)) return
        if (mainPaneModeRef.current === 'visual') {
          const handle = visualEditorRef.current
          if (!handle) return
          if (handle.getBoundDocumentKey() !== path) return
          if (handle.isSearchPanelOpen()) return
          handle.clearSearchHighlight()
          return
        }
        const view = editorViewRef.current
        if (!view) return
        if (isCodeMirrorSearchPanelOpen(view.state)) return
        const currentQuery = getCodeMirrorSearchQuery(view.state).search.trim()
        if (currentQuery !== query.trim()) return
        view.dispatch({
          effects: setCodeMirrorSearchQuery.of(
            new CodeMirrorSearchQuery({
              search: '',
            }),
          ),
        })
      }, 3500)
    },
    [activePathRef, clearTransientSearchRevealTimer, editorViewRef, mainPaneModeRef, visualEditorRef],
  )

  const openDocumentFromGlobalSearch = useCallback(
    async (root: string, path: string, options?: GlobalSearchOpenOptions) => {
      const trimmedQuery = options?.searchQuery?.trim() ?? ''
      pendingGlobalSearchRevealRef.current = trimmedQuery
        ? { path, query: trimmedQuery, snippetHtml: options?.searchSnippetHtml }
        : null
      await dispatchOpenDocumentInTab(root, path, 'global-search')
    },
    [dispatchOpenDocumentInTab],
  )

  useEffect(() => {
    const pending = pendingGlobalSearchRevealRef.current
    if (!pending || !activePath || pending.path !== activePath) return
    let cancelled = false
    const revealWhenReady = () => {
      if (cancelled) return
      if (mainPaneMode === 'visual') {
        const handle = visualEditorRef.current
        const boundDocumentKey = handle?.getBoundDocumentKey() ?? null
        if (handle?.getEditor() && boundDocumentKey === activePath) {
          const revealed = handle.revealSearchQuery(pending.query, pending.snippetHtml)
          if (revealed) {
            handle.focus()
            pendingGlobalSearchRevealRef.current = null
            scheduleTransientSearchRevealClear(activePath, pending.query)
            return
          }
        }
      } else {
        const revealed = revealSearchQueryInSourceEditor(pending.query, pending.snippetHtml)
        if (revealed) {
          pendingGlobalSearchRevealRef.current = null
          scheduleTransientSearchRevealClear(activePath, pending.query)
          return
        }
      }
      requestAnimationFrame(revealWhenReady)
    }
    revealWhenReady()
    return () => {
      cancelled = true
    }
  }, [
    activePath,
    mainPaneMode,
    revealSearchQueryInSourceEditor,
    scheduleTransientSearchRevealClear,
    visualEditorRef,
  ])

  useEffect(() => {
    if (!activePath) {
      clearTransientSearchRevealTimer()
      return
    }
    return () => {
      clearTransientSearchRevealTimer()
    }
  }, [activePath, clearTransientSearchRevealTimer])

  return {
    openDocumentFromGlobalSearch,
  }
}
