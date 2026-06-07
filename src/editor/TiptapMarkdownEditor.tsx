import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { type Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { runAfterReactCommitWhen } from './reactCommitScheduler'
import { applyPlainTextInsertion } from './inputLayer/inputLayerPaste'
import {
  shouldShowCodeChromeForBlockType,
} from './blockEditingPolicy'
import {
  commitActiveMarkdownSourceReveal,
  getActiveMarkdownSourceReveal,
  startMarkdownBlockSourceReveal,
} from './lunaMarkdownSourceReveal'
import { deriveHierarchicalSelectionFromPm } from './modeSwitchHierarchical'
import { recordModeSwitchGoodAnchor } from './modeSwitchLastGoodAnchor'
import { focusTiptapProseMirrorSurface } from './tiptapEditorFocus'
import {
  freezeModeSwitchSnapshot,
} from './modeSwitchSnapshot'
import { debugModeSwitch, describeScrollMetrics, describeSelectionInText, summarizeSnapshot } from './modeSwitchDebug'
import {
  assertNoPartialModeSwitchMutation,
  isModeSwitchFreezeError,
  reportModeSwitchFreezeFailure,
} from './modeSwitchFreezeFailure'
import { installModeSwitchRegressionGateDevtools } from './modeSwitchRegressionHarness'
import {
  activeHeadingSlugBeforePos,
  findHeadingPositionInDoc,
  parseHeadingsFromPmDoc,
  type PmTocHeading,
} from './pmHeadingNav'
import { createLunaMarkdownEditorExtensions } from './lunaMarkdownEditorExtensions'
import {
  buildWikiLinkInsertText,
  isWikiSuggestItemSelectable,
} from './lunaWikiLinkSuggest'
import { emitLunaSurface } from './lunaEditorSurfaceState'
import { isModifierHintMacLike, isOpenableExternalHref } from './openExternalLink'
import { resolveMarkdownMediaSrc, buildMediaSourceResolveOptions } from '../export/mediaSources'
import {
  makeModeBridgeId,
} from './viewportModeAnchor'
import { VIEWPORT_DOCUMENT_NODE_ID, viewportAnchorEngine } from './viewportAnchorEngine'
import { allocModeSwitchCaptureFrameId } from './modeSwitchFrameTransaction'
import {
  bridgeCaptureEditorSelection,
  bridgeRememberCurrentSelection,
} from './editorMutationBridge'
import { type EditorOpenReason as EditorOpenReasonType } from './editorOpenReason'
import { useI18n } from '../i18n'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import type { WikiLinkTarget } from './knowledgeRuntime/types'
import { MermaidSourceSessionProvider } from './mermaid/MermaidSourceSession'
import { ensurePmInputUnlockedOnBoot } from './mermaid/mermaidSourceInputFocus'
import { flushMermaidSourceForDocumentSwitch, flushMermaidSourceForSerialize } from './mermaid/mermaidSourceBridge'
import { installMermaidClipboardCapture } from './mermaid/mermaidSourceClipboard'
import type { AssetMeta } from '../assets/workspaceAssetStore'
import {
  isLunaAssetHref,
} from '../assets/markdownLinkTransformer'
import { applySlashFileLinkCommand } from '../assets/lunaAssetInsert'
import { EditorSearchOverlay } from './search/editorSearchOverlay'
import {
  clearTiptapSearch,
  getTiptapSearchSnapshot,
  moveTiptapSearch,
  replaceAllTiptapMatches,
  replaceCurrentTiptapMatch,
  replaceNextTiptapMatch,
  setTiptapSearchQuery,
} from './search/editorSearchBindings'
import { EditorLocalSearchExtension } from './search/editorSearchRuntime'
import {
  firstExecutableSlashRowIndex,
  SLASH_FILE_LINK_ID,
  slashMenuFrameEquals,
  shouldProbeSlashMenu,
  type SlashCommandItem,
  type SlashMenuState,
  type WikiLinkMenuState,
} from './tiptapSlashMenuModel'
import { SlashCommandMenu, WikiLinkSuggestMenu } from './tiptapEditorMenus'
import { createTiptapEditorHandleCore } from './tiptapEditorHandleCore'
import {
  createTiptapEditorHandleActions,
  createTiptapEditorHandleNavigation,
} from './tiptapEditorHandleRuntime'
import { createTiptapEditorCaptureHandle } from './tiptapEditorCaptureHandle'
import { getLunaManifestCommandExecutor } from './lunaEphemeralFormatting'
import {
  runEphemeralEditorCommand,
  runTiptapCommand,
  selectedText,
} from './tiptapEditorCommandRuntime'
import type { VisualOpFailureReason } from './visualOpFailure'
import {
  centerRevealElementInContainer,
  findBlockRevealElement,
  findHeadingRevealElement,
  findLineRevealElement,
  highlightRevealElement,
  logRevealAnchorTrace,
} from './editorNavigationReveal'
import {
  createTiptapEditorMarkdownSyncRuntime,
  normalizeSerializedMarkdownForSource,
} from './tiptapEditorMarkdownSync'
import { createTiptapEditorInteractionProps } from './tiptapEditorInteractionProps'
import { createTiptapEditorLifecycleHandlers } from './tiptapEditorLifecycle'
import { syncTiptapEditorFromProps } from './tiptapEditorPropSync'
import {
  buildTiptapSlashMenuState,
  buildTiptapWikiLinkMenuState,
  createTiptapSlashCommands,
} from './tiptapEditorSlashRuntime'
import {
  closeActiveMermaidSource,
  hasActiveMermaidSource,
  openMermaidSourceForTarget,
  resolveActiveBlockSelectionTarget,
} from './tiptapEditorSourceIslandRuntime'
import {
  scheduleVisualBlockGapTrace,
  scheduleVisualTailTrace,
} from './tiptapEditorTraceRuntime'
import {
  applyVisualTabViewportRestore,
  resolveVisualTabRestore,
  revealScrollContainer,
} from './visualModeViewportRestore'
import { resetTransactionLog } from '../menu/commandTransaction'
import { flushVmTiptapRecorderBatch } from '../vm/vmTiptapRecorder'
import { VM_SKIP_RECORD_META } from '../vm/vmStepLog'
import type {
  AtomicVisualDocumentEnter,
  TiptapMarkdownEditorHandle,
} from './tiptapEditorTypes'

export type {
  AtomicVisualDocumentEnter,
  CaptureVisualToSourceResult,
  PendingMarkdownSyncResult,
  TiptapEditorCommand,
  TiptapMarkdownEditorHandle,
} from './tiptapEditorTypes'

const TI_FOCUS_NO_SCROLL = { scrollIntoView: false as const }

function toPendingMarkdownSyncError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error)
  return new Error(`Visual editor markdown serialization failed: ${detail}`)
}

type Props = {
  markdown: string
  documentKey: string
  activePath: string
  rootDir: string
  sidebarListMode: 'files' | 'outline'
  onMarkdownChange: (markdown: string) => void
  onActiveHeadingChange: (id: string) => void
  /** Fired on every PM selection change (toolbar text-color gating, etc.). */
  onSelectionActivity?: () => void
  onStatus: (message: string, tone?: import('../app/hooks/useAppStatus').AppStatusTone) => void
  onPasteImage: (file: File, mimeHint: string) => Promise<string | null>
  onAssetFilesDrop?: (files: File[]) => Promise<void>
  onPickLunaAsset?: () => Promise<AssetMeta | null>
  onLunaAssetLinkClick?: (href: string, event: MouseEvent) => void
  getLunaAssetTooltip?: (href: string) => string | null
  /** Title tree synchronized in real time from PM document (consistent with the main text, does not rely on anti-shake Markdown text)*/
  onOutlineHeadingsChange?: (headings: PmTocHeading[]) => void
  /** When non-null: use a single `tr` in `onCreate` to write the text + PM selection (mutually exclusive with `setContent` + post selection)*/
  atomicVisualDocumentEnter?: AtomicVisualDocumentEnter | null
  onAtomicVisualDocumentEnterConsumed?: () => void
  /** Cold open vs ⌘/ recovery: prohibit using atomic Is there any implicit inference?*/
  openReason: EditorOpenReasonType
  /** [[wiki]] Click → Knowledge OS Navigation*/
  onWikiLinkNavigate?: (target: WikiLinkTarget) => void
  onWikiLinkHover?: (target: WikiLinkTarget | null, client: { x: number; y: number }) => void
  /**⌘/ Disable PM→MD writeback during switching (to avoid \\ escaping from contaminating the true value of the source code)*/
  suppressMarkdownSyncRef?: React.MutableRefObject<boolean>
}

function headingIdBeforeSelection(editor: Editor): string {
  return activeHeadingSlugBeforePos(editor.state.doc, editor.state.selection.from)
}

function waitAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** Get the still mounted PM instance before the slash/menu command (avoid ref pointing to the destroyed editor)*/
function resolveLiveTiptapEditor(
  prefer: Editor | null | undefined,
  instanceRef: { current: Editor | null },
): Editor | null {
  for (const candidate of [prefer, instanceRef.current]) {
    if (candidate && !candidate.isDestroyed) {
      instanceRef.current = candidate
      return candidate
    }
  }
  return null
}

export const TiptapMarkdownEditor = forwardRef<TiptapMarkdownEditorHandle, Props>(
  (
    {
      markdown,
      documentKey,
      activePath,
      rootDir,
      sidebarListMode,
      onMarkdownChange,
      onActiveHeadingChange,
      onSelectionActivity,
      onStatus,
      onPasteImage,
      onAssetFilesDrop,
      onPickLunaAsset,
      onLunaAssetLinkClick,
      getLunaAssetTooltip,
      onOutlineHeadingsChange,
      atomicVisualDocumentEnter = null,
      onAtomicVisualDocumentEnterConsumed,
      openReason,
      onWikiLinkNavigate,
      onWikiLinkHover,
      suppressMarkdownSyncRef,
    },
    ref,
  ) => {
    const { t } = useI18n()
    const tRef = useRef(t)
    tRef.current = t
    const atomicVisualDocumentEnterRef = useRef(atomicVisualDocumentEnter)
    atomicVisualDocumentEnterRef.current = atomicVisualDocumentEnter
    const onAtomicVisualDocumentEnterConsumedRef = useRef(onAtomicVisualDocumentEnterConsumed)
    onAtomicVisualDocumentEnterConsumedRef.current = onAtomicVisualDocumentEnterConsumed
    const composingRef = useRef(false)
    const headingParseTimerRef = useRef<number | null>(null)
    const HEADING_PARSE_THROTTLE_MS = 300
    const MARKDOWN_SYNC_DEBOUNCE_MS = 300
    const lastExternalMarkdownRef = useRef(markdown)
    const lastNormalizedExternalMarkdownRef = useRef(markdown)
    const lastDocumentKeyRef = useRef(documentKey)
    const hasUserEditedSinceDocumentLoadRef = useRef(false)
    const markdownRef = useRef(markdown)
    const documentKeyRef = useRef(documentKey)
    const sidebarListModeRef = useRef(sidebarListMode)
    const serializeTimerRef = useRef<number | null>(null)
    const serializeIdleCallbackRef = useRef<number | null>(null)
    const editorInstanceRef = useRef<Editor | null>(null)
    const editorHookRef = useRef<Editor | null>(null)
    const shellRef = useRef<HTMLDivElement | null>(null)
    /** Inline link under the current pointer (used to display the tooltip immediately when the modifier key is pressed)*/
    const pointerLinkRef = useRef<HTMLAnchorElement | null>(null)
    const linkModifierHintRef = useRef<{ el: HTMLAnchorElement; savedTitle: string | undefined } | null>(null)

    const clearLinkModifierHint = useCallback(() => {
      const h = linkModifierHintRef.current
      if (!h) return
      h.el.classList.remove('pm-link-modifier-hint')
      if (h.savedTitle !== undefined && h.savedTitle !== '') h.el.title = h.savedTitle
      else h.el.removeAttribute('title')
      linkModifierHintRef.current = null
    }, [])

    const updateLinkModifierHint = useCallback((anchor: HTMLAnchorElement | null, mod: boolean) => {
      const shell = shellRef.current
      const href = anchor?.getAttribute('href') || ''
      const ok =
        !!(mod && anchor && shell?.contains(anchor) && (isOpenableExternalHref(href) || isLunaAssetHref(href)))
      if (!ok) {
        clearLinkModifierHint()
        return
      }
      const cur = linkModifierHintRef.current
      if (cur?.el === anchor) return
      clearLinkModifierHint()
      const savedTitle = anchor.getAttribute('title') ?? ''
      const openHint = isModifierHintMacLike()
        ? tRef.current('editor.linkOpenCmdClick')
        : tRef.current('editor.linkOpenCtrlClick')
      anchor.classList.add('pm-link-modifier-hint')
      if (isLunaAssetHref(href)) {
        const assetTip = getLunaAssetTooltipRef.current?.(href) ?? savedTitle
        anchor.title = savedTitle
          ? `${assetTip}\n${isModifierHintMacLike() ? 'Cmd + Click to reveal in folder' : 'Ctrl + Click to reveal in folder'}`
          : isModifierHintMacLike()
            ? 'Cmd + Click to reveal in folder'
            : 'Ctrl + Click to reveal in folder'
      } else {
        anchor.title = savedTitle ? `${savedTitle}\n${openHint}` : openHint
      }
      linkModifierHintRef.current = { el: anchor, savedTitle: savedTitle || undefined }
    }, [clearLinkModifierHint])
    const activePathRef = useRef(activePath)
    const rootDirRef = useRef(rootDir)
    const onMarkdownChangeRef = useRef(onMarkdownChange)
    const onActiveHeadingChangeRef = useRef(onActiveHeadingChange)
    const onSelectionActivityRef = useRef(onSelectionActivity)
    const onStatusRef = useRef(onStatus)
    const onPasteImageRef = useRef(onPasteImage)
    const onAssetFilesDropRef = useRef(onAssetFilesDrop)
    const onPickLunaAssetRef = useRef(onPickLunaAsset)
    const onLunaAssetLinkClickRef = useRef(onLunaAssetLinkClick)
    const getLunaAssetTooltipRef = useRef(getLunaAssetTooltip)
    const onOutlineHeadingsChangeRef = useRef(onOutlineHeadingsChange)
    const onWikiLinkNavigateRef = useRef(onWikiLinkNavigate)
    const onWikiLinkHoverRef = useRef(onWikiLinkHover)
    const openReasonRef = useRef(openReason)
    openReasonRef.current = openReason
    /** After `onCreate` completes atomic replace, skip `setContent` synchronized with props once*/
    const didAtomicVisualBootstrapRef = useRef(false)
    /**
     * Single authoritative hydration rule:
     * `onCreate` owns the first PM write for a given editor mount. The props-sync effect
     * must not replay the exact same `documentKey + markdown`, otherwise React NodeViews
     * (mermaid / toc / callout) can mount twice during one mode switch and freeze the UI.
     */
    const pendingInitialHydrationRef = useRef<{ documentKey: string; markdown: string } | null>(null)
    const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
    const [slashHoverIndex, setSlashHoverIndex] = useState(-1)
    const slashHoverIndexRef = useRef(-1)
    slashHoverIndexRef.current = slashHoverIndex
    const slashMenuRef = useRef<SlashMenuState | null>(null)
    slashMenuRef.current = slashMenu
    const slashCommandsRef = useRef<readonly SlashCommandItem[]>([])
    const slashMenuRefreshRafRef = useRef(0)
    const slashMenuRefreshEditorRef = useRef<Editor | null>(null)
    const [wikiLinkMenu, setWikiLinkMenu] = useState<WikiLinkMenuState | null>(null)
    const wikiLinkMenuRef = useRef<WikiLinkMenuState | null>(null)
    wikiLinkMenuRef.current = wikiLinkMenu
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchMode, setSearchMode] = useState<'find' | 'replace'>('find')
    const [searchReplaceText, setSearchReplaceText] = useState('')
    const [searchVersion, bumpSearchVersion] = useReducer((version: number) => version + 1, 0)
    const searchOpenRef = useRef(false)
    searchOpenRef.current = searchOpen
    const searchReplaceTextRef = useRef('')
    searchReplaceTextRef.current = searchReplaceText
    const slashCommands = useMemo(
      () =>
        createTiptapSlashCommands({
          t: (key) => tRef.current(key),
          focusNoScroll: TI_FOCUS_NO_SCROLL,
          runTiptapCommand,
          runEphemeralCommand: runEphemeralEditorCommand,
        }),
      [],
    )
    slashCommandsRef.current = slashCommands

    useEffect(() => {
      onMarkdownChangeRef.current = onMarkdownChange
      onActiveHeadingChangeRef.current = onActiveHeadingChange
      onSelectionActivityRef.current = onSelectionActivity
      onStatusRef.current = onStatus
      onPasteImageRef.current = onPasteImage
      onAssetFilesDropRef.current = onAssetFilesDrop
      onPickLunaAssetRef.current = onPickLunaAsset
      onLunaAssetLinkClickRef.current = onLunaAssetLinkClick
      getLunaAssetTooltipRef.current = getLunaAssetTooltip
      onOutlineHeadingsChangeRef.current = onOutlineHeadingsChange
      onWikiLinkNavigateRef.current = onWikiLinkNavigate
      onWikiLinkHoverRef.current = onWikiLinkHover
      activePathRef.current = activePath
      rootDirRef.current = rootDir
      markdownRef.current = markdown
      documentKeyRef.current = documentKey
      sidebarListModeRef.current = sidebarListMode
    }, [
      onMarkdownChange,
      onActiveHeadingChange,
      onSelectionActivity,
      onStatus,
      onPasteImage,
      onAssetFilesDrop,
      onPickLunaAsset,
      onLunaAssetLinkClick,
      getLunaAssetTooltip,
      onOutlineHeadingsChange,
      onWikiLinkNavigate,
      onWikiLinkHover,
      activePath,
      rootDir,
      markdown,
      documentKey,
      sidebarListMode,
    ])

    const getNoteAssetContext = useCallback(() => {
      const notePath = activePathRef.current
      const root = rootDirRef.current
      if (!root || !notePath || notePath.startsWith('luna:buf:')) return null
      return { root, notePath }
    }, [])

    const reportMarkdownSerializeError = useCallback((error: unknown) => {
      onStatusRef.current?.(
        tRef.current('editor.status.serializeError', {
          detail: error instanceof Error ? error.message : String(error),
        }),
        'error',
      )
    }, [])

    const reportLinkOpenFailed = useCallback((error: unknown) => {
      onStatusRef.current?.(
        tRef.current('editor.status.linkOpenFailed', {
          message: error instanceof Error ? error.message : String(error),
        }),
        'error',
      )
    }, [])

    const markUserEditIntent = useCallback(() => {
      hasUserEditedSinceDocumentLoadRef.current = true
    }, [])

    const {
      normalizeMarkdown,
      syncExternalMarkdownRefs,
      compileEditorMarkdownForSync,
      runMarkdownSerialize,
      scheduleMarkdownSync,
    } = useMemo(
      () =>
        createTiptapEditorMarkdownSyncRuntime({
          documentKeyRef,
          suppressMarkdownSyncRef,
          composingRef,
          serializeTimerRef,
          serializeIdleCallbackRef,
          editorInstanceRef,
          lastExternalMarkdownRef,
          lastNormalizedExternalMarkdownRef,
          onMarkdownChangeRef,
          reportSerializeError: reportMarkdownSerializeError,
          debounceMs: MARKDOWN_SYNC_DEBOUNCE_MS,
        }),
      [reportMarkdownSerializeError, suppressMarkdownSyncRef],
    )

    const scheduleOutlineHeadingsSync = useCallback((editor: Editor) => {
      if (headingParseTimerRef.current != null) {
        window.clearTimeout(headingParseTimerRef.current)
      }
      headingParseTimerRef.current = window.setTimeout(() => {
        headingParseTimerRef.current = null
        onOutlineHeadingsChangeRef.current?.(parseHeadingsFromPmDoc(editor.state.doc))
      }, HEADING_PARSE_THROTTLE_MS)
    }, [])

    const refreshSlashMenu = useCallback((editor: Editor) => {
      const shell = shellRef.current
      if (!shell) {
        setSlashMenu(null)
        return
      }
      const next = buildTiptapSlashMenuState(editor, shell, slashCommandsRef.current)
      setSlashMenu((prev) => {
        if (!next) return null
        const keepIndex =
          prev &&
          prev.from === next.from &&
          prev.to === next.to &&
          prev.query === next.query
            ? Math.min(prev.activeIndex, next.rows.length - 1)
            : firstExecutableSlashRowIndex(next.rows)
        const activeRow = next.rows[keepIndex]
        const activeIndex = activeRow?.executable ? keepIndex : firstExecutableSlashRowIndex(next.rows)
        const candidate: SlashMenuState = { ...next, activeIndex }
        if (prev && slashMenuFrameEquals(prev, candidate)) {
          return prev.activeIndex === candidate.activeIndex ? prev : candidate
        }
        return candidate
      })
    }, [])

    const scheduleRefreshSlashMenu = useCallback(
      (editor: Editor) => {
        if (!shouldProbeSlashMenu(editor, slashMenuRef.current != null)) {
          if (slashMenuRef.current) setSlashMenu(null)
          return
        }
        slashMenuRefreshEditorRef.current = editor
        if (slashMenuRefreshRafRef.current) return
        slashMenuRefreshRafRef.current = requestAnimationFrame(() => {
          slashMenuRefreshRafRef.current = 0
          const ed = slashMenuRefreshEditorRef.current
          if (!ed || ed.isDestroyed) return
          refreshSlashMenu(ed)
        })
      },
      [refreshSlashMenu],
    )

    const refreshWikiLinkMenu = useCallback((editor: Editor) => {
      const shell = shellRef.current
      if (!shell) {
        setWikiLinkMenu(null)
        return
      }
      const next = buildTiptapWikiLinkMenuState(editor, shell)
      setWikiLinkMenu((prev) => {
        if (!next) return null
        const keepIndex =
          prev &&
          prev.replaceFrom === next.replaceFrom &&
          prev.replaceTo === next.replaceTo &&
          prev.query === next.query
            ? Math.min(prev.activeIndex, next.items.length - 1)
            : 0
        return { ...next, activeIndex: keepIndex }
      })
    }, [])

    const applySlashCommandAt = useCallback(
      async (index: number): Promise<boolean> => {
        const session = slashMenuRef.current
        if (!session) return false
        let liveEditor = resolveLiveTiptapEditor(editorHookRef.current, editorInstanceRef)
        if (!liveEditor) return false
        const row = session.rows[index]
        if (!row?.executable) return false
        markUserEditIntent()

        const prevSuppress = suppressMarkdownSyncRef?.current ?? false
        if (suppressMarkdownSyncRef) suppressMarkdownSyncRef.current = true

        try {
          focusTiptapProseMirrorSurface(liveEditor)
          const isFileLink =
            row.id === SLASH_FILE_LINK_ID || row.id.endsWith(`/${SLASH_FILE_LINK_ID}`)

          if (isFileLink) {
            setSlashMenu(null)
            const range = { from: session.from, to: session.to }
            return await applySlashFileLinkCommand(
              () => resolveLiveTiptapEditor(editorHookRef.current, editorInstanceRef),
              range,
              () => onPickLunaAssetRef.current?.() ?? Promise.resolve(null),
            )
          }

          const deleted = liveEditor
            .chain()
            .focus(null, TI_FOCUS_NO_SCROLL)
            .deleteRange({ from: session.from, to: session.to })
            .run()
          if (!deleted) {
            if (import.meta.env.DEV) {
              console.warn('[slash-menu] deleteRange failed', {
                from: session.from,
                to: session.to,
                docSize: liveEditor.state.doc.content.size,
              })
            }
            return false
          }

          liveEditor = resolveLiveTiptapEditor(liveEditor, editorInstanceRef)
          if (!liveEditor) return false

          if (row.run) {
            return row.run(liveEditor)
          }

          if (row.manifestCommandId) {
            const executor = getLunaManifestCommandExecutor()
            if (!executor) return false
            await executor(row.manifestCommandId)
            return true
          }

          return false
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('[slash-menu] apply failed', err)
          }
          return false
        } finally {
          setSlashMenu(null)
          const serializeTarget = resolveLiveTiptapEditor(editorHookRef.current, editorInstanceRef)
          if (serializeTarget) {
            //First write the PM true value back to the kernel to avoid the markdown prop synchronization effect below from overwriting this slash command with the old content.
            if (suppressMarkdownSyncRef) suppressMarkdownSyncRef.current = false
            runMarkdownSerialize(serializeTarget)
            scheduleMarkdownSync(serializeTarget, 0)
          }
          if (suppressMarkdownSyncRef) suppressMarkdownSyncRef.current = prevSuppress
        }
      },
      [markUserEditIntent, runMarkdownSerialize, scheduleMarkdownSync, suppressMarkdownSyncRef],
    )

    const applyWikiLinkSuggestAt = useCallback((index: number): boolean => {
      const session = wikiLinkMenuRef.current
      const editor = resolveLiveTiptapEditor(editorHookRef.current, editorInstanceRef)
      if (!session || !editor) return false
      const item = session.items[index]
      if (!item || !isWikiSuggestItemSelectable(item)) return false
      markUserEditIntent()
      const insert = buildWikiLinkInsertText(session.embed, item.insertTarget)
      editor
        .chain()
        .focus(null, TI_FOCUS_NO_SCROLL)
        .deleteRange({ from: session.replaceFrom, to: session.replaceTo })
        .insertContent(insert)
        .run()
      setWikiLinkMenu(null)
      runMarkdownSerialize(editor)
      scheduleMarkdownSync(editor, 0)
      return true
    }, [markUserEditIntent, runMarkdownSerialize, scheduleMarkdownSync])

    const pasteImageForExtensions = useCallback(
      (file: File, mimeHint: string) => onPasteImageRef.current(file, mimeHint),
      [],
    )

    const visualEditorExtensions = useMemo(
      () =>
        createLunaMarkdownEditorExtensions({
          resolveMediaSrc: (src) =>
            resolveMarkdownMediaSrc(
              src,
              activePathRef.current,
              buildMediaSourceResolveOptions(rootDirRef.current),
            ),
          getNoteAssetContext,
          onPasteImage: pasteImageForExtensions,
          placeholderText: tRef.current('editor.placeholder'),
          placeholderHint: tRef.current('editor.placeholderHint'),
        }).concat(EditorLocalSearchExtension),
      [getNoteAssetContext, pasteImageForExtensions],
    )

    const editorInteractionProps = useMemo(
      () =>
        createTiptapEditorInteractionProps({
          wikiLinkMenuRef,
          setWikiLinkMenu,
          applyWikiLinkSuggestAt,
          slashMenuRef,
          setSlashMenu,
          slashHoverIndexRef,
          setSlashHoverIndex,
          applySlashCommandAt,
          searchOpenRef,
          setSearchOpen,
          editorInstanceRef,
          bumpSearchVersion,
          composingRef,
          emitLunaSurface,
          scheduleMarkdownSync,
          onAssetFilesDropRef,
          focusNoScroll: TI_FOCUS_NO_SCROLL,
          shellRef,
          pointerLinkRef,
          getLunaAssetTooltipRef,
          updateLinkModifierHint,
          onWikiLinkHoverRef,
          rootDirRef,
          activePathRef,
          clearLinkModifierHint,
          onWikiLinkNavigateRef,
          onLunaAssetLinkClickRef,
          reportLinkOpenFailed,
          markUserEditIntent,
        }),
      [
        applyWikiLinkSuggestAt,
        applySlashCommandAt,
        markUserEditIntent,
        scheduleMarkdownSync,
        updateLinkModifierHint,
        clearLinkModifierHint,
        reportLinkOpenFailed,
      ],
    )

    const editorLifecycleHandlers = useMemo(
      () =>
        createTiptapEditorLifecycleHandlers({
          documentKeyRef,
          markdownRef,
          hasUserEditedSinceDocumentLoadRef,
          atomicVisualDocumentEnterRef,
          onAtomicVisualDocumentEnterConsumedRef,
          editorInstanceRef,
          didAtomicVisualBootstrapRef,
          pendingInitialHydrationRef,
          resolveVisualTabRestore,
          applyVisualTabViewportRestore,
          syncExternalMarkdownRefs,
          lastDocumentKeyRef,
          flushVmTiptapRecorderBatch,
          resetTransactionLog,
          scheduleVisualTailTrace,
          scheduleVisualBlockGapTrace,
          scheduleRefreshSlashMenu,
          refreshWikiLinkMenu,
          onOutlineHeadingsChangeRef,
          parseHeadingsFromPmDoc,
          scheduleOutlineHeadingsSync,
          composingRef,
          scheduleMarkdownSync,
          markUserEditIntent,
          bridgeRememberCurrentSelection,
          shouldShowCodeChromeForBlockType,
          emitLunaSurface,
          sidebarListModeRef,
          onActiveHeadingChangeRef,
          onSelectionActivityRef,
          headingIdBeforeSelection,
          skipRecordMetaKey: VM_SKIP_RECORD_META,
        }),
      [
        hasUserEditedSinceDocumentLoadRef,
        markUserEditIntent,
        scheduleRefreshSlashMenu,
        refreshWikiLinkMenu,
        scheduleMarkdownSync,
        syncExternalMarkdownRefs,
        scheduleOutlineHeadingsSync,
      ],
    )

    const editor = useEditor({
      extensions: visualEditorExtensions,
      content: '',
      editorProps: {
        attributes: {
          class: 'tiptap-editor-content',
          spellcheck: 'false',
        },
        ...editorInteractionProps,
      },
      ...editorLifecycleHandlers,
    }, [
      visualEditorExtensions,
      editorInteractionProps,
      editorLifecycleHandlers,
    ])

    useEffect(() => {
      if (!editor || !wikiLinkMenu) return
      const scrollRoot = editor.view.dom as HTMLElement
      const onReposition = () => refreshWikiLinkMenu(editor)
      scrollRoot.addEventListener('scroll', onReposition, { passive: true })
      window.addEventListener('resize', onReposition, { passive: true })
      return () => {
        scrollRoot.removeEventListener('scroll', onReposition)
        window.removeEventListener('resize', onReposition)
      }
    }, [editor, wikiLinkMenu, refreshWikiLinkMenu])

    useEffect(() => {
      if (!slashMenu) setSlashHoverIndex(-1)
    }, [slashMenu])

    useEffect(() => {
      installModeSwitchRegressionGateDevtools()
    }, [])

    useEffect(() => {
      if (!editor || !slashMenu) return
      const scrollRoot = editor.view.dom as HTMLElement
      const onReposition = () => scheduleRefreshSlashMenu(editor)
      scrollRoot.addEventListener('scroll', onReposition, { passive: true })
      window.addEventListener('resize', onReposition, { passive: true })
      return () => {
        scrollRoot.removeEventListener('scroll', onReposition)
        window.removeEventListener('resize', onReposition)
      }
    }, [editor, slashMenu, scheduleRefreshSlashMenu])

    useEffect(() => {
      return () => {
        if (slashMenuRefreshRafRef.current) {
          cancelAnimationFrame(slashMenuRefreshRafRef.current)
          slashMenuRefreshRafRef.current = 0
        }
      }
    }, [])

    useEffect(() => {
      if (!editor) return
      ensurePmInputUnlockedOnBoot(editor)
    }, [editor])

    useEffect(() => {
      const shell = shellRef.current
      if (!shell) return
      return installMermaidClipboardCapture(shell)
    }, [editor])

    useLayoutEffect(() => {
      if (!editor) return
      const root = editor.view.dom as HTMLElement
      viewportAnchorEngine.registerEditorNode(VIEWPORT_DOCUMENT_NODE_ID, root, root)
      return () => {
        viewportAnchorEngine.unregisterEditorNode(VIEWPORT_DOCUMENT_NODE_ID)
      }
    }, [editor])

    useEffect(() => {
      if (!editor) return
      const onKey = (e: KeyboardEvent) => {
        const mod = e.metaKey || e.ctrlKey
        updateLinkModifierHint(pointerLinkRef.current, mod)
      }
      window.addEventListener('keydown', onKey, true)
      window.addEventListener('keyup', onKey, true)
      return () => {
        window.removeEventListener('keydown', onKey, true)
        window.removeEventListener('keyup', onKey, true)
      }
    }, [editor, updateLinkModifierHint])

    useEffect(() => {
      editorHookRef.current = editor
    }, [editor])

    useEffect(() => {
      if (!editor) return
      editorInstanceRef.current = editor
      return () => {
        if (editorInstanceRef.current === editor) editorInstanceRef.current = null
      }
    }, [editor])

    useEffect(() => {
      if (!editor) return
      let cancelled = false

      const syncMarkdownFromProps = () => {
        if (cancelled || editor.isDestroyed) return
        syncTiptapEditorFromProps({
          editor,
          documentKey,
          markdown,
          hasUserEditedSinceDocumentLoadRef,
          suppressMarkdownSyncRef,
          pendingInitialHydrationRef,
          syncExternalMarkdownRefs,
          lastExternalMarkdownRef,
          lastNormalizedExternalMarkdownRef,
          lastDocumentKeyRef,
          didAtomicVisualBootstrapRef,
          normalizeSerializedMarkdownForSource,
          atomicVisualDocumentEnterRef,
          resolveVisualTabRestore,
          flushMermaidSourceForDocumentSwitch,
          composingRef,
          pointerLinkRef,
          clearLinkModifierHint,
          scheduleVisualTailTrace,
          scheduleVisualBlockGapTrace,
          flushVmTiptapRecorderBatch,
          resetTransactionLog,
          applyVisualTabViewportRestore,
          onAtomicVisualDocumentEnterConsumedRef,
          onOutlineHeadingsChangeRef,
          parseHeadingsFromPmDoc,
        })
      }

      const attemptSync = () => {
        if (cancelled) return
        runAfterReactCommitWhen(
          () => {
            if (cancelled || editor.isDestroyed) return
            syncMarkdownFromProps()
          },
          () => Boolean(suppressMarkdownSyncRef?.current),
        )
      }

      attemptSync()
      return () => {
        cancelled = true
        pendingInitialHydrationRef.current = null
      }
    }, [documentKey, editor, markdown, clearLinkModifierHint, suppressMarkdownSyncRef, syncExternalMarkdownRefs])

    useEffect(() => {
      if (!editor || !searchOpen) return
      const updateSearchSnapshot = () => bumpSearchVersion()
      editor.on('transaction', updateSearchSnapshot)
      return () => {
        editor.off('transaction', updateSearchSnapshot)
      }
    }, [editor, searchOpen])

    useEffect(() => {
      return () => {
        if (serializeTimerRef.current != null) window.clearTimeout(serializeTimerRef.current)
        if (
          serializeIdleCallbackRef.current != null &&
          typeof cancelIdleCallback === 'function'
        ) {
          cancelIdleCallback(serializeIdleCallbackRef.current)
          serializeIdleCallbackRef.current = null
        }
        if (headingParseTimerRef.current != null) window.clearTimeout(headingParseTimerRef.current)
      }
    }, [])

    useEffect(() => {
      if (!editor || sidebarListMode !== 'outline') return
      onActiveHeadingChangeRef.current(headingIdBeforeSelection(editor))
    }, [editor, sidebarListMode])

    useEffect(() => {
      if (!editor) return
      editor.setEditable(Boolean(activePath || rootDir || markdown))
    }, [activePath, editor, markdown, rootDir])

    useImperativeHandle(
      ref,
      () => ({
        ...createTiptapEditorHandleCore({
          editor,
          editorInstanceRef,
          lastDocumentKeyRef,
          markdown,
          hasUserEditedSinceDocumentLoadRef,
          setSearchMode,
          setSearchOpen,
          bumpSearchVersion,
          searchOpenRef,
          moveSearch: moveTiptapSearch,
          replaceSearchNext: replaceNextTiptapMatch,
          compileEditorMarkdownForSync,
          lastExternalMarkdownRef,
          lastNormalizedExternalMarkdownRef,
          serializeTimerRef,
          serializeIdleCallbackRef,
          suppressMarkdownSyncRef,
          onMarkdownChangeRef,
          normalizeMarkdown,
          toPendingMarkdownSyncError,
          composingRef,
        }),
        ...createTiptapEditorHandleActions({
          editor,
          focusNoScroll: TI_FOCUS_NO_SCROLL,
          markUserEditIntent,
          resolveActiveBlockSelectionTarget,
          hasActiveMarkdownSourceReveal: (editor) => Boolean(getActiveMarkdownSourceReveal(editor.view)),
          hasActiveMermaidSource,
          openMermaidSourceForTarget,
          startMarkdownBlockSourceReveal,
          commitActiveMarkdownSourceReveal,
          closeActiveMermaidSource,
          selectedText,
          serializeSelectedMarkdown: (editor) => {
            const { from, to } = editor.state.selection
            return canonicalMarkdownSemantics.serializeRange(editor.state.doc, editor.schema, from, to)
          },
          applyPlainTextInsertion: (editor, text) => {
            const tr = applyPlainTextInsertion(editor.state, text, 'paste')
            editor.view.dispatch(tr)
          },
          runTiptapCommand,
          onUnsupportedVisualOp: (reason: VisualOpFailureReason) => {
            const key =
              reason === 'inCodeContext'
                ? 'editor.status.visualOpInCodeContext'
                : reason === 'imeComposing'
                  ? 'editor.status.visualOpImeComposing'
                  : 'editor.status.visualOpUnsupported'
            onStatusRef.current?.(tRef.current(key), 'warning')
          },
        }),
        ...createTiptapEditorCaptureHandle({
          editor,
          boundDocumentKey: lastDocumentKeyRef.current,
          markdown,
          flushMermaidSourceForSerialize,
          trySerialize: canonicalMarkdownSemantics.trySerialize,
          normalizeSerializedMarkdownForSource,
          allocModeSwitchCaptureFrameId,
          deriveHierarchicalSelectionFromPm,
          freezeModeSwitchSnapshot,
          reportModeSwitchFreezeFailure,
          assertNoPartialModeSwitchMutation,
          isModeSwitchFreezeError,
          makeModeBridgeId,
          recordModeSwitchGoodAnchor,
          debugModeSwitch,
          describeSelectionInText,
          describeScrollMetrics,
          summarizeSnapshot,
        }),
        ...createTiptapEditorHandleNavigation({
          editor,
          lastDocumentKeyRef,
          waitAnimationFrame,
          findHeadingRevealElement,
          revealScrollContainer,
          focusEditor: focusTiptapProseMirrorSurface,
          centerRevealElementInContainer,
          highlightRevealElement,
          logRevealAnchorTrace,
          findBlockRevealElement,
          findLineRevealElement,
          findHeadingPositionInDoc,
        }),
      }),
      [editor, markdown, compileEditorMarkdownForSync, markUserEditIntent, normalizeMarkdown, suppressMarkdownSyncRef],
    )

    const searchSnapshot = useMemo(() => {
      void searchVersion
      return getTiptapSearchSnapshot(editor)
    }, [editor, searchVersion])

    return (
      <MermaidSourceSessionProvider editor={editor}>
        <div className="tiptap-editor-shell" ref={shellRef}>
          {searchOpen && editor ? (
            <EditorSearchOverlay
              mode={searchMode}
              query={searchSnapshot.query}
              replaceText={searchReplaceText}
              activeIndex={searchSnapshot.activeIndex}
              matchCount={searchSnapshot.matches.length}
              findPlaceholder={tRef.current('editor.search.findPlaceholder')}
              replacePlaceholder={tRef.current('editor.search.replacePlaceholder')}
              labels={{
                previous: tRef.current('editor.search.previous'),
                next: tRef.current('editor.search.next'),
                replace: tRef.current('editor.search.replace'),
                replaceAll: tRef.current('editor.search.replaceAll'),
                close: tRef.current('editor.search.close'),
              }}
              onQueryChange={(query) => {
                setTiptapSearchQuery(editor, query)
                bumpSearchVersion()
              }}
              onReplaceTextChange={setSearchReplaceText}
              onNext={() => {
                moveTiptapSearch(editor, 1)
                bumpSearchVersion()
              }}
              onPrevious={() => {
                moveTiptapSearch(editor, -1)
                bumpSearchVersion()
              }}
              onReplaceOne={() => {
                replaceCurrentTiptapMatch(editor, searchReplaceTextRef.current)
                bumpSearchVersion()
              }}
              onReplaceAll={() => {
                replaceAllTiptapMatches(editor, searchReplaceTextRef.current)
                bumpSearchVersion()
              }}
              onClose={() => {
                setSearchOpen(false)
                setSearchMode('find')
                setSearchReplaceText('')
                clearTiptapSearch(editor)
                bumpSearchVersion()
              }}
            />
          ) : null}
          <EditorContent editor={editor} />
          {wikiLinkMenu ? (
            <WikiLinkSuggestMenu
              menu={wikiLinkMenu}
              ariaLabel={t('editor.wikiSuggest.aria')}
              onApply={(idx) => {
                void applyWikiLinkSuggestAt(idx)
              }}
            />
          ) : null}
          {slashMenu ? (
            <SlashCommandMenu
              menu={slashMenu}
              ariaLabel={t('editor.slash.aria')}
              hoverIndex={slashHoverIndex}
              onHoverIndexChange={(idx) => {
                setSlashHoverIndex((prev) => (prev === idx ? prev : idx))
              }}
              onCaptureSelection={bridgeCaptureEditorSelection}
              onApply={(idx) => {
                void applySlashCommandAt(idx).catch((err) => {
                  if (import.meta.env.DEV) console.warn('[slash-menu] apply failed', err)
                })
              }}
            />
          ) : null}
        </div>
      </MermaidSourceSessionProvider>
    )
  },
)

TiptapMarkdownEditor.displayName = 'TiptapMarkdownEditor'
