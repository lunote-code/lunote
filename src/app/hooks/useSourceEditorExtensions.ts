import { useCallback, useEffect, useMemo, useSyncExternalStore, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  lineNumbers,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { canonicalMarkdownOutline } from '../../markdown/canonicalMarkdownOutline'
import { cmNavigationJumpFlashExt } from '../../editor/cmNavigationJumpFlash'
import {
  cmEphemeralEnterCommit,
  cmManifestKeymap,
  reconfigureCmManifestKeymap,
} from '../../editor/cmManifestBridge'
import { createShowLineBreaksCompartmentExtension } from '../../editor/cmShowLineBreaks'
import { createCmWebviewPasteExtension } from '../../editor/cmWebviewPasteBridge'
import { createCmWikiLinkSuggestExtension } from '../../editor/cmWikiLinkSuggest'
import {
  createWikiLinkClickExtension,
  type WikiLinkEditorHandlers,
} from '../../editor/knowledgeOS/ui/cmWikiLinkExtension'
import type { WikiLinkTarget } from '../../editor/knowledgeRuntime/types'
import { getAppSettingsSnapshot, subscribeAppSettings } from '../../settings/appSettingsStore'
import {
  comfortableEditorTheme,
  createWriterBaseExtensions,
  markdownUxKeymap,
} from '../codemirror/sourceEditorExtensions'
import { useI18n } from '../../i18n'

export type SourceEditorExtensionsDeps = {
  isLargeDoc: boolean
  sidebarListMode: 'files' | 'outline'
  setSidebarListMode: Dispatch<SetStateAction<'files' | 'outline'>>
  outlineSpyCtxRef: MutableRefObject<{ sidebarListMode: 'files' | 'outline' }>
  setActiveOutlineIdRef: MutableRefObject<(id: string) => void>
  setActiveOutlineId: Dispatch<SetStateAction<string>>
  wikiHandlersRef: MutableRefObject<WikiLinkEditorHandlers | null>
  wikiTargetResolverRef: MutableRefObject<((pos: number) => WikiLinkTarget | null) | null>
  pasteImageHandlerRef: MutableRefObject<(file: File, mimeHint: string) => Promise<string | null>>
  editorViewRef: RefObject<EditorView | null>
}

export function useSourceEditorExtensions(deps: SourceEditorExtensionsDeps) {
  const {
    isLargeDoc,
    sidebarListMode,
    setSidebarListMode,
    outlineSpyCtxRef,
    setActiveOutlineIdRef,
    setActiveOutlineId,
    wikiHandlersRef,
    wikiTargetResolverRef,
    pasteImageHandlerRef,
    editorViewRef,
  } = deps

  const { t, effectiveLocale } = useI18n()

  useEffect(() => {
    outlineSpyCtxRef.current = { sidebarListMode }
  }, [outlineSpyCtxRef, sidebarListMode])

  const editorOutlineScrollViewportExt = useMemo(
    () =>
      ViewPlugin.fromClass(
        class {
          private view: EditorView
          private scrollRaf: number | null = null
          constructor(view: EditorView) {
            this.view = view
            this.onScroll = this.onScroll.bind(this)
            view.scrollDOM.addEventListener('scroll', this.onScroll, { passive: true })
            queueMicrotask(() => this.onScroll())
          }

          destroy() {
            this.view.scrollDOM.removeEventListener('scroll', this.onScroll)
            if (this.scrollRaf != null) cancelAnimationFrame(this.scrollRaf)
          }

          update(u: ViewUpdate) {
            if (u.docChanged || u.viewportChanged || u.selectionSet) this.onScroll()
          }

          onScroll() {
            if (this.scrollRaf != null) return
            this.scrollRaf = requestAnimationFrame(() => {
              this.scrollRaf = null
              const ctx = outlineSpyCtxRef.current
              if (ctx.sidebarListMode !== 'outline') return
              const view = this.view
              const rect = view.scrollDOM.getBoundingClientRect()
              const y = rect.top + 72
              const x = rect.left + Math.min(120, Math.max(32, rect.width * 0.1))
              const pos = view.posAtCoords({ x, y })
              if (pos == null) return
              const id = canonicalMarkdownOutline.activeHeadingIdBeforeOffset(view.state.doc.toString(), pos)
              setActiveOutlineIdRef.current(id)
            })
          }
        },
      ),
    [outlineSpyCtxRef, setActiveOutlineIdRef],
  )

  const editorOutlineActiveExt = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        const ctx = outlineSpyCtxRef.current
        if (ctx.sidebarListMode !== 'outline') return
        if (!update.selectionSet && !update.docChanged) return
        const id = canonicalMarkdownOutline.activeHeadingIdBeforeOffset(
          update.state.doc.toString(),
          update.state.selection.main.head,
        )
        setActiveOutlineId((prev) => (prev === id ? prev : id))
      }),
    [outlineSpyCtxRef, setActiveOutlineId],
  )

  const toggleSidebarListOutline = useCallback(() => {
    setSidebarListMode((v) => (v === 'files' ? 'outline' : 'files'))
  }, [setSidebarListMode])

  const wikiLinkCmExt = useMemo(
    () => createWikiLinkClickExtension(wikiHandlersRef, wikiTargetResolverRef),
    [wikiHandlersRef, wikiTargetResolverRef],
  )

  const cmWikiLinkSuggestExt = useMemo(() => createCmWikiLinkSuggestExtension(), [])

  const cmWebviewPasteExt = useMemo(
    () => createCmWebviewPasteExtension((file, mime) => pasteImageHandlerRef.current(file, mime)),
    [pasteImageHandlerRef],
  )

  const shortcutBindRevision = useSyncExternalStore(
    subscribeAppSettings,
    () => JSON.stringify(getAppSettingsSnapshot().shortcutOverrides ?? {}),
    () => '{}',
  )

  const editorExtensions = useMemo(() => {
    const exts: Extension[] = [...createWriterBaseExtensions(t), drawSelection(), highlightActiveLine()]
    if (!isLargeDoc) {
      exts.push(markdown({ codeLanguages: languages }), lineNumbers())
    }
    exts.push(
      cmManifestKeymap,
      cmEphemeralEnterCommit,
      markdownUxKeymap,
      createShowLineBreaksCompartmentExtension(),
      EditorView.lineWrapping,
      comfortableEditorTheme,
      cmNavigationJumpFlashExt,
      wikiLinkCmExt,
      cmWebviewPasteExt,
      cmWikiLinkSuggestExt,
    )
    if (!isLargeDoc) {
      exts.push(editorOutlineScrollViewportExt, editorOutlineActiveExt)
    }
    return exts
  }, [
    effectiveLocale,
    t,
    isLargeDoc,
    editorOutlineScrollViewportExt,
    editorOutlineActiveExt,
    wikiLinkCmExt,
    cmWebviewPasteExt,
    cmWikiLinkSuggestExt,
  ])

  useEffect(() => {
    const view = editorViewRef.current
    if (view) reconfigureCmManifestKeymap(view)
  }, [editorViewRef, shortcutBindRevision])

  return { editorExtensions, toggleSidebarListOutline }
}
