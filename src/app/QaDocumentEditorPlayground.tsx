import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { _setEditorMutationBridgeForTest } from '../editor/editorMutationBridge'

import '../App.css'
import { I18nProvider, useI18n, type I18nBootstrap } from '../i18n'
import {
  ensureLocaleRawLoaded,
  getEnMessagesSnapshot,
  isUiLocaleId,
  type UiLocaleId,
} from '../i18n/localeRegistry'
import {
  TiptapMarkdownEditor,
  type TiptapMarkdownEditorHandle,
} from '../editor/TiptapMarkdownEditor'
import { EditorOpenReason } from '../editor/editorOpenReason'
import { markAppSettingsHydratedForTests, setAppearanceSetting } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { DocumentOutlineBlock, type TocHeading } from './components/DocumentOutlineBlock'
import { EditorFormatToolbar } from './components/EditorFormatToolbar'
import { isEditorFormatMenuPortalNode } from './components/editorFormatMenuPortal'
import { useSidebarOutlineHeadings } from './hooks/useSidebarOutlineHeadings'
import { setTabBody } from './document/tabBodiesStore'
import { probeCaretStructuralContext } from '../editor/caretStructuralContext'
import { useEditorFormatToolbarActive, useEditorHasTextSelection } from './hooks/useEditorTextColor'
import { getEphemeralSession } from '../editor/ephemeralFormatting'
import { resolveFormatToolbarCommandActive } from '../editor/editorFormatToolbarState'
import { setWikiLinkSuggestPathProvider } from '../editor/lunaWikiLinkSuggest'
import { resetPasteDedupeForTests } from '../editor/pasteDedupe'
import { pasteFromNavigatorClipboard } from '../editor/pasteFromNavigatorClipboard'
import { takeLastPasteIssue } from '../editor/pasteIssueReporter'
import type { TiptapEditorCommand } from '../editor/tiptapEditorTypes'
import type { Editor } from '@tiptap/core'
import { redoLastTransaction, setActiveTransactionDoc, undoLastTransaction } from '../menu/commandTransaction'
import { setInputRouterDocId } from '../vm/inputRouter'
import { computeDocumentContentStats } from './documentContentStats'
import { isCodeBlockCmFocused } from '../editor/codeBlock/cm/codeBlockCmFocus'
import {
  isPmDomSuspendedForCodeBlockCm,
  isPmLockedForCodeBlockCm,
} from '../editor/codeBlock/cm/codeBlockCmPmFocusLock'
import {
  bootstrapQaDocumentEditorKnowledgeVault,
  type QaDocumentEditorKnowledgeVault,
} from './qa/bootstrapQaDocumentEditorKnowledgeVault'
import { QA_KNOWLEDGE_ROOT } from './qa/qaKnowledgeFixtures'

const QA_WIKI_SUGGEST_FIXTURES = [
  { docKey: 'qa/note-a.md', title: 'Note A' },
  { docKey: 'qa/note-b.md', title: 'Note B' },
] as const

function resolveQaLocale(): UiLocaleId {
  const raw = new URLSearchParams(window.location.search).get('locale')
  return raw && isUiLocaleId(raw) ? raw : 'en'
}

const FORMAT_COMMAND_MAP: Record<string, TiptapEditorCommand> = {
  'fmt-bold': { type: 'bold' },
  'fmt-italic': { type: 'italic' },
  'fmt-underline': { type: 'underline' },
  'fmt-strike': { type: 'strike' },
  'fmt-highlight': { type: 'highlight' },
  'fmt-inline-code': { type: 'code' },
  'fmt-toc': { type: 'insertTocAtAppropriatePosition' },
}

declare global {
  interface Window {
    __QA_DOCUMENT_EDITOR__?: {
      loadMarkdown: (markdown: string) => void
      getMarkdown: () => string
      getContentStats: (markdown?: string) => { lines: number; chars: number; headings: number }
      countInEditor: (selector: string) => number
      editorPlainText: () => string
      hasConsoleErrors: () => boolean
      getConsoleErrors: () => string[]
      isEditorAlive: () => boolean
      getLoadedCharCount: () => number
      getMemorySnapshot: () => Promise<{
        heapUsedMB: number
        heapTotalMB: number
        charCount: number
        editorNodeCount: number
      }>
      openManyDocuments: (count: number) => Promise<{
        opened: number
        lastIndex: number
        lastPlainText: string
      }>
      waitForMemorySettle: (intervalMs?: number) => Promise<void>
      probeBodyParagraphTypography: () => Array<{
        index: number
        text: string
        isBlank: boolean
        lineHeightPx: number
        lineHeightRatio: number
        boxHeightPx: number
      }>
      getFormatButtonPressed: (commandId: string) => boolean
      probeFormatToolbarState: () => {
        visualSelectionTick: number
        fmtBoldPressed: boolean
        isActiveBold: boolean
        storedMarkNames: string[]
        cursorMarkNames: string[]
        ephemeralSession: string | null
        resolveFormatActive: boolean
      }
      getVisualSelectionTick: () => number
      selectPlainText: (needle: string) => boolean
      selectBoldText: (needle: string) => boolean
      selectHighlightText: (needle: string) => boolean
      focusCodeBlockContents: () => boolean
      runVisualCommand: (command: TiptapEditorCommand) => boolean
      runEditUndoCommand: () => boolean
      runEditRedoCommand: () => boolean
      getLastStatus: () => string
      runMenuPasteFromClipboard: () => Promise<{ ok: boolean; lastStatus: string }>
      probeParagraphLayout: () => Array<{
        index: number
        text: string
        isBlank: boolean
        top: number
        bottom: number
        right: number
        height: number
      }>
      probePmSelection: () => {
        from: number
        to: number
        empty: boolean
        selectedText: string
        onlyNewline: boolean
        includesEmptyParagraph: boolean
        fromParentText: string
        toParentText: string
        fromParentIsBlank: boolean
        toParentIsBlank: boolean
        spansMultipleParagraphs: boolean
        paragraphTextsInRange: string[]
        emptyHighlighted: number
        domRectTop: number | null
        domSelectedText: string
      } | null
      beginSelectionTimelineCapture: () => boolean
      endSelectionTimelineCapture: () => Array<{
        ts: number
        source: string
        emptyHighlighted: number
        includesEmptyParagraph: boolean
        spansMultipleParagraphs: boolean
        fromParentIsBlank: boolean
        toParentIsBlank: boolean
        selectedText: string
        domSelectedText: string
        from: number
        to: number
      }>
      probeCoordsAtParagraphEnd: (
        paragraphIndex: number,
        yFraction?: number,
      ) => {
        x: number
        y: number
        posAtCoords: number | null
        resolvedParentText: string | null
        parentOffset: number | null
        atParentEnd: boolean
      } | null
      probeVisualLinesInParagraph: (paragraphIndex: number) => Array<{
        lineIndex: number
        top: number
        bottom: number
        left: number
        right: number
        height: number
        text: string
      }>
      probeCoordsAtVisualLineEnd: (
        paragraphIndex: number,
        lineIndex: number,
        yFraction?: number,
      ) => {
        x: number
        y: number
        posAtCoords: number | null
        resolvedParentText: string | null
        parentOffset: number | null
        atParentEnd: boolean
      } | null
      probeReadingPolish: () => {
        textRendering: string
        headingMarginTopPx: number | null
        imgBoxShadow: string
        imgBorderRadius: string
        hrOpacity: string
      } | null
      probeEditorFocusChrome: () => {
        mainHasFocusedClass: boolean
        surfaceBoxShadow: string
      } | null
      focusEditor: () => void
      blurEditor: () => void
      moveCaretToParagraphEnd: (paragraphIndex: number) => boolean
      probeSlashMenu: () => {
        open: boolean
        query: string
        itemLabels: string[]
        activeIndex: number
      } | null
      probeWikiSuggestMenu: () => {
        open: boolean
        query: string
        items: Array<{ title: string; hint: string; selectable: boolean }>
        activeIndex: number
      } | null
      clickFormatToolbarButton: (commandId: string) => boolean
      setFormatToolbarEnabled: (enabled: boolean) => Promise<void>
      isFormatToolbarVisible: () => boolean
      probeSpellcheckChrome: () => {
        visualSpellcheck: string | null
        codeBlockSpellcheck: string | null
        calloutSpellcheck: string | null
      }
      setSpellcheckEnabled: (enabled: boolean) => Promise<void>
      resetPasteDedupe: () => void
      getOutlineTitles: () => string[]
      setPathContext?: (rootDir: string, activePath: string) => void
      patchEmbeddedFixture?: (relPath: string, markdown: string) => void
      probeWikiEmbedSurfaces?: () => Array<{
        collapsed: boolean
        text: string
        loading: boolean
      }>
      clickWikiEmbedCollapse?: (index?: number) => boolean
      getLastEmbeddedLinkNav?: () => unknown
      getLastEmbeddedHashNav?: () => string | null
      loadMarkdownTimed?: (
        markdown: string,
        options?: { minHtmlBlocks?: number; timeoutMs?: number; remount?: boolean },
      ) => Promise<QaLoadTimingSnapshot>
      getLastLoadTiming?: () => QaLoadTimingSnapshot | null
      probeHtmlEmbeddedHealth?: () => QaHtmlEmbeddedHealth
      pasteClipboardImage: () => Promise<boolean>
      pasteImageFromNavigatorClipboard: () => Promise<boolean>
      probePasteCaretContext: () => {
        parentType: string
        parentOffset: number
        nodeBeforeType: string | null
        prevBlockIsImageParagraph: boolean
        caretInEmptyParagraphBelowImage: boolean
      } | null
      probeCaretStructuralContext: () => {
        parentType: string
        parentOffset: number
        parentTextLength: number
        inListItem: boolean
        listItemDepth: number | null
        enclosingListType: string | null
        isEmptyTextblock: boolean
        orphanEmptyParagraphAfterList: boolean
        selectionNotInInlineContent: boolean
        domCaretLeftPx: number | null
        nearestListMarkerLeftPx: number | null
        visualOrphanAfterList: boolean
      } | null
      probeCaretDocBlock: () => {
        docChildIndex: number
        blockType: string
        isEmptyParagraph: boolean
        blockText: string
      } | null
      probeDocBlockTypes: () => string[]
      probeDocumentCaretDiagnostics: () => {
        cmFocusedClass: boolean
        staleCmFocusedChrome: boolean
        cmHasFocus: boolean
        cmCursorCount: number
        cmCursorVisibility: string | null
        cmContentCaretColor: string
        pmCaretColor: string
        pmCaretTransparent: boolean
        pmContentEditable: boolean
        pmHasFocus: boolean
        activeInCm: boolean
        codeBlockInView: boolean
        pmDomSuspended: boolean
        pmSoftLocked: boolean
        activeElementSummary: string
        pmSelectionEmpty: boolean
        pmSelectionOutsideCodeBlock: boolean
      } | null
      scrollDocumentCodeBlockOffScreen: (blockIndex: number) => boolean
      countDocumentCodeBlocks: () => number
      probeDrawingBlocks: () => Array<{
        width: number
        height: number
        originX: number
        originY: number
        strokeCount: number
      }>
      clickBelowLastOrderedListItem: () => boolean
    }
  }
}

function resolveDocumentEditorScrollHost(): HTMLElement | null {
  return (
    (document.querySelector('.qa-document-editor-shell .ProseMirror') as HTMLElement | null) ??
    (document.querySelector('.qa-document-editor-shell[data-testid="qa-editor-scroll-host"]') as
      | HTMLElement
      | null) ??
    (document.querySelector('.qa-document-editor-shell') as HTMLElement | null)
  )
}

function resolveDocumentCodeBlockWrap(blockIndex: number): HTMLElement | null {
  const wraps = document.querySelectorAll('.qa-document-editor-shell [data-luna-code-block-wrap]')
  return (wraps.item(blockIndex) as HTMLElement | null) ?? null
}

const QA_DOCUMENT_KEY = 'qa:document-editor'
const QA_DOC_PATH = 'qa/document-editor.md'
const QA_INITIAL_MARKDOWN = '# Document editor QA\n\nReady.\n'

export type QaHtmlEmbeddedHealth = {
  htmlBlockCount: number
  htmlCommentBlockCount: number
  rawTextBlockCount: number
  tableWrapCount: number
  imageCount: number
  brokenImageCount: number
  unresolvedRelativeImageCount: number
  linkCount: number
  editorDomNodeCount: number
  htmlSurfaceOverflowCount: number
  consoleErrorCount: number
}

function isUnresolvedRelativeImageSrc(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return false
  if (/^https?:\/\//iu.test(trimmed)) return false
  if (trimmed.startsWith('tauri://') || trimmed.startsWith('asset://')) return false
  if (/^file:/iu.test(trimmed)) return false
  return true
}

function isBrokenLoadedImage(img: HTMLImageElement): boolean {
  const src = img.getAttribute('src')?.trim() ?? ''
  if (!src || src.startsWith('data:')) return false
  if (!img.complete) return false
  return img.naturalWidth === 0 && img.naturalHeight === 0
}

function probeHtmlEmbeddedHealth(): QaHtmlEmbeddedHealth {
  const shell = document.querySelector('.qa-document-editor-shell .tiptap-editor-content')
  const scope = shell ?? document
  const htmlBlocks = scope.querySelectorAll('.pm-luna-html-block').length
  const htmlComments = scope.querySelectorAll('.pm-luna-html-comment-block').length
  const rawTextBlocks = scope.querySelectorAll('.pm-luna-raw-block--text').length
  const tableWraps = scope.querySelectorAll('.pm-luna-table-wrap').length
  const images = scope.querySelectorAll(
    '.pm-luna-html-block-surface img, .pm-luna-table-wrap img, .pm-image-block-img',
  )
  let brokenImageCount = 0
  let unresolvedRelativeImageCount = 0
  images.forEach((node) => {
    const img = node as HTMLImageElement
    const src = img.getAttribute('src') ?? ''
    if (isUnresolvedRelativeImageSrc(src)) unresolvedRelativeImageCount += 1
    if (isBrokenLoadedImage(img)) brokenImageCount += 1
  })
  const links = scope.querySelectorAll('.pm-luna-html-block-surface a, .pm-luna-raw-inline-surface a').length
  let htmlSurfaceOverflowCount = 0
  scope.querySelectorAll('.pm-luna-html-block-surface').forEach((surface) => {
    const el = surface as HTMLElement
    if (el.scrollWidth > el.clientWidth + 2) htmlSurfaceOverflowCount += 1
  })
  return {
    htmlBlockCount: htmlBlocks,
    htmlCommentBlockCount: htmlComments,
    rawTextBlockCount: rawTextBlocks,
    tableWrapCount: tableWraps,
    imageCount: images.length,
    brokenImageCount,
    unresolvedRelativeImageCount,
    linkCount: links,
    editorDomNodeCount: shell?.querySelectorAll('*').length ?? 0,
    htmlSurfaceOverflowCount,
    consoleErrorCount: 0,
  }
}

export type QaLoadTimingSnapshot = {
  startedAt: number
  markdownChars: number
  proseMirrorReadyAt: number | null
  htmlSurfacesReadyAt: number | null
  settledAt: number | null
  durations: {
    toProseMirrorMs: number | null
    toHtmlSurfacesMs: number | null
    totalMs: number | null
  }
  health: QaHtmlEmbeddedHealth | null
}

function finalizeLoadTiming(timing: QaLoadTimingSnapshot): QaLoadTimingSnapshot {
  const health = probeHtmlEmbeddedHealth()
  health.consoleErrorCount = 0
  timing.health = health
  timing.settledAt = timing.settledAt ?? performance.now()
  timing.durations = {
    toProseMirrorMs:
      timing.proseMirrorReadyAt != null ? timing.proseMirrorReadyAt - timing.startedAt : null,
    toHtmlSurfacesMs:
      timing.htmlSurfacesReadyAt != null ? timing.htmlSurfacesReadyAt - timing.startedAt : null,
    totalMs: timing.settledAt != null ? timing.settledAt - timing.startedAt : null,
  }
  return timing
}


type VisualLineProbe = {
  lineIndex: number
  top: number
  bottom: number
  left: number
  right: number
  height: number
  text: string
}

function readVisualLinesInParagraph(paragraph: HTMLElement): VisualLineProbe[] {
  const lines: VisualLineProbe[] = []
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let textNode = walker.nextNode() as Text | null
  while (textNode) {
    const content = textNode.textContent ?? ''
    for (let i = 0; i < content.length; i += 1) {
      const range = document.createRange()
      range.setStart(textNode, i)
      range.setEnd(textNode, i + 1)
      const rect = range.getBoundingClientRect()
      if (!rect.width && !rect.height) continue
      const last = lines[lines.length - 1]
      const sameLine = last && Math.abs(last.top - rect.top) < 2
      if (sameLine) {
        last.text += content[i] ?? ''
        last.right = Math.max(last.right, rect.right)
        last.bottom = Math.max(last.bottom, rect.bottom)
        last.height = last.bottom - last.top
      } else {
        lines.push({
          lineIndex: lines.length,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          height: rect.height,
          text: content[i] ?? '',
        })
      }
    }
    textNode = walker.nextNode() as Text | null
  }
  return lines
}

type SelectionTimelineSample = {
  ts: number
  source: string
  emptyHighlighted: number
  includesEmptyParagraph: boolean
  spansMultipleParagraphs: boolean
  fromParentIsBlank: boolean
  toParentIsBlank: boolean
  selectedText: string
  domSelectedText: string
  from: number
  to: number
}

let activeSelectionTimeline: {
  samples: SelectionTimelineSample[]
  cleanup: () => void
} | null = null

function buildSelectionTimelineSample(editor: Editor, source: string): SelectionTimelineSample | null {
  const { from, to } = editor.state.selection
  const selectedText = editor.state.doc.textBetween(from, to, '\n', '\n')
  let includesEmptyParagraph = false
  const paragraphTextsInRange: string[] = []
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== 'paragraph') return
    if (pos >= from && pos < to) paragraphTextsInRange.push(node.textContent)
    if (node.content.size === 0) includesEmptyParagraph = true
    if (node.childCount === 1 && node.firstChild?.type.name === 'hardBreak') {
      includesEmptyParagraph = true
    }
  })
  const domSel = window.getSelection()
  const $from = editor.state.selection.$from
  const $to = editor.state.selection.$to
  const fromParent = $from.parent
  const toParent = $to.parent
  const fromParentIsBlank =
    fromParent.type.name === 'paragraph' &&
    (fromParent.content.size === 0 ||
      (fromParent.childCount === 1 && fromParent.firstChild?.type.name === 'hardBreak'))
  const toParentIsBlank =
    toParent.type.name === 'paragraph' &&
    (toParent.content.size === 0 ||
      (toParent.childCount === 1 && toParent.firstChild?.type.name === 'hardBreak'))
  const spansMultipleParagraphs =
    $from.start($from.depth) !== $to.start($to.depth) || paragraphTextsInRange.length > 1
  return {
    ts: performance.now(),
    source,
    emptyHighlighted: document.querySelectorAll('.pm-empty-para-in-selection').length,
    includesEmptyParagraph,
    spansMultipleParagraphs,
    fromParentIsBlank,
    toParentIsBlank,
    selectedText,
    domSelectedText: domSel?.toString() ?? '',
    from,
    to,
  }
}

function QaDocumentEditorInner({ locale }: { locale: UiLocaleId }) {
  const { t, toolbarEditorFormat } = useI18n()
  const editorRef = useRef<TiptapMarkdownEditorHandle>(null)
  const visualEditorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const lastStatusRef = useRef('')
  const [docKey, setDocKey] = useState(`${QA_DOCUMENT_KEY}:0`)
  const [markdown, setMarkdown] = useState(QA_INITIAL_MARKDOWN)
  const [status, setStatus] = useState('booting')
  const [editorStatus, setEditorStatus] = useState('')
  const [editorChromeFocused, setEditorChromeFocused] = useState(false)
  const [formatMenuOpen, setFormatMenuOpen] = useState(false)
  const showEditorChromeFocused = editorChromeFocused || formatMenuOpen
  const [visualSelectionTick, setVisualSelectionTick] = useState(0)
  const visualSelectionTickRef = useRef(0)
  visualSelectionTickRef.current = visualSelectionTick
  const consoleErrorsRef = useRef<string[]>([])
  const liveOutlineByPathRef = useRef(new Map<string, TocHeading[]>())
  const outlineHeadingsRef = useRef<TocHeading[]>([])
  const [liveOutlineTick, setLiveOutlineTick] = useState(0)
  const [qaRootDir, setQaRootDir] = useState(QA_KNOWLEDGE_ROOT)
  const [qaActivePath, setQaActivePath] = useState(QA_DOC_PATH)
  const qaVaultRef = useRef<QaDocumentEditorKnowledgeVault | null>(null)
  const lastEmbeddedLinkNavRef = useRef<unknown>(null)
  const lastEmbeddedHashNavRef = useRef<string | null>(null)
  const lastLoadTimingRef = useRef<QaLoadTimingSnapshot | null>(null)

  visualEditorRef.current = editorRef.current

  const markdownOutlineHeadings = useSidebarOutlineHeadings(QA_DOC_PATH, markdown)
  const outlineHeadings = useMemo(() => {
    void liveOutlineTick
    const live = liveOutlineByPathRef.current.get(QA_DOC_PATH)
    if (live && live.length > 0) {
      return live
    }
    return markdownOutlineHeadings
  }, [markdownOutlineHeadings, liveOutlineTick])
  outlineHeadingsRef.current = outlineHeadings

  const onEmbeddedHtmlLinkNavigate = useCallback((target: unknown) => {
    lastEmbeddedLinkNavRef.current = target
  }, [])

  const onEmbeddedHtmlHashNavigate = useCallback((fragment: string) => {
    lastEmbeddedHashNavRef.current = fragment
    editorRef.current?.scrollToHeading(fragment)
  }, [])

  const handleOutlineHeadingsChange = useCallback((headings: TocHeading[]) => {
    if (headings.length === 0) {
      liveOutlineByPathRef.current.delete(QA_DOC_PATH)
    } else {
      liveOutlineByPathRef.current.set(QA_DOC_PATH, headings)
    }
    setLiveOutlineTick((tick) => tick + 1)
  }, [])

  const isFormatCommandActive = useEditorFormatToolbarActive({
    mainPaneMode: 'visual',
    visualEditorRef,
    editorViewRef: { current: null },
    visualSelectionTick,
  })
  const hasTextSelection = useEditorHasTextSelection({
    mainPaneMode: 'visual',
    visualEditorRef,
    editorViewRef: { current: null },
    visualSelectionTick,
  })

  const onFormatCommand = useCallback((commandId: string) => {
    const command = FORMAT_COMMAND_MAP[commandId]
    if (!command) return
    editorRef.current?.runCommand(command)
  }, [])

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: locale })
  }, [locale])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const vault = await bootstrapQaDocumentEditorKnowledgeVault()
        if (cancelled) {
          vault.dispose()
          return
        }
        qaVaultRef.current = vault
        setQaRootDir(QA_KNOWLEDGE_ROOT)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error:vault-boot')
      }
    })()
    return () => {
      cancelled = true
      qaVaultRef.current?.dispose()
      qaVaultRef.current = null
    }
  }, [])

  useEffect(() => {
    setWikiLinkSuggestPathProvider(() =>
      QA_WIKI_SUGGEST_FIXTURES.map((entry) => ({ docKey: entry.docKey, title: entry.title })),
    )
    return () => setWikiLinkSuggestPathProvider(null)
  }, [])

  useEffect(() => {
    setActiveTransactionDoc(QA_DOC_PATH)
    setInputRouterDocId(QA_DOC_PATH)
    const syncBridge = () => {
      _setEditorMutationBridgeForTest(editorRef.current?.getEditor() ?? null, null, 'visual')
    }
    syncBridge()
    const timer = window.setTimeout(syncBridge, 0)
    return () => {
      window.clearTimeout(timer)
      _setEditorMutationBridgeForTest(null, null, 'visual')
    }
  }, [docKey])

  const qaPasteImage = useCallback(async (file: File, mimeHint: string) => {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
    }
    const mime = mimeHint || file.type || 'image/png'
    return `data:${mime};base64,${btoa(binary)}`
  }, [])

  const onMarkdownChange = useCallback((next: string) => {
    setMarkdown(next)
    setTabBody(QA_DOC_PATH, next)
  }, [])

  const loadMarkdown = useCallback((next: string) => {
    consoleErrorsRef.current = []
    setStatus('ready')
    setDocKey(`${QA_DOCUMENT_KEY}:${Date.now()}`)
    setMarkdown(next)
    setTabBody(QA_DOC_PATH, next)
    liveOutlineByPathRef.current.delete(QA_DOC_PATH)
    setLiveOutlineTick((tick) => tick + 1)
  }, [])

  const waitForLoadSettled = useCallback(
    async (opts?: { minHtmlBlocks?: number; timeoutMs?: number }) => {
      const timing = lastLoadTimingRef.current
      if (!timing) return null
      const timeoutMs = opts?.timeoutMs ?? 30_000
      const minHtmlBlocks = opts?.minHtmlBlocks ?? 0
      const deadline = performance.now() + timeoutMs
      const yieldFrames = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })

      while (performance.now() < deadline) {
        const pm = document.querySelector('.qa-document-editor-shell .ProseMirror')
        if (pm && pm.childNodes.length > 0) {
          timing.proseMirrorReadyAt ??= performance.now()
        }
        const htmlSurfaces = document.querySelectorAll(
          '.qa-document-editor-shell .pm-luna-html-block-surface',
        ).length
        const pmReady = timing.proseMirrorReadyAt != null
        const htmlReady = htmlSurfaces >= minHtmlBlocks
        if (pmReady && (minHtmlBlocks === 0 || htmlReady)) {
          timing.htmlSurfacesReadyAt ??= performance.now()
          timing.settledAt = performance.now()
          const finalized = finalizeLoadTiming(timing)
          finalized.health ??= probeHtmlEmbeddedHealth()
          if (finalized.health) finalized.health.consoleErrorCount = consoleErrorsRef.current.length
          lastLoadTimingRef.current = finalized
          return finalized
        }
        await yieldFrames()
      }

      timing.settledAt = performance.now()
      const finalized = finalizeLoadTiming(timing)
      if (finalized.health) finalized.health.consoleErrorCount = consoleErrorsRef.current.length
      lastLoadTimingRef.current = finalized
      return finalized
    },
    [],
  )

  const loadMarkdownTimed = useCallback(
    async (next: string, opts?: { minHtmlBlocks?: number; timeoutMs?: number; remount?: boolean }) => {
      consoleErrorsRef.current = []
      const timing: QaLoadTimingSnapshot = {
        startedAt: performance.now(),
        markdownChars: next.length,
        proseMirrorReadyAt: null,
        htmlSurfacesReadyAt: null,
        settledAt: null,
        durations: {
          toProseMirrorMs: null,
          toHtmlSurfacesMs: null,
          totalMs: null,
        },
        health: null,
      }
      lastLoadTimingRef.current = timing
      if (opts?.remount === false) {
        setStatus('ready')
        setMarkdown(next)
        setTabBody(QA_DOC_PATH, next)
        liveOutlineByPathRef.current.delete(QA_DOC_PATH)
        setLiveOutlineTick((tick) => tick + 1)
      } else {
        loadMarkdown(next)
      }
      const settled = await waitForLoadSettled(opts)
      if (settled) return settled
      timing.settledAt = performance.now()
      const finalized = finalizeLoadTiming(timing)
      if (finalized.health) finalized.health.consoleErrorCount = consoleErrorsRef.current.length
      lastLoadTimingRef.current = finalized
      return finalized
    },
    [loadMarkdown, waitForLoadSettled],
  )

  const readMemorySnapshot = useCallback(async () => {
    const editorRoot = document.querySelector('.qa-document-editor-shell .tiptap-editor-content')
    let heapUsedMB = 0
    let heapTotalMB = 0
    if ('memory' in performance) {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
      if (memory) {
        heapUsedMB = memory.usedJSHeapSize / (1024 * 1024)
        heapTotalMB = memory.totalJSHeapSize / (1024 * 1024)
      }
    }
    return {
      heapUsedMB,
      heapTotalMB,
      charCount: markdown.length,
      editorNodeCount: editorRoot?.querySelectorAll('*').length ?? 0,
    }
  }, [markdown.length])

  const waitForMemorySettle = useCallback(async (intervalMs = 500) => {
    const gc = (globalThis as { gc?: () => void }).gc
    if (typeof gc === 'function') gc()
    let previous = (await readMemorySnapshot()).heapUsedMB
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, intervalMs))
      const next = (await readMemorySnapshot()).heapUsedMB
      if (Math.abs(next - previous) <= 2) return
      previous = next
    }
  }, [readMemorySnapshot])

  const openManyDocuments = useCallback(
    async (count: number) => {
      consoleErrorsRef.current = []
      const safeCount = Math.max(0, Math.floor(count))
      const yieldToRenderer = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
      for (let index = 0; index < safeCount; index += 1) {
        const nextMarkdown = `# Document ${index}\n\nSequential open probe ${index}.\n`
        setMarkdown(nextMarkdown)
        setTabBody(QA_DOC_PATH, nextMarkdown)
        liveOutlineByPathRef.current.delete(QA_DOC_PATH)
        await yieldToRenderer()
      }
      setLiveOutlineTick((tick) => tick + 1)
      await waitForMemorySettle(250)
      const lastPlainText =
        document
          .querySelector('.qa-document-editor-shell .tiptap-editor-content')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() ?? ''
      return {
        opened: safeCount,
        lastIndex: Math.max(0, safeCount - 1),
        lastPlainText,
      }
    },
    [waitForMemorySettle],
  )

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      consoleErrorsRef.current.push(event.message)
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason)
      consoleErrorsRef.current.push(reason)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    window.__QA_DOCUMENT_EDITOR__ = {
      loadMarkdown,
      getMarkdown: () => editorRef.current?.getMarkdown(true) ?? markdown,
      getContentStats: (source?: string) =>
        computeDocumentContentStats(source ?? editorRef.current?.getMarkdown(true) ?? markdown),
      countInEditor: (selector: string) =>
        document.querySelectorAll(`.qa-document-editor-shell .tiptap-editor-content ${selector}`).length,
      editorPlainText: () =>
        document
          .querySelector('.qa-document-editor-shell .tiptap-editor-content')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() ?? '',
      hasConsoleErrors: () => consoleErrorsRef.current.length > 0,
      getConsoleErrors: () => [...consoleErrorsRef.current],
      isEditorAlive: () =>
        Boolean(document.querySelector('.qa-document-editor-shell .tiptap-editor-content')),
      getLoadedCharCount: () => markdown.length,
      getMemorySnapshot: readMemorySnapshot,
      openManyDocuments,
      waitForMemorySettle,
      probeBodyParagraphTypography: () => {
        const root = document.querySelector('.qa-document-editor-shell .ProseMirror')
        if (!root) return []
        return Array.from(root.querySelectorAll(':scope > p')).map((paragraph, index) => {
          const style = getComputedStyle(paragraph)
          const lineHeightPx = Number.parseFloat(style.lineHeight)
          const fontSizePx = Number.parseFloat(style.fontSize)
          const isBlank =
            paragraph.matches(':empty') ||
            Boolean(paragraph.querySelector('br.ProseMirror-trailingBreak:only-child'))
          return {
            index,
            text: paragraph.textContent ?? '',
            isBlank,
            lineHeightPx,
            lineHeightRatio: lineHeightPx / fontSizePx,
            boxHeightPx: paragraph.getBoundingClientRect().height,
          }
        })
      },
      getFormatButtonPressed: (commandId: string) => {
        const button = document.querySelector(
          `.qa-document-editor-shell .editor-format-toolbar button[data-format-command="${commandId}"]`,
        )
        return button?.getAttribute('aria-pressed') === 'true'
      },
      probeFormatToolbarState: () => {
        const editor = editorRef.current?.getEditor() ?? null
        const state = editor?.state
        const storedMarkNames =
          state?.storedMarks?.map((mark) => mark.type.name) ??
          (state ? state.selection.$from.marks().map((mark) => mark.type.name) : [])
        const cursorMarkNames = state?.selection.$from.marks().map((mark) => mark.type.name) ?? []
        const ephemeral = editor ? getEphemeralSession(editor) : null
        return {
          visualSelectionTick: visualSelectionTickRef.current,
          fmtBoldPressed: document
            .querySelector(
              '.qa-document-editor-shell .editor-format-toolbar button[data-format-command="fmt-bold"]',
            )
            ?.getAttribute('aria-pressed') === 'true',
          isActiveBold: editor?.isActive('bold') ?? false,
          storedMarkNames,
          cursorMarkNames,
          ephemeralSession: ephemeral?.commandType ?? null,
          resolveFormatActive: resolveFormatToolbarCommandActive(editor, 'fmt-bold'),
        }
      },
      getVisualSelectionTick: () => visualSelectionTickRef.current,
      selectPlainText: (needle: string) => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return false
        let from: number | null = null
        let to: number | null = null
        editor.state.doc.descendants((node, pos) => {
          if (from != null || !node.isText) return
          const idx = node.text?.indexOf(needle) ?? -1
          if (idx >= 0) {
            from = pos + idx
            to = from + needle.length
          }
        })
        if (from == null || to == null) return false
        return editor.chain().focus().setTextSelection({ from, to }).run()
      },
      selectBoldText: (needle: string) => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return false
        let from: number | null = null
        let to: number | null = null
        editor.state.doc.descendants((node, pos) => {
          if (from != null || !node.isText) return
          const idx = node.text?.indexOf(needle) ?? -1
          if (idx < 0) return
          const bold = editor.schema.marks.bold
          if (!bold?.isInSet(node.marks)) return
          from = pos + idx
          to = from + needle.length
        })
        if (from == null || to == null) return false
        return editor.chain().focus().setTextSelection({ from, to }).run()
      },
      selectHighlightText: (needle: string) => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return false
        let from: number | null = null
        let to: number | null = null
        editor.state.doc.descendants((node, pos) => {
          if (from != null || !node.isText) return
          const idx = node.text?.indexOf(needle) ?? -1
          if (idx < 0) return
          const highlight = editor.schema.marks.highlight
          if (!highlight?.isInSet(node.marks)) return
          from = pos + idx
          to = from + needle.length
        })
        if (from == null || to == null) return false
        return editor.chain().focus().setTextSelection({ from, to }).run()
      },
      focusCodeBlockContents: () => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return false
        let pos: number | null = null
        editor.state.doc.descendants((node, nodePos) => {
          if (pos != null || node.type.name !== 'codeBlock') return
          pos = nodePos + 1
        })
        if (pos == null) return false
        return editor.chain().focus().setTextSelection(pos).run()
      },
      runVisualCommand: (command: TiptapEditorCommand) => editorRef.current?.runCommand(command) ?? false,
      runEditUndoCommand: () => undoLastTransaction(QA_DOC_PATH),
      runEditRedoCommand: () => redoLastTransaction(QA_DOC_PATH),
      getLastStatus: () => lastStatusRef.current,
      runMenuPasteFromClipboard: async () => {
        try {
          const ok = await pasteFromNavigatorClipboard({
            visualEditorRef: editorRef,
            mainPaneMode: 'visual',
          })
          if (!ok && !takeLastPasteIssue()) {
            const message = t('app.status.clipboardReadFailed')
            lastStatusRef.current = message
            setEditorStatus(message)
          }
          return { ok, lastStatus: lastStatusRef.current }
        } catch {
          const message = t('app.status.clipboardReadFailed')
          lastStatusRef.current = message
          setEditorStatus(message)
          return { ok: false, lastStatus: message }
        }
      },
      probeParagraphLayout: () => {
        const root = document.querySelector('.qa-document-editor-shell .ProseMirror')
        if (!root) return []
        return Array.from(root.querySelectorAll(':scope > p')).map((paragraph, index) => {
          const rect = paragraph.getBoundingClientRect()
          const isBlank =
            paragraph.matches(':empty') ||
            Boolean(paragraph.querySelector('br.ProseMirror-trailingBreak:only-child'))
          return {
            index,
            text: paragraph.textContent ?? '',
            isBlank,
            top: rect.top,
            bottom: rect.bottom,
            right: rect.right,
            height: rect.height,
          }
        })
      },
      probePmSelection: () => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return null
        const sample = buildSelectionTimelineSample(editor, 'probe')
        if (!sample) return null
        const domSel = window.getSelection()
        const domRect = domSel?.rangeCount ? domSel.getRangeAt(0).getBoundingClientRect() : null
        const $from = editor.state.selection.$from
        const $to = editor.state.selection.$to
        const paragraphTextsInRange: string[] = []
        editor.state.doc.nodesBetween(sample.from, sample.to, (node, pos) => {
          if (node.type.name !== 'paragraph') return
          if (pos >= sample.from && pos < sample.to) paragraphTextsInRange.push(node.textContent)
        })
        return {
          from: sample.from,
          to: sample.to,
          empty: editor.state.selection.empty,
          selectedText: sample.selectedText,
          onlyNewline: sample.selectedText === '\n',
          includesEmptyParagraph: sample.includesEmptyParagraph,
          fromParentText: $from.parent.textContent,
          toParentText: $to.parent.textContent,
          fromParentIsBlank: sample.fromParentIsBlank,
          toParentIsBlank: sample.toParentIsBlank,
          spansMultipleParagraphs: sample.spansMultipleParagraphs,
          paragraphTextsInRange,
          emptyHighlighted: sample.emptyHighlighted,
          domRectTop: domRect?.top ?? null,
          domSelectedText: sample.domSelectedText,
        }
      },
      beginSelectionTimelineCapture: () => {
        activeSelectionTimeline?.cleanup()
        const editor = editorRef.current?.getEditor()
        if (!editor) return false
        const samples: SelectionTimelineSample[] = []
        const push = (source: string) => {
          const sample = buildSelectionTimelineSample(editor, source)
          if (sample) samples.push(sample)
        }
        push('init')
        const onSelectionChange = () => push('selectionchange')
        const onSelectionUpdate = () => push('selectionUpdate')
        const onDblClick = () => push('dblclick')
        document.addEventListener('selectionchange', onSelectionChange)
        editor.on('selectionUpdate', onSelectionUpdate)
        const pmRoot = editor.view.dom
        pmRoot.addEventListener('dblclick', onDblClick, true)
        let rafId = 0
        const rafLoop = () => {
          push('raf')
          rafId = requestAnimationFrame(rafLoop)
        }
        rafId = requestAnimationFrame(rafLoop)
        activeSelectionTimeline = {
          samples,
          cleanup: () => {
            document.removeEventListener('selectionchange', onSelectionChange)
            editor.off('selectionUpdate', onSelectionUpdate)
            pmRoot.removeEventListener('dblclick', onDblClick, true)
            cancelAnimationFrame(rafId)
          },
        }
        return true
      },
      endSelectionTimelineCapture: () => {
        const capture = activeSelectionTimeline
        if (!capture) return []
        capture.cleanup()
        activeSelectionTimeline = null
        return capture.samples
      },
      probeVisualLinesInParagraph: (paragraphIndex: number) => {
        const root = document.querySelector('.qa-document-editor-shell .ProseMirror')
        if (!root) return []
        const paragraph = root.querySelectorAll(':scope > p')[paragraphIndex] as HTMLElement | undefined
        if (!paragraph) return []
        return readVisualLinesInParagraph(paragraph)
      },
      probeCoordsAtVisualLineEnd: (paragraphIndex: number, lineIndex: number, yFraction = 0.5) => {
        const root = document.querySelector('.qa-document-editor-shell .ProseMirror')
        const paragraph = root?.querySelectorAll(':scope > p')[paragraphIndex] as HTMLElement | undefined
        const lines = paragraph ? readVisualLinesInParagraph(paragraph) : []
        const line = lines[lineIndex]
        if (!line) return null
        const x = line.right - 2
        const y = line.top + line.height * yFraction
        const editor = editorRef.current?.getEditor()
        const view = editor?.view
        if (!editor || !view) return null
        const hit = view.posAtCoords({ left: x, top: y })
        if (!hit) {
          return {
            x,
            y,
            posAtCoords: null,
            resolvedParentText: null,
            parentOffset: null,
            atParentEnd: false,
          }
        }
        const $pos = editor.state.doc.resolve(hit.pos)
        return {
          x,
          y,
          posAtCoords: hit.pos,
          resolvedParentText: $pos.parent.textContent,
          parentOffset: $pos.parentOffset,
          atParentEnd: $pos.parentOffset >= $pos.parent.content.size,
        }
      },
      probeCoordsAtParagraphEnd: (paragraphIndex: number, yFraction = 0.5) => {
        const editor = editorRef.current?.getEditor()
        const view = editor?.view
        const root = document.querySelector('.qa-document-editor-shell .ProseMirror')
        if (!editor || !view || !root) return null
        const paragraphs = Array.from(root.querySelectorAll(':scope > p'))
        const paragraph = paragraphs[paragraphIndex] as HTMLElement | undefined
        if (!paragraph) return null
        const rect = paragraph.getBoundingClientRect()
        const x = rect.right - 2
        const y = rect.top + rect.height * yFraction
        const hit = view.posAtCoords({ left: x, top: y })
        if (!hit) {
          return {
            x,
            y,
            posAtCoords: null,
            resolvedParentText: null,
            parentOffset: null,
            atParentEnd: false,
          }
        }
        const $pos = editor.state.doc.resolve(hit.pos)
        return {
          x,
          y,
          posAtCoords: hit.pos,
          resolvedParentText: $pos.parent.textContent,
          parentOffset: $pos.parentOffset,
          atParentEnd: $pos.parentOffset >= $pos.parent.content.size,
        }
      },
      probeReadingPolish: () => {
        const pm = document.querySelector('.qa-document-editor-shell .ProseMirror') as HTMLElement | null
        if (!pm) return null
        const pmStyle = getComputedStyle(pm)
        const heading =
          (pm.querySelector('.pm-heading-block--l2') as HTMLElement | null) ??
          (pm.querySelector('h2') as HTMLElement | null)
        const img = pm.querySelector('img:not(.pm-image-block-img)') as HTMLElement | null
        const hr = pm.querySelector('hr') as HTMLElement | null
        return {
          textRendering: pmStyle.textRendering,
          headingMarginTopPx: heading ? Number.parseFloat(getComputedStyle(heading).marginTop) : null,
          imgBoxShadow: img ? getComputedStyle(img).boxShadow : 'none',
          imgBorderRadius: img ? getComputedStyle(img).borderRadius : '0px',
          hrOpacity: hr ? getComputedStyle(hr).opacity : '1',
        }
      },
      probeEditorFocusChrome: () => {
        const main = document.querySelector('.qa-document-editor-chrome')
        const surface = document.querySelector('.qa-document-editor-chrome .editor-body-surface') as HTMLElement | null
        return {
          mainHasFocusedClass: main?.classList.contains('editor-body-focused') ?? false,
          surfaceBoxShadow: surface ? getComputedStyle(surface).boxShadow : 'none',
        }
      },
      focusEditor: () => {
        const pm = document.querySelector('.qa-document-editor-shell .ProseMirror') as HTMLElement | null
        pm?.focus()
      },
      blurEditor: () => {
        ;(document.activeElement as HTMLElement | null)?.blur()
      },
      moveCaretToParagraphEnd: (paragraphIndex: number) => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return false
        let pIndex = -1
        let pos: number | null = null
        editor.state.doc.descendants((node, nodePos) => {
          if (pos != null || node.type.name !== 'paragraph') return
          pIndex += 1
          if (pIndex === paragraphIndex) pos = nodePos + node.nodeSize - 1
        })
        if (pos == null) return false
        return editor.chain().focus().setTextSelection(pos).run()
      },
      probeSlashMenu: () => {
        const menu = document.querySelector('.qa-document-editor-shell .pm-slash-menu:not(.luna-wiki-suggest-menu)')
        if (!menu) return { open: false, query: '', itemLabels: [], activeIndex: -1 }
        const items = Array.from(menu.querySelectorAll('.pm-slash-item'))
        const activeIndex = items.findIndex((item) => item.classList.contains('active'))
        return {
          open: true,
          query: '',
          itemLabels: items.map((item) => item.textContent?.trim() ?? ''),
          activeIndex,
        }
      },
      probeWikiSuggestMenu: () => {
        const menu = document.querySelector('.qa-document-editor-shell .luna-wiki-suggest-menu')
        if (!menu) return { open: false, query: '', items: [], activeIndex: -1 }
        const items = Array.from(menu.querySelectorAll('.luna-wiki-suggest-item'))
        const activeIndex = items.findIndex((item) => item.classList.contains('active'))
        return {
          open: true,
          query: '',
          items: items.map((item) => ({
            title: item.querySelector('.luna-wiki-suggest-item__title')?.textContent?.trim() ?? '',
            hint: item.querySelector('.luna-wiki-suggest-item__hint')?.textContent?.trim() ?? '',
            selectable: !(item as HTMLButtonElement).disabled,
          })),
          activeIndex,
        }
      },
      clickFormatToolbarButton: (commandId: string) => {
        const button = document.querySelector(
          `.qa-document-editor-shell .editor-format-toolbar button[data-format-command="${commandId}"]`,
        ) as HTMLButtonElement | null
        if (!button) return false
        button.click()
        return true
      },
      setFormatToolbarEnabled: async (enabled: boolean) => {
        await setAppearanceSetting('editor.formatToolbarEnabled', enabled)
      },
      isFormatToolbarVisible: () =>
        document.querySelectorAll('.qa-document-editor-shell .editor-format-toolbar-shell').length > 0,
      probeSpellcheckChrome: () => {
        const read = (el: Element | null) =>
          el instanceof HTMLElement ? el.getAttribute('spellcheck') : null
        return {
          visualSpellcheck: read(
            document.querySelector('.qa-document-editor-shell .tiptap-editor-content'),
          ),
          codeBlockSpellcheck: read(
            document.querySelector('.qa-document-editor-shell .pm-code-block-cm .cm-content'),
          ),
          calloutSpellcheck: read(
            document.querySelector('.qa-document-editor-shell [data-luna-callout]'),
          ),
        }
      },
      setSpellcheckEnabled: async (enabled: boolean) => {
        await setAppearanceSetting('editor.spellcheckEnabled', enabled)
      },
      resetPasteDedupe: () => {
        resetPasteDedupeForTests()
      },
      getOutlineTitles: () => outlineHeadingsRef.current.map((heading) => heading.title),
      setPathContext: (rootDir: string, activePath: string) => {
        setQaRootDir(rootDir)
        setQaActivePath(activePath)
      },
      patchEmbeddedFixture: (relPath: string, nextMarkdown: string) => {
        qaVaultRef.current?.patchFixture(relPath, nextMarkdown)
      },
      probeWikiEmbedSurfaces: () =>
        Array.from(
          document.querySelectorAll('.qa-document-editor-shell .pm-wiki-embed-root'),
        ).map((root) => {
          const surface = root.querySelector('[data-wiki-embed-surface="1"]')
          return {
            collapsed: root.getAttribute('data-wiki-embed-collapsed') === '1',
            text: surface?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            loading: Boolean(root.querySelector('.pm-wiki-embed-status')),
          }
        }),
      clickWikiEmbedCollapse: (index = 0) => {
        const button = document.querySelectorAll(
          '.qa-document-editor-shell .pm-wiki-embed-collapse',
        )[index] as HTMLButtonElement | undefined
        if (!button) return false
        button.click()
        return true
      },
      probeDrawingBlocks: () => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return []
        const blocks: Array<{
          width: number
          height: number
          originX: number
          originY: number
          strokeCount: number
        }> = []
        editor.state.doc.descendants((node) => {
          if (node.type.name !== 'drawingBlock') return
          let strokeCount: number
          try {
            const parsed = JSON.parse(String(node.attrs.strokes ?? '[]')) as unknown
            strokeCount = Array.isArray(parsed) ? parsed.length : 0
          } catch {
            strokeCount = 0
          }
          blocks.push({
            width: Number(node.attrs.width ?? 640),
            height: Number(node.attrs.height ?? 360),
            originX: Number(node.attrs.originX ?? 0),
            originY: Number(node.attrs.originY ?? 0),
            strokeCount,
          })
        })
        return blocks
      },
      getLastEmbeddedLinkNav: () => lastEmbeddedLinkNavRef.current,
      getLastEmbeddedHashNav: () => lastEmbeddedHashNavRef.current,
      loadMarkdownTimed,
      getLastLoadTiming: () => lastLoadTimingRef.current,
      probeHtmlEmbeddedHealth: () => {
        const health = probeHtmlEmbeddedHealth()
        health.consoleErrorCount = consoleErrorsRef.current.length
        return health
      },
      pasteClipboardImage: async () => {
        const pm = document.querySelector('.qa-document-editor-shell .ProseMirror') as HTMLElement | null
        if (!pm) return false
        pm.focus()
        return document.execCommand('paste')
      },
      /** Menu / trusted-empty-clipboardData paste path (headless Mod+V does not fire native paste). */
      pasteImageFromNavigatorClipboard: async () =>
        pasteFromNavigatorClipboard({
          onPasteImage: qaPasteImage,
          visualEditorRef: editorRef,
          mainPaneMode: 'visual',
        }),
      probePasteCaretContext: () => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return null
        const $from = editor.state.selection.$from
        const parent = $from.parent
        const blockIndex = $from.index(0)
        const prevBlock = blockIndex > 0 ? editor.state.doc.child(blockIndex - 1) : null
        const prevBlockIsImageParagraph =
          prevBlock?.type.name === 'paragraph' &&
          prevBlock.content.content.some((node) => node.type.name === 'image')
        const caretInEmptyParagraphBelowImage =
          parent.type.name === 'paragraph' &&
          $from.parentOffset === 0 &&
          $from.nodeBefore == null &&
          prevBlockIsImageParagraph
        return {
          parentType: parent.type.name,
          parentOffset: $from.parentOffset,
          nodeBeforeType: $from.nodeBefore?.type.name ?? null,
          prevBlockIsImageParagraph,
          caretInEmptyParagraphBelowImage,
        }
      },
      probeCaretStructuralContext: () => {
        const editor = editorRef.current?.getEditor()
        const root = document.querySelector('.qa-document-editor-shell .ProseMirror')
        if (!editor || !root) return null
        return probeCaretStructuralContext(editor.state, root)
      },
      probeCaretDocBlock: () => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return null
        const $from = editor.state.selection.$from
        const docChildIndex = $from.index(0)
        const block = editor.state.doc.child(docChildIndex)
        return {
          docChildIndex,
          blockType: block.type.name,
          isEmptyParagraph:
            block.type.name === 'paragraph' &&
            (block.content.size === 0 ||
              (block.childCount === 1 && block.firstChild?.type.name === 'hardBreak')),
          blockText: block.textContent.slice(0, 80),
        }
      },
      probeDocBlockTypes: () => {
        const editor = editorRef.current?.getEditor()
        if (!editor) return []
        const types: string[] = []
        editor.state.doc.forEach((node) => {
          types.push(node.type.name)
        })
        return types
      },
      probeDocumentCaretDiagnostics: () => {
        const editor = editorRef.current?.getEditor()
        const pm = document.querySelector('.qa-document-editor-shell .ProseMirror') as HTMLElement | null
        const cmEditor = document.querySelector(
          '.qa-document-editor-shell .pm-code-block-cm .cm-editor',
        ) as HTMLElement | null
        const cmWrap = document.querySelector('.qa-document-editor-shell .pm-code-block-cm') as HTMLElement | null
        const cmCursor = document.querySelector(
          '.qa-document-editor-shell .pm-code-block-cm .cm-cursor',
        ) as HTMLElement | null
        const cmContent = document.querySelector(
          '.qa-document-editor-shell .pm-code-block-cm .cm-content',
        ) as HTMLElement | null
        const scrollHost = resolveDocumentEditorScrollHost()

        const staleCmFocusedChrome = Boolean(
          pm?.querySelector('.pm-code-block-cm .cm-editor.cm-focused:not(:focus-within)'),
        )

        const hostRect = scrollHost?.getBoundingClientRect()
        const wrapRect = cmWrap?.getBoundingClientRect()
        const codeBlockInView =
          Boolean(hostRect && wrapRect) &&
          wrapRect!.bottom > hostRect!.top &&
          wrapRect!.top < hostRect!.bottom

        const active = document.activeElement
        const activeElementSummary =
          active instanceof HTMLElement
            ? `${active.tagName.toLowerCase()}${active.className ? `.${active.className.split(/\s+/).slice(0, 2).join('.')}` : ''}`
            : String(active?.nodeName ?? 'none')

        let pmSelectionEmpty = true
        let pmSelectionOutsideCodeBlock = false
        try {
          const view = editor?.view
          if (view) {
            pmSelectionEmpty = view.state.selection.empty
            const { $from } = view.state.selection
            let inCodeBlock = false
            for (let depth = $from.depth; depth > 0; depth -= 1) {
              if ($from.node(depth).type.name === 'codeBlock') {
                inCodeBlock = true
                break
              }
            }
            pmSelectionOutsideCodeBlock = !inCodeBlock
          }
        } catch {
          pmSelectionEmpty = true
          pmSelectionOutsideCodeBlock = false
        }

        const pmCaretColor = pm ? getComputedStyle(pm).caretColor : ''

        return {
          cmFocusedClass: cmEditor?.classList.contains('cm-focused') ?? false,
          staleCmFocusedChrome,
          cmHasFocus: isCodeBlockCmFocused(),
          cmCursorCount: document.querySelectorAll('.qa-document-editor-shell .pm-code-block-cm .cm-cursor')
            .length,
          cmCursorVisibility: cmCursor ? getComputedStyle(cmCursor).visibility : null,
          cmContentCaretColor: cmContent ? getComputedStyle(cmContent).caretColor : '',
          pmCaretColor,
          pmCaretTransparent: pmCaretColor === 'transparent' || pmCaretColor === 'rgba(0, 0, 0, 0)',
          pmContentEditable: pm?.isContentEditable ?? false,
          pmHasFocus: pm?.contains(document.activeElement) ?? false,
          activeInCm: Boolean(
            document.activeElement instanceof HTMLElement &&
              document.activeElement.closest('.qa-document-editor-shell .pm-code-block-cm'),
          ),
          codeBlockInView,
          pmDomSuspended: isPmDomSuspendedForCodeBlockCm(pm),
          pmSoftLocked: editor ? isPmLockedForCodeBlockCm(editor) : false,
          activeElementSummary,
          pmSelectionEmpty,
          pmSelectionOutsideCodeBlock,
        }
      },
      scrollDocumentCodeBlockOffScreen: (blockIndex: number) => {
        const host = resolveDocumentEditorScrollHost()
        const wrap = resolveDocumentCodeBlockWrap(blockIndex)
        if (!host || !wrap) return false
        if (blockIndex === 0) {
          host.scrollTop = 0
        } else {
          host.scrollTop = host.scrollHeight
        }
        const hostRect = host.getBoundingClientRect()
        const wrapRect = wrap.getBoundingClientRect()
        return !(wrapRect.bottom > hostRect.top && wrapRect.top < hostRect.bottom)
      },
      countDocumentCodeBlocks: () =>
        document.querySelectorAll('.qa-document-editor-shell [data-luna-code-block-wrap]').length,
      clickBelowLastOrderedListItem: () => {
        const root = document.querySelector('.qa-document-editor-shell .ProseMirror') as HTMLElement | null
        if (!root) return false
        const items = root.querySelectorAll('ol.pm-editor-list li')
        const last = items.item(items.length - 1) as HTMLElement | null
        if (!last) return false
        const rect = last.getBoundingClientRect()
        const x = rect.left + 12
        const y = rect.bottom + 8
        const target = document.elementFromPoint(x, y) as HTMLElement | null
        if (!target) return false
        target.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        )
        target.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        )
        target.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        )
        return true
      },
    }

    return () => {
      delete window.__QA_DOCUMENT_EDITOR__
    }
  }, [loadMarkdown, loadMarkdownTimed, markdown, openManyDocuments, qaPasteImage, readMemorySnapshot, waitForLoadSettled, waitForMemorySettle])

  return (
    <div style={{ padding: 24, background: 'var(--surface-app)', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Document Editor QA</h1>
      <p data-testid="qa-locale">locale={locale}</p>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-editor-status">{editorStatus}</p>
      <div
        className={`main qa-document-editor-chrome${showEditorChromeFocused ? ' editor-body-focused' : ''}`}
        style={{ maxWidth: 1200, minHeight: 420, display: 'flex', flexDirection: 'row', gap: 16 }}
      >
        <aside
          data-testid="qa-outline-panel"
          className="document-outline-sidebar"
          style={{ width: 240, flexShrink: 0, paddingTop: 8 }}
        >
          <DocumentOutlineBlock
            documentPath={QA_DOC_PATH}
            headings={outlineHeadings}
            activeId=""
            onJump={() => {}}
          />
        </aside>
        <div
          className="editor-body-surface"
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
          onFocusCapture={() => setEditorChromeFocused(true)}
          onBlurCapture={(e) => {
            const next = e.relatedTarget as Node | null
            if (isEditorFormatMenuPortalNode(next)) return
            if (!e.currentTarget.contains(next)) setEditorChromeFocused(false)
          }}
        >
          <div
            className="preview-pane markdown-visual-editor qa-document-editor-shell"
            data-testid="qa-editor-scroll-host"
            style={{ height: 320, overflow: 'auto', minHeight: 0 }}
          >
            <EditorFormatToolbar
              t={t}
              commands={toolbarEditorFormat}
              onCommand={onFormatCommand}
              hasTextSelection={hasTextSelection}
              onTextColorPick={() => {}}
              isCommandActive={isFormatCommandActive}
              onMenuOpenChange={setFormatMenuOpen}
            />
            <TiptapMarkdownEditor
              ref={editorRef}
              documentKey={docKey}
              markdown={markdown}
              activePath={qaActivePath}
              rootDir={qaRootDir}
              sidebarListMode="outline"
              onMarkdownChange={onMarkdownChange}
              onActiveHeadingChange={() => {}}
              onSelectionActivity={() => setVisualSelectionTick((tick) => tick + 1)}
              onOutlineHeadingsChange={handleOutlineHeadingsChange}
              onStatus={(message) => {
                lastStatusRef.current = message
                setEditorStatus(message)
              }}
              onPasteImage={qaPasteImage}
              onEmbeddedHtmlLinkNavigate={onEmbeddedHtmlLinkNavigate}
              onEmbeddedHtmlHashNavigate={onEmbeddedHtmlHashNavigate}
              openReason={EditorOpenReason.ColdOpen}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function QaDocumentEditorPlayground() {
  const locale = resolveQaLocale()
  const [bootstrap, setBootstrap] = useState<I18nBootstrap | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const enMessages = getEnMessagesSnapshot()
      const rawLocale = locale === 'en' ? enMessages : await ensureLocaleRawLoaded(locale)
      if (cancelled) return
      setBootstrap({
        mergedMessages: locale === 'en' ? enMessages : { ...enMessages, ...rawLocale },
        enMessages,
        rawLocale,
        languageSetting: locale,
        effectiveLocale: locale,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [locale])

  if (!bootstrap) {
    return (
      <div style={{ padding: 24, minHeight: '100vh' }}>
        <p data-testid="qa-ready">Document Editor QA</p>
        <p data-testid="qa-status">booting</p>
      </div>
    )
  }

  return (
    <I18nProvider bootstrap={bootstrap}>
      <QaDocumentEditorInner locale={locale} />
    </I18nProvider>
  )
}
