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
import { Slice, type MarkType, type Node as PmNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { applyPlainTextInsertion } from './inputLayer/inputLayerPaste'
import {
  shouldShowCodeChromeForBlockType,
} from './blockEditingPolicy'
import { ensureMermaidBlockId } from './extensions/MermaidNode'
import {
  commitActiveMarkdownSourceReveal,
  getActiveMarkdownSourceReveal,
  startMarkdownBlockSourceReveal,
} from './lunaMarkdownSourceReveal'
import { deriveHierarchicalSelectionFromPm } from './modeSwitchHierarchical'
import { recordModeSwitchGoodAnchor } from './modeSwitchLastGoodAnchor'
import { switchMermaidActiveBlock } from './mermaid/mermaidSourceBlockSwitch'
import {
  getActiveMermaidBlockId,
  getMermaidBlockSession,
  getMermaidBlockTab,
  flushMermaidBlockSession,
  registerMermaidBlockSession,
  setActiveMermaidTab,
} from './mermaid/mermaidSourceStore'
import { focusTiptapProseMirrorSurface } from './tiptapEditorFocus'
import {
  freezeModeSwitchSnapshot,
  type FrozenModeSwitchHierarchical,
  type ModeSwitchSnapshot,
} from './modeSwitchSnapshot'
import { applyPmSelectionFromFrozenProjection } from './modeSwitchDocumentProjection'
import {
  logModeSwitchProjectionInspectLines,
  recordPostApplyInspection,
  recordPostViewportInspection,
  recordPreViewportInspection,
  startVisualRestoreInspection,
} from './modeSwitchProjectionInspector'
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
import { toggleCodeBlockWithFocusAndLog } from './lunaCodeBlock'
import { isCodeEditGuardActive } from './lunaCodeContext'
import { selectAllInCurrentBlock } from './lunaBlockSelectAll'
import { isSelectionInsideTableCell } from './lunaTableCell'
import { openLunaTableInsertPicker } from './lunaTableInsertPicker'
import { openLunaEmojiPicker } from './lunaEmojiPicker'
import {
  buildWikiLinkInsertText,
  computeSuggestMenuPosition,
  matchWikiLinkSuggestInText,
  searchWikiLinkSuggestCandidates,
  type WikiLinkSuggestItem,
  isWikiSuggestItemSelectable,
} from './lunaWikiLinkSuggest'
import { emitLunaSurface } from './lunaEditorSurfaceState'
import {
  isModifierHintMacLike,
  isOpenableExternalHref,
  openExternalUrlInSystemBrowser,
} from './openExternalLink'
import { resolveMarkdownMediaSrc, buildMediaSourceResolveOptions } from '../export/mediaSources'
import {
  makeModeBridgeId,
  type SourceModeEnterAnchor,
} from './viewportModeAnchor'
import { VIEWPORT_DOCUMENT_NODE_ID, viewportAnchorEngine } from './viewportAnchorEngine'
import { allocModeSwitchCaptureFrameId } from './modeSwitchFrameTransaction'
import {
  bridgeCaptureEditorSelection,
  bridgeRememberCurrentSelection,
  bridgeRestoreLastNonEmptySelection,
} from './editorMutationBridge'
import { applyProseMirrorCaretAnchorScroll } from './caretAnchorScroll'
import {
  MODE_SWITCH_POST_SELECTION_STABLE_FRAMES,
  PRE_FOCUS_STABLE_FRAMES,
  waitLayoutStabilizationBarrier,
} from './layoutStabilization'
import { getTabEditorSession } from '../app/document/tabEditorSessionStore'
import { type EditorOpenReason as EditorOpenReasonType } from './editorOpenReason'
import { useI18n } from '../i18n'
import { isCompatibilityTraceEnabled } from '../debug/compatibilityDebug'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import { isMermaidSourceFocused } from './mermaid/mermaidSourceDom'
import type { WikiLinkTarget } from './knowledgeRuntime/types'
import { unescapeWikiLinksInMarkdown } from './knowledgeRuntime/wikiLinkParser'
import { MermaidSourceSessionProvider } from './mermaid/MermaidSourceSession'
import { ensurePmInputUnlockedOnBoot } from './mermaid/mermaidSourceInputFocus'
import { flushMermaidSourceForDocumentSwitch, flushMermaidSourceForSerialize } from './mermaid/mermaidSourceBridge'
import { installMermaidClipboardCapture } from './mermaid/mermaidSourceClipboard'
import { validateASTBeforeCommit } from './astGuardrails'
import { resolveWikiLinkTargetAtPmPos } from './compiler/wikiInteractionMetadata'
import type { AssetMeta } from '../assets/workspaceAssetStore'
import {
  createAssetHtmlLink,
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
  destroyEphemeralSession,
  runEphemeralCommand,
  type EphemeralCommandType,
} from './ephemeralFormatting'
import { getLunaManifestCommandExecutor } from './lunaEphemeralFormatting'
import { normalizeTextColor } from './lunaTextColor'
import { resetTransactionLog } from '../menu/commandTransaction'
import { flushVmTiptapRecorderBatch } from '../vm/vmTiptapRecorder'
import { VM_SKIP_RECORD_META } from '../vm/vmStepLog'

const TI_FOCUS_NO_SCROLL = { scrollIntoView: false as const }

/** Switching back to WYSIWYG from source: selection payload applied with the document within a single PM `tr`*/
export type AtomicVisualDocumentEnter = {
  readonly documentKey: string
  readonly pmAnchor: number
  readonly pmHead: number
  /** Restore the scroll bar ratio when switching back to the label (corresponding to getProseMirrorScrollRatio)*/
  readonly scrollRatio?: number
  /** Precise frozen restore payload produced by source→visual mode switch. */
  readonly modeSwitchSnapshot?: ModeSwitchSnapshot | null
}

type VisualViewportRestoreResult = 'scroll_centered' | 'scroll_nearby' | 'scroll_skipped'

function restoreProseMirrorScrollRatio(editor: Editor, ratio: number | undefined): void {
  if (ratio == null || !Number.isFinite(ratio)) return
  if (editor.isDestroyed || !editor.view?.dom) return
  const dom = editor.view.dom as HTMLElement
  const maxScroll = dom.scrollHeight - dom.clientHeight
  if (maxScroll <= 0) return
  dom.scrollTop = Math.max(0, Math.min(1, ratio)) * maxScroll
}

function resolveVisualTabRestore(
  documentKey: string,
  boot: AtomicVisualDocumentEnter | null,
): AtomicVisualDocumentEnter | null {
  if (
    boot &&
    boot.documentKey === documentKey &&
    Number.isFinite(boot.pmAnchor) &&
    Number.isFinite(boot.pmHead)
  ) {
    return boot
  }
  const visual = getTabEditorSession(documentKey)?.visual
  if (!visual || !Number.isFinite(visual.pmAnchor) || !Number.isFinite(visual.pmHead)) {
    return null
  }
  return {
    documentKey,
    pmAnchor: visual.pmAnchor,
    pmHead: visual.pmHead,
    scrollRatio: visual.scrollRatio,
  }
}

function applyVisualTabViewportRestore(editor: Editor, restore: AtomicVisualDocumentEnter): void {
  if (editor.isDestroyed || !editor.view?.dom) return
  const max = editor.state.doc.content.size
  if (max < 1) return
  let restored = false
  const inspectCtx = restore.modeSwitchSnapshot
    ? startVisualRestoreInspection(editor.view, editor.schema, restore.modeSwitchSnapshot)
    : null
  if (restore.modeSwitchSnapshot) {
    const precise = applyPmSelectionFromFrozenProjection({
      view: editor.view,
      schema: editor.schema,
      snapshot: {
        documentIdentity: restore.modeSwitchSnapshot.documentIdentity,
        expectedPmAnchor: restore.modeSwitchSnapshot.expectedPmAnchor,
        expectedPmHead: restore.modeSwitchSnapshot.expectedPmHead,
      },
    })
    restored = precise.ok
    if (inspectCtx) {
      recordPostApplyInspection(inspectCtx, editor.view, precise)
    }
  }
  if (!restored) {
    const a = Math.max(1, Math.min(Math.round(restore.pmAnchor), max))
    const h = Math.max(1, Math.min(Math.round(restore.pmHead), max))
    try {
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, a, h)))
      if (inspectCtx) {
        recordPostApplyInspection(inspectCtx, editor.view, { ok: true })
      }
    } catch {
      return
    }
  }
  const head = editor.state.selection.head
  const dom = editor.view.dom as HTMLElement
  debugModeSwitch('[mode-switch][visual-pane][apply-selection]', {
    documentKey: restore.documentKey,
    captureFrameId: restore.modeSwitchSnapshot?.captureFrameId ?? null,
    selectionAfterApply: {
      anchor: editor.state.selection.anchor,
      head: editor.state.selection.head,
    },
    scrollBeforeViewport: describeScrollMetrics(dom),
    snapshot: summarizeSnapshot(restore.modeSwitchSnapshot),
  })
  const cancelled = () => editor.isDestroyed || !editor.view?.dom
  void (async () => {
    let viewportResult: VisualViewportRestoreResult = 'scroll_skipped'
    let centerReason: string | null = null
    try {
      const layoutStable = await waitLayoutStabilizationBarrier(
        MODE_SWITCH_POST_SELECTION_STABLE_FRAMES,
        cancelled,
      )
      if (!layoutStable || cancelled()) return
      const scrollContainer = revealScrollContainer(editor)
      if (inspectCtx) {
        recordPreViewportInspection(inspectCtx, editor.view)
      }
      const focusStable = await waitLayoutStabilizationBarrier(PRE_FOCUS_STABLE_FRAMES, cancelled)
      if (!focusStable || cancelled()) return
      editor.commands.focus(undefined, { scrollIntoView: false })
      let centered = applyProseMirrorCaretAnchorScroll({
        coordsAtPos: (pos) => editor.view.coordsAtPos(pos),
        scrollerEl: scrollContainer,
        calibrationEl: dom,
        headPos: head,
        anchorFraction: 0.5,
        includeWindowScroll: false,
      })
      if (centered.ok) {
        viewportResult = 'scroll_centered'
        centerReason = 'caret'
      } else if (restore.scrollRatio != null) {
        restoreProseMirrorScrollRatio(editor, restore.scrollRatio)
        viewportResult = 'scroll_nearby'
        centerReason = 'scroll_ratio'
        const retryStable = await waitLayoutStabilizationBarrier(1, cancelled)
        if (retryStable && !cancelled()) {
          centered = applyProseMirrorCaretAnchorScroll({
            coordsAtPos: (pos) => editor.view.coordsAtPos(pos),
            scrollerEl: scrollContainer,
            calibrationEl: dom,
            headPos: head,
            anchorFraction: 0.5,
            includeWindowScroll: false,
          })
          if (centered.ok) {
            viewportResult = 'scroll_centered'
            centerReason = 'caret_after_ratio'
          }
        }
      } else {
        centerReason = centered.reason
      }
    } catch {
      return
    } finally {
      if (cancelled()) return
      if (inspectCtx) {
        recordPostViewportInspection(inspectCtx, editor.view)
        logModeSwitchProjectionInspectLines(
          inspectCtx,
          `frame:${restore.modeSwitchSnapshot?.captureFrameId ?? 'none'}:${restore.documentKey}`,
        )
      }
      debugModeSwitch('[mode-switch][visual-pane][after-viewport]', {
        documentKey: restore.documentKey,
        captureFrameId: restore.modeSwitchSnapshot?.captureFrameId ?? null,
        appliedScrollRatio: restore.scrollRatio ?? null,
        viewportResult,
        centerReason,
        scrollAfterViewport: describeScrollMetrics(dom),
        selectionAfterViewport: {
          anchor: editor.state.selection.anchor,
          head: editor.state.selection.head,
        },
      })
    }
  })()
}

export type TiptapEditorCommand =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'headingLevelDelta'; delta: -1 | 1 }
  | { type: 'callout'; kind: 'note' | 'tip' | 'important' | 'warning' | 'caution' }
  | { type: 'insertParagraphAbove' }
  | { type: 'insertParagraphBelow' }
  | { type: 'blockMath' }
  | { type: 'copyCodeBlock' }
  | { type: 'indentCodeSelection' }
  | { type: 'indentCodeBlock' }
  | { type: 'paragraph' }
  | { type: 'bulletList' }
  | { type: 'orderedList' }
  | { type: 'taskList' }
  | { type: 'blockquote' }
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'inlineMath' }
  | { type: 'comment' }
  | { type: 'setTextColor'; color: string | null }
  | { type: 'link' }
  | { type: 'openLink' }
  | { type: 'copyLinkAddress' }
  | { type: 'image' }
  | { type: 'insertTablePicker' }
  | { type: 'openEmojiPicker' }
  | { type: 'codeBlock'; language?: string }
  | { type: 'selectAll' }
  | { type: 'deleteSelection' }
  | { type: 'clearFormatting' }
  | { type: 'insertText'; text: string }
  | { type: 'horizontalRule' }
  | { type: 'tocDirective' }
  | { type: 'linkReference' }
  | { type: 'footnoteRef'; label?: string }

/**⌘/ Capture result: successful payload, or no-op abort (no entering source code, no snapshot writing)*/
export type CaptureVisualToSourceResult =
  | {
      ok: true
      markdown: string
      anchor: SourceModeEnterAnchor
      resultKind: 'strict_success' | 'degraded_success'
    }
  | { ok: false; reason: 'no_editor' }
  | { ok: false; reason: 'document_mismatch' }

export type PendingMarkdownSyncResult =
  | { ok: true; markdown: string }
  | { ok: false; error: unknown }

function toPendingMarkdownSyncError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error)
  return new Error(`Visual editor markdown serialization failed: ${detail}`)
}

export type TiptapMarkdownEditorHandle = {
  /** Command parsing layer collection EditorContext / used to execute ephemeral*/
  getEditor: () => Editor | null
  /** The documentKey currently bound by PM (can be safely saved only when it is consistent with props.documentKey/⌘/)*/
  getBoundDocumentKey: () => string | null
  focus: () => void
  openSearchPanel: (options?: { replace?: boolean }) => boolean
  moveSearch: (direction: 1 | -1) => boolean
  replaceSearchNext: (replacement: string) => boolean
  /** Collapse selection before navigation without focus (responsible by IEM focusEditor tail)*/
  collapseSelectionForNavigation: () => void
  getMarkdown: () => string
  tryFlushPendingMarkdownSync: () => PendingMarkdownSyncResult
  /** Cancel anti-shake and synchronize PM→Markdown, call before saving/cutting tabs*/
  flushPendingMarkdownSync: () => string
  /** Normalize a markdown string using the editor schema for compare-only. */
  normalizeMarkdownForCompare: (markdown: string) => string | null
  /** Resolve after the IME combination input is completed and await before saving.*/
  waitForCompositionEnd: () => Promise<void>
  getActiveBlockType: () => string | null
  hasActiveLocalSourceIsland: () => boolean
  openSourceIslandForActiveBlock: () => boolean
  closeSourceIslandForActiveBlock: () => boolean
  getSelectedText: () => string
  getSelectedMarkdown: () => string
  deleteSelection: () => boolean
  replaceSelection: (text: string) => boolean
  runCommand: (command: TiptapEditorCommand) => boolean
  scrollToHeading: (id: string) => boolean
  revealNavigationAnchor: (request: {
    headingSlug?: string
    blockId?: string
    line?: number
  }) => Promise<boolean>
  /** ProseMirror root scrolling (consistent with .ProseMirror overflow-y)*/
  getProseMirrorScrollTop: () => number | null
  /** The ratio of the scroll bar position to the scrollable interval [0,1], used to align with containers of different heights such as CodeMirror*/
  getProseMirrorScrollRatio: () => number | null
  /** Disabled: History API, selections are handled by hierarchical mode switching pipeline*/
  applyMarkdownSelectionAndScroll: (cmAnchor: number, cmHead: number) => boolean
  /**
   * Command+/ Atomic capture: the same serialized string + Markdown selection offset + viewport anchor point to avoid inconsistency between two calls to getMarkdown and offsets.
   */
  captureVisualToSourceTransition: (documentKey: string) => CaptureVisualToSourceResult
  /** Navigation barrier: whether the PM is mounted and the anchor slug is positionable*/
  getNavigationHydrationStatus: (documentKey: string) => {
    editorMounted: boolean
    pmDocReady: boolean
    isHeadingSlugIndexed: (slug: string) => boolean
  }
}

type Props = {
  markdown: string
  documentKey: string
  activePath: string
  rootDir: string
  sidebarListMode: 'files' | 'outline'
  onMarkdownChange: (markdown: string) => void
  onActiveHeadingChange: (id: string) => void
  onStatus: (message: string) => void
  onPasteImage: (file: File, mimeHint: string) => Promise<string | null>
  onAssetFilesDrop?: (files: File[]) => Promise<AssetMeta[]>
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

function normalizeLinkHrefForExternalAction(rawHref: string): string | null {
  const trimmed = rawHref.trim()
  if (!trimmed) return null
  const withProtocol = /^www\./iu.test(trimmed) ? `https://${trimmed}` : trimmed
  const lowered = withProtocol.toLowerCase()
  if (
    lowered.startsWith('javascript:') ||
    lowered.startsWith('data:') ||
    lowered.startsWith('vbscript:')
  ) {
    return null
  }
  if (/^https?:\/\//iu.test(withProtocol) || /^mailto:/iu.test(withProtocol)) {
    return withProtocol
  }
  return null
}

function linkMarkRangeAt(doc: PmNode, pos: number, linkType: MarkType): { from: number; to: number } | null {
  const size = doc.content.size
  const p = Math.min(Math.max(pos, 1), size)
  const $pos = doc.resolve(p)
  const hasMark =
    linkType.isInSet($pos.marks()) || (p > 1 && linkType.isInSet(doc.resolve(p - 1).marks()))
  if (!hasMark) return null
  let from = p
  let to = p
  while (from > $pos.start()) {
    const prev = doc.resolve(from - 1)
    if (!linkType.isInSet(prev.marks())) break
    from -= 1
  }
  while (to < $pos.end()) {
    const next = doc.resolve(to)
    if (!linkType.isInSet(next.marks())) break
    to += 1
  }
  return { from, to }
}

function readSelectionLinkHref(editor: Editor): string | null {
  const attrs = editor.getAttributes('link') as { href?: unknown }
  if (editor.isActive('link') && typeof attrs.href === 'string' && attrs.href.trim()) {
    return attrs.href.trim()
  }
  const linkMark = editor.schema.marks.link
  if (!linkMark) return null
  const { from, to, empty } = editor.state.selection
  if (empty) {
    const at = editor.state.doc.resolve(from)
    const mark = linkMark.isInSet(at.marks()) || (from > 1 ? linkMark.isInSet(editor.state.doc.resolve(from - 1).marks()) : null)
    const href = String(mark?.attrs?.href ?? '').trim()
    return href || null
  }
  let hit: string | null = null
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (hit || !node.isText) return
    const mark = linkMark.isInSet(node.marks)
    if (!mark) return
    const href = String(mark.attrs?.href ?? '').trim()
    if (href) hit = href
  })
  return hit
}

function headingIdBeforeSelection(editor: Editor): string {
  return activeHeadingSlugBeforePos(editor.state.doc, editor.state.selection.from)
}

function findHeadingPosition(editor: Editor, id: string): number | null {
  return findHeadingPositionInDoc(editor.state.doc, id)
}

function waitAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function normalizeSerializedMarkdownForSource(markdown: string): string {
  return unescapeWikiLinksInMarkdown(markdown)
}

type TopLevelDocSummary = {
  childCount: number
  lastType: string | null
  lastIsVisuallyEmptyParagraph: boolean
}

function summarizeTopLevelDoc(doc: PmNode): TopLevelDocSummary {
  const last = doc.lastChild
  const lastIsVisuallyEmptyParagraph =
    last?.type.name === 'paragraph' &&
    (last.content.size === 0 ||
      (last.childCount === 1 && last.firstChild?.type.name === 'hardBreak'))
  return {
    childCount: doc.childCount,
    lastType: last?.type.name ?? null,
    lastIsVisuallyEmptyParagraph: Boolean(lastIsVisuallyEmptyParagraph),
  }
}

function detectProbableSyntheticTrailingParagraph(parsed: PmNode, rendered: PmNode): boolean {
  const parsedSummary = summarizeTopLevelDoc(parsed)
  const renderedSummary = summarizeTopLevelDoc(rendered)
  return (
    renderedSummary.childCount === parsedSummary.childCount + 1 &&
    parsedSummary.lastType !== 'paragraph' &&
    renderedSummary.lastIsVisuallyEmptyParagraph
  )
}

function formatTopLevelDocSummary(tag: string, summary: TopLevelDocSummary): string {
  return `${tag}{childCount=${summary.childCount},lastType=${summary.lastType ?? 'null'},lastEmpty=${summary.lastIsVisuallyEmptyParagraph ? 1 : 0}}`
}

function isVisualTailTraceEnabled(): boolean {
  return isCompatibilityTraceEnabled('visualTail', ['blankLine', 'dirty'])
}

function px(style: CSSStyleDeclaration, prop: string): number {
  const raw = style.getPropertyValue(prop)
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function describeElementForTailTrace(root: HTMLElement, el: HTMLElement | null): string {
  if (!el) return 'null'
  const style = window.getComputedStyle(el)
  const rootRect = root.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  const topInRoot = rect.top - rootRect.top + root.scrollTop
  const bottomInRoot = rect.bottom - rootRect.top + root.scrollTop
  return [
    `tag=${el.tagName.toLowerCase()}`,
    `cls=${JSON.stringify(el.className || '')}`,
    `h=${Math.round(rect.height)}`,
    `top=${Math.round(topInRoot)}`,
    `bottom=${Math.round(bottomInRoot)}`,
    `mb=${px(style, 'margin-bottom')}`,
    `mt=${px(style, 'margin-top')}`,
    `pb=${px(style, 'padding-bottom')}`,
    `pt=${px(style, 'padding-top')}`,
  ].join(' ')
}

function scheduleVisualTailTrace(editor: Editor, reason: string, documentKey: string): void {
  if (!isVisualTailTraceEnabled()) return
  const run = () => {
    if (editor.isDestroyed) return
    const root = editor.view.dom as HTMLElement | null
    if (!root) return
    const scrollRoot = revealScrollContainer(editor)
    const topChildren = Array.from(root.children) as HTMLElement[]
    const lastTop = topChildren[topChildren.length - 1] ?? null
    const lastWrapper =
      lastTop?.querySelector?.('[data-node-view-wrapper]') instanceof HTMLElement
        ? (lastTop.querySelector('[data-node-view-wrapper]') as HTMLElement)
        : null
    const lastCodePre =
      (lastWrapper ?? lastTop)?.querySelector?.('.pm-code-block-pre') instanceof HTMLElement
        ? ((lastWrapper ?? lastTop).querySelector('.pm-code-block-pre') as HTMLElement)
        : null
    const lastCodeContent =
      (lastWrapper ?? lastTop)?.querySelector?.('.pm-code-block-content') instanceof HTMLElement
        ? ((lastWrapper ?? lastTop).querySelector('.pm-code-block-content') as HTMLElement)
        : null
    const rootStyle = window.getComputedStyle(root)
    const scrollStyle = window.getComputedStyle(scrollRoot)
    const rootRect = root.getBoundingClientRect()
    const lastBottomInRoot = lastTop
      ? lastTop.getBoundingClientRect().bottom - rootRect.top + root.scrollTop
      : 0
    const visualGapAfterLastTop = Math.round(root.scrollHeight - lastBottomInRoot)
    console.debug(
      `[VISUAL_TAIL] reason=${reason} doc=${documentKey} rootChildren=${topChildren.length} rootPadBottom=${px(rootStyle, 'padding-bottom')} rootScrollPadBottom=${px(rootStyle, 'scroll-padding-bottom')} scrollPadBottom=${px(scrollStyle, 'scroll-padding-bottom')} rootScrollHeight=${root.scrollHeight} rootClientHeight=${root.clientHeight} visualGapAfterLastTop=${visualGapAfterLastTop} lastTop{${describeElementForTailTrace(root, lastTop)}} lastWrapper{${describeElementForTailTrace(root, lastWrapper)}} lastCodePre{${describeElementForTailTrace(root, lastCodePre)}} lastCodeContent{${describeElementForTailTrace(root, lastCodeContent)}}`,
    )
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

function scheduleVisualBlockGapTrace(editor: Editor, reason: string, documentKey: string): void {
  if (!isVisualTailTraceEnabled()) return
  const run = () => {
    if (editor.isDestroyed) return
    const root = editor.view.dom as HTMLElement | null
    if (!root) return
    const rootRect = root.getBoundingClientRect()
    const topChildren = Array.from(root.children) as HTMLElement[]
    const docChildren = Array.from({ length: editor.state.doc.childCount }, (_, i) => editor.state.doc.child(i))
    const count = Math.min(topChildren.length, docChildren.length)
    const rows: string[] = []
    let prevBottom = 0
    for (let i = 0; i < count; i += 1) {
      const el = topChildren[i]
      const node = docChildren[i]
      const rect = el.getBoundingClientRect()
      const top = rect.top - rootRect.top + root.scrollTop
      const bottom = rect.bottom - rootRect.top + root.scrollTop
      const gapFromPrev = i === 0 ? Math.round(top) : Math.round(top - prevBottom)
      prevBottom = bottom
      const style = window.getComputedStyle(el)
      const isEmptyParagraph =
        node.type.name === 'paragraph' &&
        (node.content.size === 0 ||
          (node.childCount === 1 && node.firstChild?.type.name === 'hardBreak'))
      if (isEmptyParagraph || gapFromPrev > 12) {
        rows.push(
          `#${i}:${node.type.name}${isEmptyParagraph ? ':empty' : ''}{gap=${gapFromPrev},h=${Math.round(rect.height)},mt=${px(style, 'margin-top')},mb=${px(style, 'margin-bottom')},cls=${JSON.stringify(el.className || '')}}`,
        )
      }
    }
    console.debug(
      `[VISUAL_BLOCK_GAPS] reason=${reason} doc=${documentKey} docChildren=${editor.state.doc.childCount} domChildren=${topChildren.length} suspicious=${rows.length} ${rows.join(' | ')}`,
    )
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

function revealScrollContainer(editor: Editor): HTMLElement {
  const root = editor.view.dom as HTMLElement
  let current: HTMLElement | null = root
  while (current) {
    const style = window.getComputedStyle(current)
    const overflowY = style.overflowY
    const canScrollY =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      current.scrollHeight > current.clientHeight + 1
    if (canScrollY) return current
    current = current.parentElement
  }
  return root
}

function centerRevealElementInContainer(container: HTMLElement, element: HTMLElement): number {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const deltaTop = elementRect.top - containerRect.top
  const desired =
    container.scrollTop + deltaTop - (container.clientHeight - Math.max(1, elementRect.height)) / 2
  const max = Math.max(0, container.scrollHeight - container.clientHeight)
  const nextTop = Math.max(0, Math.min(max, desired))
  container.scrollTo({ top: nextTop, behavior: 'auto' })
  return nextTop
}

function logRevealAnchorTrace(message: string, data: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  // #region agent log
  console.debug(message, data)
  // #endregion
}

function elementFromNodeDom(node: globalThis.Node | null): HTMLElement | null {
  if (!node) return null
  if (node instanceof HTMLElement) return node
  return node.parentElement
}

function findBlockRevealElement(editor: Editor, blockId: string): HTMLElement | null {
  const id = blockId.trim()
  if (!id) return null
  const dom = editor.view.dom as HTMLElement
  const escaped = CSS.escape(id)
  const byData = dom.querySelector(`[data-block-id="${escaped}"], [data-luna-block-id="${escaped}"]`)
  if (byData instanceof HTMLElement) return byData

  let found: HTMLElement | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found) return false
    const attrs = node.attrs as Record<string, unknown>
    if (attrs.blockId === id || attrs.id === id || attrs['data-block-id'] === id) {
      found = elementFromNodeDom(editor.view.nodeDOM(pos))
      return false
    }
    if (node.isTextblock && node.textContent.includes(`^${id}`)) {
      found = elementFromNodeDom(editor.view.nodeDOM(pos))
      return false
    }
    return true
  })
  return found
}

function findLineRevealElement(editor: Editor, line?: number): HTMLElement | null {
  if (!line || line < 1) return null
  let currentLine = 1
  let found: HTMLElement | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found) return false
    if (node.isTextblock) {
      if (currentLine >= line) {
        found = elementFromNodeDom(editor.view.nodeDOM(pos))
        return false
      }
      currentLine += Math.max(1, node.textContent.split('\n').length)
    }
    return true
  })
  return found
}

function findHeadingRevealElement(editor: Editor, headingSlug: string): { element: HTMLElement | null; pos: number | null } {
  const pos = findHeadingPosition(editor, headingSlug)
  if (pos == null) return { element: null, pos: null }
  return { element: elementFromNodeDom(editor.view.nodeDOM(pos)), pos }
}

function highlightRevealElement(element: HTMLElement): void {
  element.classList.add('navigation-reveal-highlight')
  window.setTimeout(() => {
    element.classList.remove('navigation-reveal-highlight')
  }, 1200)
}

function selectedText(editor: Editor): string {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, '\n')
}

function resolveActiveBlockSelectionTarget(editor: Editor): {
  blockType: string
  pos: number
  node: PmNode
} | null {
  const { selection } = editor.state
  if (selection instanceof NodeSelection) {
    return { blockType: selection.node.type.name, pos: selection.from, node: selection.node }
  }
  const depth = selection.$from.depth
  if (depth > 0) {
    return {
      blockType: selection.$from.node(depth).type.name,
      pos: selection.$from.before(depth),
      node: selection.$from.node(depth),
    }
  }
  const nodeAtSelection = editor.state.doc.nodeAt(selection.from)
  if (nodeAtSelection) {
    return { blockType: nodeAtSelection.type.name, pos: selection.from, node: nodeAtSelection }
  }
  return null
}

function openMermaidSourceForTarget(editor: Editor, target: {
  blockType: string
  pos: number
  node: PmNode
}): boolean {
  if (target.blockType !== 'mermaidBlock') return false
  const attrs = target.node.attrs as { blockId?: string | null; source?: string }
  const blockId = ensureMermaidBlockId(attrs)
  if (!String(attrs.blockId ?? '').trim()) {
    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, blockId }),
    )
  }
  registerMermaidBlockSession(blockId, target.pos, String(attrs.source ?? ''))
  setActiveMermaidTab(blockId, 'source')
  switchMermaidActiveBlock(editor, blockId, getActiveMermaidBlockId())
  return true
}

function closeActiveMermaidSource(editor: Editor): boolean {
  const activeBlockId = getActiveMermaidBlockId()
  if (!activeBlockId) return false
  if (!getMermaidBlockSession(activeBlockId)) return false
  if (getMermaidBlockTab(activeBlockId) !== 'source') return false
  flushMermaidBlockSession(editor, activeBlockId, 'explicit')
  setActiveMermaidTab(activeBlockId, 'preview')
  switchMermaidActiveBlock(editor, null, activeBlockId, 'explicit', { skipFlush: true })
  editor.commands.focus(null, TI_FOCUS_NO_SCROLL)
  return true
}

function hasActiveMermaidSource(): boolean {
  const activeBlockId = getActiveMermaidBlockId()
  if (!activeBlockId) return false
  if (!getMermaidBlockSession(activeBlockId)) return false
  return getMermaidBlockTab(activeBlockId) === 'source'
}

type SlashCommandLeaf = {
  id: string
  label: string
  aliases: string[]
  /** Use the command id of the manifest / Command VM; you must await when using the slash menu.*/
  manifestCommandId?: string
  run: (editor: Editor) => boolean
}

type SlashCommandItem =
  | SlashCommandLeaf
  | {
      id: string
      label: string
      aliases: string[]
      children: SlashCommandLeaf[]
    }

type SlashMenuRow = {
  id: string
  label: string
  depth: number
  executable: boolean
  manifestCommandId?: string
  run?: (editor: Editor) => boolean
}

type SlashMenuState = {
  from: number
  to: number
  query: string
  left: number
  top: number
  placement: 'above' | 'below'
  maxHeight?: number
  rows: SlashMenuRow[]
  activeIndex: number
}

/** When the menu is not open, complete detection is only performed when a `/` trigger may appear in the paragraph (mitigating recalculation of each key)*/
function shouldProbeSlashMenu(editor: Editor, menuOpen: boolean): boolean {
  if (menuOpen) return true
  if (editor.isDestroyed) return false
  const { selection } = editor.state
  if (!selection.empty) return false
  const { $from } = selection
  if ($from.parent.type.name !== 'paragraph') return false
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  return /(?:^|\s)\/(?:[a-zA-Z0-9\u4e00-\u9fa5-_]*)?$/u.test(textBefore)
}

function slashMenuFrameEquals(a: SlashMenuState, b: SlashMenuState): boolean {
  if (a.from !== b.from || a.to !== b.to || a.query !== b.query) return false
  if (a.placement !== b.placement) return false
  if (Math.round(a.left) !== Math.round(b.left) || Math.round(a.top) !== Math.round(b.top)) return false
  if (a.maxHeight !== b.maxHeight) return false
  if (a.rows.length !== b.rows.length) return false
  for (let i = 0; i < a.rows.length; i++) {
    if (a.rows[i].id !== b.rows[i].id) return false
  }
  return true
}

function isSlashCommandGroup(
  item: SlashCommandItem,
): item is Extract<SlashCommandItem, { children: SlashCommandLeaf[] }> {
  return 'children' in item && Array.isArray(item.children)
}

function slashCommandMatchesQuery(item: { label: string; aliases: string[] }, query: string): boolean {
  if (!query) return true
  const tokens = [item.label.toLowerCase(), ...item.aliases.map((alias) => alias.toLowerCase())]
  return tokens.some((token) => token.includes(query))
}

function buildSlashMenuRows(commands: readonly SlashCommandItem[], query: string): SlashMenuRow[] {
  const rows: SlashMenuRow[] = []
  for (const command of commands) {
    if (isSlashCommandGroup(command)) {
      const parentMatch = slashCommandMatchesQuery(command, query)
      const matchingChildren = command.children.filter((child) => slashCommandMatchesQuery(child, query))
      if (!parentMatch && !matchingChildren.length) continue
      rows.push({ id: command.id, label: command.label, depth: 0, executable: false })
      const children = query && !parentMatch ? matchingChildren : command.children
      for (const child of children) {
        rows.push({
          id: `${command.id}/${child.id}`,
          label: child.label,
          depth: 1,
          executable: true,
          manifestCommandId: child.manifestCommandId,
          run: child.run,
        })
      }
      continue
    }
    if (!slashCommandMatchesQuery(command, query)) continue
    rows.push({
      id: command.id,
      label: command.label,
      depth: 0,
      executable: true,
      manifestCommandId: command.manifestCommandId,
      run: command.run,
    })
  }
  return rows.slice(0, 20)
}

function firstExecutableSlashRowIndex(rows: readonly SlashMenuRow[]): number {
  const index = rows.findIndex((row) => row.executable)
  return index >= 0 ? index : 0
}

function stepExecutableSlashRowIndex(
  rows: readonly SlashMenuRow[],
  current: number,
  direction: 1 | -1,
): number {
  if (!rows.length) return 0
  let index = current
  for (let step = 0; step < rows.length; step += 1) {
    index = (index + direction + rows.length) % rows.length
    if (rows[index]?.executable) return index
  }
  return current
}

type WikiLinkMenuState = {
  replaceFrom: number
  replaceTo: number
  embed: boolean
  query: string
  left: number
  top: number
  placement: 'above' | 'below'
  maxHeight?: number
  items: WikiLinkSuggestItem[]
  activeIndex: number
}

const SLASH_MENU_ITEM_HEIGHT = 36
const SLASH_MENU_PADDING = 12
const SLASH_MENU_GAP = 2
const SLASH_MENU_MARGIN = 8
const SLASH_MENU_MIN_HEIGHT = 120

function estimateSlashMenuHeight(itemCount: number): number {
  if (itemCount <= 0) return SLASH_MENU_PADDING
  return SLASH_MENU_PADDING + itemCount * SLASH_MENU_ITEM_HEIGHT + (itemCount - 1) * SLASH_MENU_GAP
}

type CaretRect = Pick<DOMRect, 'left' | 'top' | 'bottom'>

function computeSlashMenuPosition(
  caretRect: CaretRect,
  shellRect: DOMRect,
  itemCount: number,
): Pick<SlashMenuState, 'left' | 'top' | 'placement' | 'maxHeight'> {
  const menuHeight = estimateSlashMenuHeight(itemCount)
  const spaceBelow = Math.max(0, shellRect.bottom - caretRect.bottom - SLASH_MENU_MARGIN)
  const spaceAbove = Math.max(0, caretRect.top - shellRect.top - SLASH_MENU_MARGIN)
  const left = Math.max(8, Math.min(caretRect.left - shellRect.left, shellRect.width - 240))

  const fitsBelow = spaceBelow >= menuHeight
  const fitsAbove = spaceAbove >= menuHeight

  if (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)) {
    return {
      left,
      top: caretRect.bottom - shellRect.top + SLASH_MENU_MARGIN,
      placement: 'below',
      maxHeight: fitsBelow ? undefined : Math.max(SLASH_MENU_MIN_HEIGHT, spaceBelow),
    }
  }

  const maxHeight = fitsAbove ? undefined : Math.max(SLASH_MENU_MIN_HEIGHT, spaceAbove)
  const visibleHeight = maxHeight ? Math.min(menuHeight, maxHeight) : menuHeight
  return {
    left,
    top: caretRect.top - shellRect.top - visibleHeight - SLASH_MENU_MARGIN,
    placement: 'above',
    maxHeight,
  }
}

const SLASH_FILE_LINK_ID = 'file-link'

function insertWikiLinkTrigger(editor: Editor): boolean {
  return editor.chain().focus(null, TI_FOCUS_NO_SCROLL).insertContent('[[').run()
}

/** Slash menu: execute directly on the current PM instance to avoid the manifest asynchronous path losing focus/bridge not being ready*/
function slashRunTiptap(
  id: string,
  label: string,
  aliases: string[],
  command: TiptapEditorCommand,
): SlashCommandLeaf {
  return {
    id,
    label,
    aliases,
    run: (editor) => runTiptapCommand(editor, command),
  }
}

function slashRunEphemeral(
  id: string,
  label: string,
  aliases: string[],
  mark: EphemeralCommandType,
): SlashCommandLeaf {
  return {
    id,
    label,
    aliases,
    run: (editor) => runEphemeralEditorCommand(editor, mark),
  }
}

function createSlashCommands(t: (key: string) => string): readonly SlashCommandItem[] {
  return [
    slashRunEphemeral('bold', t('editor.slash.bold'), ['bold', '粗体', '加粗'], 'bold'),
    slashRunEphemeral('italic', t('editor.slash.italic'), ['italic', '斜体'], 'italic'),
    slashRunTiptap('h1', t('editor.slash.h1'), ['h1', 'heading1', 'title', '标题1', '一级标题'], {
      type: 'heading',
      level: 1,
    }),
    slashRunTiptap('h2', t('editor.slash.h2'), ['h2', 'heading2', '标题2', '二级标题'], {
      type: 'heading',
      level: 2,
    }),
    slashRunTiptap('bullet', t('editor.slash.bullet'), ['list', 'ul', 'bullet', '无序列表'], {
      type: 'bulletList',
    }),
    slashRunTiptap('ordered', t('editor.slash.ordered'), ['ol', 'ordered', '有序列表'], {
      type: 'orderedList',
    }),
    slashRunTiptap('task', t('editor.slash.task'), ['task', 'todo', 'checkbox', '任务', '待办', '任务列表'], {
      type: 'taskList',
    }),
    slashRunTiptap(
      'code-block',
      t('editor.slash.codeBlock'),
      ['code', 'codeblock', 'fence', '代码', '代码块'],
      { type: 'codeBlock', language: 'text' },
    ),
    {
      id: 'table',
      label: t('editor.slash.table'),
      aliases: ['table', 'tbl', '表格'],
      run: (editor) => {
        const commands = editor.commands as typeof editor.commands & {
          insertTable?: (options: { rows: number; cols: number; withHeaderRow?: boolean }) => boolean
        }
        if (typeof commands.insertTable === 'function') {
          return commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        }
        openLunaTableInsertPicker(editor)
        return true
      },
    },
    {
      id: 'knowledge-base',
      label: t('editor.slash.knowledgeBase'),
      aliases: ['wiki', 'link', 'doc', '文档', '文档链接', '链接', '双链', 'wikilink', '知识库', 'knowledge', 'kb'],
      run: insertWikiLinkTrigger,
    },
    {
      id: SLASH_FILE_LINK_ID,
      label: t('editor.slash.fileLink'),
      aliases: ['file', 'asset', 'attach', 'attachment', '附件', '文件', '文件链接', 'filelink', 'luna-asset'],
      run: () => true,
    },
    slashRunTiptap('footnote', t('editor.slash.footnote'), ['footnote', 'fn', 'note', '脚注', '注脚'], {
      type: 'footnoteRef',
      label: '1',
    }),
    {
      id: 'mermaid',
      label: t('editor.slash.mermaid'),
      aliases: ['mermaid', 'mmd', '流程图', '图表'],
      run: (editor) =>
        editor
          .chain()
          .focus(null, TI_FOCUS_NO_SCROLL)
          .insertContent([
            {
              type: 'mermaidBlock',
              attrs: {
                source: 'graph TD\n  A[Start] --> B[End]',
              },
            },
            { type: 'paragraph' },
          ])
          .run(),
    },
    slashRunTiptap(
      'callout-tip',
      t('editor.slash.calloutTip'),
      ['tip', 'hint', '提醒', '提示', 'callout', '警告框'],
      { type: 'callout', kind: 'tip' },
    ),
    slashRunTiptap(
      'callout-caution',
      t('editor.slash.calloutCaution'),
      ['caution', 'attention', '注意', '警告框'],
      { type: 'callout', kind: 'caution' },
    ),
    slashRunTiptap(
      'callout-important',
      t('editor.slash.calloutImportant'),
      ['important', 'critical', '重要', '警告框'],
      { type: 'callout', kind: 'important' },
    ),
    slashRunTiptap(
      'emoji',
      t('editor.slash.emoji'),
      ['emoji', 'emoticon', 'symbol', '表情', '符号', 'emoji符号'],
      { type: 'openEmojiPicker' },
    ),
  ]
}

function buildSlashMenuState(editor: Editor, shell: HTMLElement, commands: readonly SlashCommandItem[]): SlashMenuState | null {
  const state = editor.state
  const { selection } = state
  if (!selection.empty) return null
  if (editor.view.composing || isCodeEditGuardActive(state) || isSelectionInsideTableCell(editor)) return null
  const { $from } = selection
  if ($from.parent.type.name !== 'paragraph') return null

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  const hit = /(?:^|\s)\/([a-zA-Z0-9\u4e00-\u9fa5-_]*)$/u.exec(textBefore)
  if (!hit) return null

  const query = (hit[1] ?? '').trim().toLowerCase()
  const startOffset = textBefore.length - hit[0].length + (hit[0].startsWith('/') ? 0 : 1)
  const from = $from.start() + startOffset
  const to = $from.pos
  const rows = buildSlashMenuRows(commands, query)

  if (!rows.length) return null

  const pos = Math.max(1, Math.min(to, state.doc.content.size))
  const caretRect = editor.view.coordsAtPos(pos)
  const shellRect = shell.getBoundingClientRect()
  const { left, top, placement, maxHeight } = computeSlashMenuPosition(caretRect, shellRect, rows.length)
  return {
    from,
    to,
    query,
    left,
    top,
    placement,
    maxHeight,
    rows,
    activeIndex: firstExecutableSlashRowIndex(rows),
  }
}

function buildWikiLinkMenuState(editor: Editor, shell: HTMLElement): WikiLinkMenuState | null {
  const state = editor.state
  const { selection } = state
  if (!selection.empty) return null
  if (editor.view.composing || isCodeEditGuardActive(state) || isSelectionInsideTableCell(editor)) return null
  const { $from } = selection
  if (!$from.parent.isTextblock) return null

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  const match = matchWikiLinkSuggestInText(textBefore, $from.start())
  if (!match) return null

  const items = searchWikiLinkSuggestCandidates(match.query, { limit: 8 })

  const pos = Math.max(1, Math.min(match.replaceTo, state.doc.content.size))
  const caretRect = editor.view.coordsAtPos(pos)
  const shellRect = shell.getBoundingClientRect()
  const { left, top, placement, maxHeight } = computeSuggestMenuPosition(caretRect, shellRect, items.length)
  return {
    replaceFrom: match.replaceFrom,
    replaceTo: match.replaceTo,
    embed: match.embed,
    query: match.query,
    left,
    top,
    placement,
    maxHeight,
    items,
    activeIndex: 0,
  }
}

function runEphemeralEditorCommand(editor: Editor, commandType: EphemeralCommandType): boolean {
  return runEphemeralCommand(editor, commandType, { focusNoScroll: true })
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

function runTiptapCommand(editor: Editor, command: TiptapEditorCommand): boolean {
  if (editor.isDestroyed) return false
  const findCurrentBlockRange = (): { from: number; to: number } | null => {
    const { $from } = editor.state.selection
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth)
      if (!node.isBlock) continue
      return { from: $from.before(depth), to: $from.after(depth) }
    }
    return null
  }
  const insertParagraphAroundCurrent = (position: 'above' | 'below'): boolean => {
    const block = findCurrentBlockRange()
    if (!block) return false
    const paragraph = editor.schema.nodes.paragraph
    if (!paragraph) return false
    const insertPos = position === 'above' ? block.from : block.to
    const tr = editor.state.tr.insert(insertPos, paragraph.create())
    tr.setSelection(TextSelection.create(tr.doc, insertPos + 1))
    tr.scrollIntoView()
    editor.view.dispatch(tr)
    return true
  }
  const findAncestorCodeBlock = (): { from: number; to: number; text: string } | null => {
    const { state } = editor
    const { $from } = state.selection
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth)
      if (node.type.name !== 'codeBlock') continue
      const from = $from.start(depth)
      const to = $from.end(depth)
      return { from, to, text: node.textContent ?? '' }
    }
    return null
  }
  const indentRange = (from: number, to: number): boolean => {
    if (to <= from) return false
    const text = editor.state.doc.textBetween(from, to, '\n', '\n')
    if (!text.length) return false
    const indented = text
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')
    editor.view.dispatch(editor.state.tr.insertText(indented, from, to))
    return true
  }
  const clearInlineFormatting = (): boolean => {
    destroyEphemeralSession(editor)
    let state = editor.state
    let { from, to, empty } = state.selection
    const restoredSelection = empty ? bridgeRestoreLastNonEmptySelection() : false
    if (restoredSelection) {
      state = editor.state
      ;({ from, to, empty } = state.selection)
    }
    if (import.meta.env.DEV) {
      console.debug('[clear-formatting][selection]', {
        restoredSelection,
        empty,
        from,
        to,
      })
    }
    const tr = state.tr
    const markNames = ['bold', 'italic', 'underline', 'strike', 'code', 'link', 'textColor'] as const
    if (empty) {
      tr.setStoredMarks([])
      editor.view.dispatch(tr)
      return true
    }
    for (const name of markNames) {
      const markType = state.schema.marks[name]
      if (!markType) continue
      tr.removeMark(from, to, markType)
    }
    tr.setStoredMarks([])
    editor.view.dispatch(tr.scrollIntoView())
    return true
  }
  if (isCodeEditGuardActive(editor.state)) {
    const allowedInCode =
      command.type === 'insertText' ||
      command.type === 'selectAll' ||
      command.type === 'codeBlock' ||
      command.type === 'deleteSelection' ||
      command.type === 'clearFormatting' ||
      command.type === 'copyCodeBlock' ||
      command.type === 'indentCodeSelection' ||
      command.type === 'indentCodeBlock' ||
      command.type === 'code'
    if (!allowedInCode) return false
  }
  if (editor.view.composing && command.type !== 'insertText' && command.type !== 'selectAll' && command.type !== 'deleteSelection' && command.type !== 'clearFormatting') {
    return false
  }
  const chain = editor.chain().focus(null, TI_FOCUS_NO_SCROLL)
  const activeHeadingLevel = (): number | null => {
    for (let level = 1; level <= 6; level += 1) {
      if (editor.isActive('heading', { level })) return level
    }
    return null
  }
  switch (command.type) {
    case 'heading':
      return chain.toggleHeading({ level: command.level }).run()
    case 'headingLevelDelta': {
      const level = activeHeadingLevel()
      if (level == null) return false
      const nextLevel = Math.max(1, Math.min(6, level + command.delta))
      if (nextLevel === level) return false
      return chain.setHeading({ level: nextLevel as 1 | 2 | 3 | 4 | 5 | 6 }).run()
    }
    case 'paragraph':
      return chain.setParagraph().run()
    case 'insertParagraphAbove':
      return insertParagraphAroundCurrent('above')
    case 'insertParagraphBelow':
      return insertParagraphAroundCurrent('below')
    case 'callout':
      return chain.insertContent([
        {
          type: 'callout',
          attrs: { kind: command.kind, collapsed: false },
          content: [{ type: 'paragraph' }],
        },
        { type: 'paragraph' },
      ]).run()
    case 'blockMath':
      return chain.insertContent([
        { type: 'blockMath', attrs: { latex: '' } },
        { type: 'paragraph' },
      ]).run()
    case 'copyCodeBlock': {
      const codeBlock = findAncestorCodeBlock()
      if (!codeBlock) return false
      void navigator.clipboard.writeText(codeBlock.text)
      return true
    }
    case 'indentCodeSelection': {
      const codeBlock = findAncestorCodeBlock()
      if (!codeBlock) return false
      const from = Math.max(editor.state.selection.from, codeBlock.from)
      const to = Math.min(editor.state.selection.to, codeBlock.to)
      if (from === to) return indentRange(codeBlock.from, codeBlock.to)
      return indentRange(from, to)
    }
    case 'indentCodeBlock': {
      const codeBlock = findAncestorCodeBlock()
      if (!codeBlock) return false
      return indentRange(codeBlock.from, codeBlock.to)
    }
    case 'bulletList':
      return chain.toggleBulletList().run()
    case 'orderedList':
      return chain.toggleOrderedList().run()
    case 'taskList':
      return chain.toggleTaskList().run()
    case 'blockquote':
      return chain.toggleBlockquote().run()
    case 'bold':
      return runEphemeralEditorCommand(editor, 'bold')
    case 'italic':
      return runEphemeralEditorCommand(editor, 'italic')
    case 'underline':
      return runEphemeralEditorCommand(editor, 'underline')
    case 'strike':
      return runEphemeralEditorCommand(editor, 'strike')
    case 'code':
      return runEphemeralEditorCommand(editor, 'code')
    case 'inlineMath': {
      const { from, to, empty } = editor.state.selection
      const latex = empty ? 'x' : editor.state.doc.textBetween(from, to, '\n', '\n')
      return chain.insertContent({ type: 'inlineMath', attrs: { latex } }).run()
    }
    case 'comment': {
      const { from, to, empty } = editor.state.selection
      const body = empty ? 'comment' : editor.state.doc.textBetween(from, to, '\n', '\n').trim() || 'comment'
      const nodeType = editor.schema.nodes.rawInline
      if (!nodeType) return false
      const node = nodeType.create({ source: 'html', content: `<!-- ${body} -->` })
      const tr = editor.state.tr.replaceWith(from, to, node)
      const after = from + node.nodeSize
      tr.setSelection(TextSelection.create(tr.doc, after))
      tr.scrollIntoView()
      editor.view.dispatch(tr)
      return true
    }
    case 'setTextColor': {
      const color = normalizeTextColor(command.color)
      if (!color) {
        return chain.extendMarkRange('textColor').unsetMark('textColor').run()
      }
      return chain.extendMarkRange('textColor').setMark('textColor', { color }).run()
    }
    case 'link': {
      const { from, to, empty } = editor.state.selection
      if (empty) {
        const title = 'title'
        const href = 'https://'
        const linkMark = editor.schema.marks.link
        if (!linkMark) return false
        const tr = editor.state.tr.insertText(title, from, to)
        tr.addMark(from, from + title.length, linkMark.create({ href }))
        tr.setSelection(TextSelection.create(tr.doc, from, from + title.length))
        tr.scrollIntoView()
        editor.view.dispatch(tr)
        return true
      }
      const text = selectedText(editor).trim()
      const href = validateASTBeforeCommit({ type: 'linkHref', href: text }).value
      if (editor.isActive('link')) {
        return chain.extendMarkRange('link').setLink({ href }).run()
      }
      return chain.setLink({ href }).run()
    }
    case 'openLink': {
      const href = normalizeLinkHrefForExternalAction(readSelectionLinkHref(editor) ?? '')
      if (!href) return false
      void openExternalUrlInSystemBrowser(href)
      return true
    }
    case 'copyLinkAddress': {
      const href = readSelectionLinkHref(editor)
      if (!href) return false
      void navigator.clipboard.writeText(href)
      return true
    }
    case 'linkReference': {
      const linkReferenceDef = editor.schema.nodes.linkReferenceDef
      if (!linkReferenceDef) return false
      const { $from } = editor.state.selection
      const insertPos = $from.after()
      const node = linkReferenceDef.create({ label: '', href: 'https://' })
      const tr = editor.state.tr.insert(insertPos, node)
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
      tr.scrollIntoView()
      editor.view.dispatch(tr)
      return true
    }
    case 'image':
      return chain.setImage({ src: './image.png' }).run()
    case 'codeBlock':
      return toggleCodeBlockWithFocusAndLog(editor, command.language || 'text')
    case 'insertTablePicker':
      openLunaTableInsertPicker(editor)
      return true
    case 'openEmojiPicker':
      openLunaEmojiPicker(editor)
      return true
    case 'selectAll':
      if (selectAllInCurrentBlock(editor)) return true
      return editor.commands.selectAll()
    case 'deleteSelection':
      return chain.deleteSelection().run()
    case 'clearFormatting':
      return clearInlineFormatting()
    case 'insertText':
      return chain.insertContent(command.text).run()
    case 'horizontalRule':
      return chain.setHorizontalRule().run()
    case 'tocDirective': {
      const commands = editor.commands as typeof editor.commands & { insertTocDirective?: () => boolean }
      if (typeof commands.insertTocDirective !== 'function') return false
      return commands.insertTocDirective()
    }
    case 'footnoteRef': {
      const label = (command.label ?? '1').trim() || '1'
      return chain.insertContent({ type: 'footnoteRef', attrs: { label } }).run()
    }
    default:
      return false
  }
}

/** For testing only: override menu/command -> AST semantic regression*/
export function runTiptapCommandForTest(editor: Editor, command: TiptapEditorCommand): boolean {
  return runTiptapCommand(editor, command)
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
      const openHint = isModifierHintMacLike() ? t('editor.linkOpenCmdClick') : t('editor.linkOpenCtrlClick')
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
    }, [clearLinkModifierHint, t])
    const activePathRef = useRef(activePath)
    const rootDirRef = useRef(rootDir)
    const onMarkdownChangeRef = useRef(onMarkdownChange)
    const onActiveHeadingChangeRef = useRef(onActiveHeadingChange)
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
    const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
    const [slashHoverIndex, setSlashHoverIndex] = useState(-1)
    const slashMenuRef = useRef<SlashMenuState | null>(null)
    slashMenuRef.current = slashMenu
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
    const slashCommands = useMemo(() => createSlashCommands(t), [t])

    useEffect(() => {
      onMarkdownChangeRef.current = onMarkdownChange
      onActiveHeadingChangeRef.current = onActiveHeadingChange
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
    }, [
      onMarkdownChange,
      onActiveHeadingChange,
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
    ])

    const getNoteAssetContext = useCallback(() => {
      const notePath = activePathRef.current
      const root = rootDirRef.current
      if (!root || !notePath || notePath.startsWith('luna:buf:')) return null
      return { root, notePath }
    }, [])

    const normalizeMarkdown = useCallback((value: string, editor: Editor) => {
      const doc = canonicalMarkdownSemantics.parse(value, editor.schema, { liftBlankLines: false })
      const ser = canonicalMarkdownSemantics.trySerialize(doc, editor.schema)
      return ser.ok ? ser.markdown : value
    }, [])

    const syncExternalMarkdownRefs = useCallback(
      (value: string, editor: Editor | null) => {
        lastExternalMarkdownRef.current = value
        if (!editor) {
          lastNormalizedExternalMarkdownRef.current = value
          return
        }
        try {
          lastNormalizedExternalMarkdownRef.current = normalizeMarkdown(value, editor)
        } catch {
          lastNormalizedExternalMarkdownRef.current = value
        }
      },
      [normalizeMarkdown],
    )

    const compileEditorMarkdownForSync = useCallback((editor: Editor): PendingMarkdownSyncResult => {
      flushMermaidSourceForSerialize(editor)
      const serialized = canonicalMarkdownSemantics.trySerialize(editor.state.doc, editor.schema)
      if (serialized.ok === false) {
        return { ok: false, error: serialized.error }
      }
      return {
        ok: true,
        markdown: normalizeSerializedMarkdownForSource(serialized.markdown),
      }
    }, [])

    const runMarkdownSerialize = useCallback(
      (editor: Editor) => {
        if (suppressMarkdownSyncRef?.current) return
        const serialized = compileEditorMarkdownForSync(editor)
        if (serialized.ok === false) {
          onStatusRef.current?.(
            tRef.current('editor.status.serializeError', {
              detail:
                serialized.error instanceof Error ? serialized.error.message : String(serialized.error),
            }),
          )
          return
        }
        const next = serialized.markdown
        const previousNormalized = lastNormalizedExternalMarkdownRef.current
        if (next === previousNormalized) {
          return
        }
        lastExternalMarkdownRef.current = next
        lastNormalizedExternalMarkdownRef.current = next
        onMarkdownChangeRef.current(next)
      },
      [compileEditorMarkdownForSync, suppressMarkdownSyncRef],
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

    const scheduleMarkdownSync = useCallback(
      (editor: Editor, delay = MARKDOWN_SYNC_DEBOUNCE_MS) => {
        if (suppressMarkdownSyncRef?.current) return
        if (composingRef.current || editor.view.composing) return
        if (
          serializeIdleCallbackRef.current != null &&
          typeof cancelIdleCallback === 'function'
        ) {
          cancelIdleCallback(serializeIdleCallbackRef.current)
          serializeIdleCallbackRef.current = null
        }
        if (serializeTimerRef.current != null) window.clearTimeout(serializeTimerRef.current)
        serializeTimerRef.current = window.setTimeout(() => {
          serializeTimerRef.current = null
          if (suppressMarkdownSyncRef?.current) return
          if (composingRef.current || editor.view.composing) return
          const run = () => {
            serializeIdleCallbackRef.current = null
            if (editor.isDestroyed) return
            if (editorInstanceRef.current !== editor) return
            runMarkdownSerialize(editor)
          }
          if (typeof requestIdleCallback === 'function') {
            serializeIdleCallbackRef.current = requestIdleCallback(run, { timeout: 500 })
          } else {
            run()
          }
        }, delay)
      },
      [runMarkdownSerialize, suppressMarkdownSyncRef],
    )

    const refreshSlashMenu = useCallback((editor: Editor) => {
      const shell = shellRef.current
      if (!shell) {
        setSlashMenu(null)
        return
      }
      const next = buildSlashMenuState(editor, shell, slashCommands)
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
    }, [slashCommands])

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
      const next = buildWikiLinkMenuState(editor, shell)
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
      [runMarkdownSerialize, scheduleMarkdownSync, suppressMarkdownSyncRef],
    )

    const applyWikiLinkSuggestAt = useCallback((index: number): boolean => {
      const session = wikiLinkMenuRef.current
      const editor = resolveLiveTiptapEditor(editorHookRef.current, editorInstanceRef)
      if (!session || !editor) return false
      const item = session.items[index]
      if (!item || !isWikiSuggestItemSelectable(item)) return false
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
    }, [runMarkdownSerialize, scheduleMarkdownSync])

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
        }).concat(EditorLocalSearchExtension),
      [getNoteAssetContext, pasteImageForExtensions],
    )

    const editor = useEditor({
      extensions: visualEditorExtensions,
      content: '',
      editorProps: {
        attributes: {
          class: 'tiptap-editor-content',
          spellcheck: 'false',
        },
        handleKeyDown: (_view, event) => {
          if (wikiLinkMenuRef.current) {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setWikiLinkMenu((prev) => {
                if (!prev) return null
                return { ...prev, activeIndex: (prev.activeIndex + 1) % prev.items.length }
              })
              return true
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setWikiLinkMenu((prev) => {
                if (!prev) return null
                return {
                  ...prev,
                  activeIndex: (prev.activeIndex - 1 + prev.items.length) % prev.items.length,
                }
              })
              return true
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault()
              const item = wikiLinkMenuRef.current.items[wikiLinkMenuRef.current.activeIndex]
              if (!item || !isWikiSuggestItemSelectable(item)) return true
              return applyWikiLinkSuggestAt(wikiLinkMenuRef.current.activeIndex)
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setWikiLinkMenu(null)
              return true
            }
          }
          if (slashMenuRef.current) {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSlashHoverIndex(-1)
              setSlashMenu((prev) => {
                if (!prev) return null
                const activeIndex = stepExecutableSlashRowIndex(prev.rows, prev.activeIndex, 1)
                if (prev.activeIndex === activeIndex) return prev
                return { ...prev, activeIndex }
              })
              return true
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSlashHoverIndex(-1)
              setSlashMenu((prev) => {
                if (!prev) return null
                const activeIndex = stepExecutableSlashRowIndex(prev.rows, prev.activeIndex, -1)
                if (prev.activeIndex === activeIndex) return prev
                return { ...prev, activeIndex }
              })
              return true
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault()
              const session = slashMenuRef.current
              const pickIndex =
                slashHoverIndex >= 0 && slashHoverIndex < session.rows.length
                  ? slashHoverIndex
                  : session.activeIndex
              const row = session.rows[pickIndex]
              if (!row?.executable || !row.run) return true
              bridgeCaptureEditorSelection()
              void applySlashCommandAt(pickIndex).catch((err) => {
                if (import.meta.env.DEV) console.warn('[slash-menu] apply failed', err)
              })
              return true
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setSlashMenu(null)
              return true
            }
          }
          const isFind = (event.metaKey || event.ctrlKey) &&
            !event.altKey &&
            !event.shiftKey &&
            event.key.toLowerCase() === 'f'
          if (isFind) {
            event.preventDefault()
            setSearchOpen(true)
            return true
          }
          if (event.key === 'Escape' && searchOpenRef.current) {
            event.preventDefault()
            setSearchOpen(false)
            const activeEditor = editorInstanceRef.current
            if (activeEditor) clearTiptapSearch(activeEditor)
            bumpSearchVersion()
            return true
          }
          return isMermaidSourceFocused()
        },
        handleDOMEvents: {
          compositionstart: () => {
            composingRef.current = true
            emitLunaSurface({ type: 'SET_COMPOSING', composing: true })
            return false
          },
          compositionupdate: () => {
            composingRef.current = true
            return false
          },
          compositionend: (view) => {
            composingRef.current = false
            emitLunaSurface({ type: 'SET_COMPOSING', composing: false })
            const activeEditor = editorInstanceRef.current
            if (activeEditor && activeEditor.view === view) scheduleMarkdownSync(activeEditor, 0)
            return false
          },
          drop: (_view, event) => {
            const files = Array.from(event.dataTransfer?.files ?? [])
            const handler = onAssetFilesDropRef.current
            if (!files.length || !handler || !editor) return false
            event.preventDefault()
            event.stopPropagation()
            void (async () => {
              const assets = await handler(files)
              if (!assets.length) return
              const html = assets.map(createAssetHtmlLink).join('<br>')
              editor.chain().focus(null, TI_FOCUS_NO_SCROLL).insertContent(html).run()
              scheduleMarkdownSync(editor, 0)
            })()
            return true
          },
          mousedown: (_view, event) => {
            const anchor = (event.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null
            if (!anchor || !shellRef.current?.contains(anchor)) return false
            if (!(event.metaKey || event.ctrlKey)) return false
            const href = anchor.getAttribute('href') || ''
            if (!isOpenableExternalHref(href) && !isLunaAssetHref(href)) return false
            event.preventDefault()
            return true
          },
          mousemove: (view, event) => {
            const t = event.target as HTMLElement | null
            const anchor = t?.closest('a[href]') as HTMLAnchorElement | null
            const shell = shellRef.current
            pointerLinkRef.current = anchor && shell?.contains(anchor) ? anchor : null
            const href = pointerLinkRef.current?.getAttribute('href') || ''
            if (pointerLinkRef.current && isLunaAssetHref(href)) {
              const tooltip = getLunaAssetTooltipRef.current?.(href)
              if (tooltip) pointerLinkRef.current.title = tooltip
            }
            const mod =
              event.getModifierState('Meta') ||
              event.getModifierState('Control') ||
              event.metaKey ||
              event.ctrlKey
            updateLinkModifierHint(pointerLinkRef.current, mod)
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            if (coords != null) {
              const hit = resolveWikiLinkTargetAtPmPos(view.state.doc, coords.pos, {
                rootDir: rootDirRef.current,
                activePath: activePathRef.current,
              })
              onWikiLinkHoverRef.current?.(
                hit?.target ?? null,
                { x: event.clientX, y: event.clientY },
              )
            } else {
              onWikiLinkHoverRef.current?.(null, { x: event.clientX, y: event.clientY })
            }
            return false
          },
          mouseleave: (_view, event) => {
            pointerLinkRef.current = null
            clearLinkModifierHint()
            onWikiLinkHoverRef.current?.(null, { x: event.clientX, y: event.clientY })
            return false
          },
          click: (view, event) => {
            const mod = event.metaKey || event.ctrlKey
            const coordsEarly = view.posAtCoords({ left: event.clientX, top: event.clientY })
            if (coordsEarly != null) {
              const wikiHit = resolveWikiLinkTargetAtPmPos(view.state.doc, coordsEarly.pos, {
                rootDir: rootDirRef.current,
                activePath: activePathRef.current,
              })
              if (wikiHit && onWikiLinkNavigateRef.current && mod) {
                event.preventDefault()
                event.stopPropagation()
                onWikiLinkNavigateRef.current(wikiHit.target)
                return true
              }
            }

            const target = event.target as HTMLElement | null
            const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
            const shell = shellRef.current
            if (!anchor || !shell?.contains(anchor)) {
              return false
            }

            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            const linkType = view.state.schema.marks.link
            if (!coords || !linkType) {
              return false
            }
            const doc = view.state.doc
            const c = doc.content.size
            const p = Math.min(Math.max(coords.pos, 1), c)
            const $p = doc.resolve(p)
            const inLink =
              linkType.isInSet($p.marks()) || (p > 1 && linkType.isInSet(doc.resolve(p - 1).marks()))
            if (!inLink) {
              return false
            }

            const href = anchor.getAttribute('href') || ''
            /** click is triggered after the mouseup/PM selection is updated; it must be intercepted, otherwise the webview will follow the `<a href>` default navigation*/
            event.preventDefault()

            if (isLunaAssetHref(href)) {
              if (event.metaKey || event.ctrlKey) {
                onLunaAssetLinkClickRef.current?.(href, event)
              }
              return true
            }

            if (mod && isOpenableExternalHref(href)) {
              void openExternalUrlInSystemBrowser(href).catch((e) => {
                onStatusRef.current?.(
                  tRef.current('editor.status.linkOpenFailed', {
                    message: e instanceof Error ? e.message : String(e),
                  }),
                )
              })
              return true
            }

            const range = linkMarkRangeAt(doc, p, linkType)
            if (range) {
              view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, range.from, range.to)))
            }
            return true
          },
        },
      },
      onCreate: ({ editor }) => {
        editorInstanceRef.current = editor
        didAtomicVisualBootstrapRef.current = false
        const boot = atomicVisualDocumentEnterRef.current
        const tabRestore = resolveVisualTabRestore(documentKey, boot)
        const usedAtomicProp =
          boot != null &&
          tabRestore != null &&
          boot.documentKey === documentKey &&
          tabRestore.pmAnchor === boot.pmAnchor &&
          tabRestore.pmHead === boot.pmHead
        const md = markdown
        const newDoc = canonicalMarkdownSemantics.parse(md, editor.schema)
        const oldSize = editor.state.doc.content.size
        let tr = editor.state.tr.replace(0, oldSize, new Slice(newDoc.content, 0, 0))
        tr = tr.setMeta(VM_SKIP_RECORD_META, true)

        if (tabRestore) {
          const max = tr.doc.content.size
          if (max >= 1) {
            const a = Math.max(1, Math.min(Math.round(tabRestore.pmAnchor), max))
            const h = Math.max(1, Math.min(Math.round(tabRestore.pmHead), max))
            try {
              tr = tr.setSelection(TextSelection.create(tr.doc, a, h))
            } catch {
              /*Documentation only*/
            }
          }
          if (usedAtomicProp) onAtomicVisualDocumentEnterConsumedRef.current?.()
          didAtomicVisualBootstrapRef.current = true
        } else if (tr.doc.content.size >= 1) {
          try {
            tr = tr.setSelection(TextSelection.create(tr.doc, 1))
          } catch {
            /* ignore */
          }
        }

        queueMicrotask(() => {
          if (editor.isDestroyed || !editor.view?.dom) return
          editor.view.dispatch(tr)
          if (tabRestore) {
            applyVisualTabViewportRestore(editor, tabRestore)
          }
          const s = editor.state.selection
          syncExternalMarkdownRefs(md, editor)
          lastDocumentKeyRef.current = documentKey
          flushVmTiptapRecorderBatch(documentKey)
          resetTransactionLog(documentKey)
          if (import.meta.env.DEV) {
            const b = atomicVisualDocumentEnterRef.current
            const parsedDocSummary = summarizeTopLevelDoc(newDoc)
            const renderedDocSummary = summarizeTopLevelDoc(editor.state.doc)
            const probableSyntheticTrailingParagraph = detectProbableSyntheticTrailingParagraph(
              newDoc,
              editor.state.doc,
            )

            console.debug('[PM_ON_CREATE]', {
              openReason: openReasonRef.current,
              hasAtomic: Boolean(
                b && b.documentKey === documentKey && Number.isFinite(b.pmAnchor) && Number.isFinite(b.pmHead),
              ),
              documentKey,
              markdownLength: markdown.length,
              selection: tabRestore
                ? { anchor: tabRestore.pmAnchor, head: tabRestore.pmHead }
                : null,
              pmFrom: s.from,
              pmTo: s.to,
              parsedDocSummary,
              renderedDocSummary,
              probableSyntheticTrailingParagraph,
            })
            console.debug(
              `[PM_ON_CREATE_SUMMARY] doc=${documentKey} mdLen=${markdown.length} synthetic=${probableSyntheticTrailingParagraph ? 1 : 0} ${formatTopLevelDocSummary('parsed=', parsedDocSummary)} ${formatTopLevelDocSummary('rendered=', renderedDocSummary)}`,
            )
          }
          scheduleVisualTailTrace(editor, 'on-create', documentKey)
          scheduleVisualBlockGapTrace(editor, 'on-create', documentKey)
          scheduleRefreshSlashMenu(editor)
          refreshWikiLinkMenu(editor)
          onOutlineHeadingsChangeRef.current?.(parseHeadingsFromPmDoc(editor.state.doc))
        })
      },
      onUpdate: ({ editor, transaction }) => {
        scheduleRefreshSlashMenu(editor)
        refreshWikiLinkMenu(editor)
        if (transaction.docChanged) {
          scheduleOutlineHeadingsSync(editor)
        }
        if (composingRef.current || editor.view.composing) return
        scheduleMarkdownSync(editor)
      },
      onSelectionUpdate: ({ editor }) => {
        scheduleRefreshSlashMenu(editor)
        refreshWikiLinkMenu(editor)
        bridgeRememberCurrentSelection()
        const $from = editor.state.selection.$from
        const parent = $from.parent
        const blockType = parent.type.name
        emitLunaSurface({
          type: 'SET_CODE_CHROME',
          active: shouldShowCodeChromeForBlockType(blockType),
        })
        emitLunaSurface({ type: 'SET_ACTIVE_BLOCK', nodeName: blockType })
        if (sidebarListMode !== 'outline') return
        onActiveHeadingChangeRef.current(headingIdBeforeSelection(editor))
      },
    }, [
      applySlashCommandAt,
      applyWikiLinkSuggestAt,
      scheduleRefreshSlashMenu,
      refreshWikiLinkMenu,
      scheduleMarkdownSync,
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
      //It is prohibited to use props.markdown to overwrite PM during local transactions such as slash/save (otherwise the menu click "no response")
      if (suppressMarkdownSyncRef?.current) return
      //When Source -> Visual mode is switched, onCreate has written doc + selection atomically in the same mount cycle.
      //If you setContent again here, the newly restored selection will be reset to the beginning of the document.
      if (didAtomicVisualBootstrapRef.current) {
        syncExternalMarkdownRefs(markdown, editor)
        lastDocumentKeyRef.current = documentKey
        didAtomicVisualBootstrapRef.current = false
        return
      }
        const serialized = canonicalMarkdownSemantics.trySerialize(editor.state.doc, editor.schema)
      const serializedNormalized = serialized.ok
        ? normalizeSerializedMarkdownForSource(serialized.markdown)
        : null
      if (
        serialized.ok &&
        serializedNormalized === markdown &&
        lastDocumentKeyRef.current === documentKey
      ) {
        syncExternalMarkdownRefs(markdown, editor)
        return
      }
      const documentChanged = lastDocumentKeyRef.current !== documentKey
      const boot = atomicVisualDocumentEnterRef.current
      const tabRestore = documentChanged ? resolveVisualTabRestore(documentKey, boot) : null
      const usedAtomicProp =
        boot != null &&
        tabRestore != null &&
        boot.documentKey === documentKey &&
        tabRestore.pmAnchor === boot.pmAnchor &&
        tabRestore.pmHead === boot.pmHead
      if (documentChanged) {
        flushMermaidSourceForDocumentSwitch(editor)
      }
      if (!documentChanged && markdown === lastExternalMarkdownRef.current) return
      if (composingRef.current || editor.view.composing) return
      pointerLinkRef.current = null
      clearLinkModifierHint()
      const doc = canonicalMarkdownSemantics.parse(markdown, editor.schema)
      editor.commands['setContent'](doc, { emitUpdate: false })
      syncExternalMarkdownRefs(markdown, editor)
      lastDocumentKeyRef.current = documentKey
      if (import.meta.env.DEV) {
        const parsedDocSummary = summarizeTopLevelDoc(doc)
        const renderedDocSummary = summarizeTopLevelDoc(editor.state.doc)
        const probableSyntheticTrailingParagraph = detectProbableSyntheticTrailingParagraph(
          doc,
          editor.state.doc,
        )
        console.debug('[PM_SET_CONTENT]', {
          documentKey,
          markdownLength: markdown.length,
          parsedDocSummary,
          renderedDocSummary,
          probableSyntheticTrailingParagraph,
        })
        console.debug(
          `[PM_SET_CONTENT_SUMMARY] doc=${documentKey} mdLen=${markdown.length} synthetic=${probableSyntheticTrailingParagraph ? 1 : 0} ${formatTopLevelDocSummary('parsed=', parsedDocSummary)} ${formatTopLevelDocSummary('rendered=', renderedDocSummary)}`,
        )
      }
      scheduleVisualTailTrace(editor, 'set-content', documentKey)
      scheduleVisualBlockGapTrace(editor, 'set-content', documentKey)
      if (documentChanged) {
        flushVmTiptapRecorderBatch(documentKey)
        resetTransactionLog(documentKey)
      }
      if (tabRestore) {
        applyVisualTabViewportRestore(editor, tabRestore)
        if (usedAtomicProp) onAtomicVisualDocumentEnterConsumedRef.current?.()
        didAtomicVisualBootstrapRef.current = true
      }
      onOutlineHeadingsChangeRef.current?.(parseHeadingsFromPmDoc(editor.state.doc))
    }, [documentKey, editor, markdown, clearLinkModifierHint])

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
        getEditor() {
          return editor ?? editorInstanceRef.current
        },
        getBoundDocumentKey() {
          return lastDocumentKeyRef.current || null
        },
        focus() {
          if (editor) focusTiptapProseMirrorSurface(editor)
        },
        openSearchPanel(options?: { replace?: boolean }) {
          if (!editor) return false
          setSearchMode(options?.replace ? 'replace' : 'find')
          setSearchOpen(true)
          bumpSearchVersion()
          return true
        },
        moveSearch(direction: 1 | -1) {
          if (!editor) return false
          if (!searchOpenRef.current) setSearchOpen(true)
          moveTiptapSearch(editor, direction)
          bumpSearchVersion()
          return true
        },
        replaceSearchNext(replacement: string) {
          if (!editor) return false
          if (!searchOpenRef.current) {
            setSearchMode('replace')
            setSearchOpen(true)
          }
          const ok = replaceNextTiptapMatch(editor, replacement)
          bumpSearchVersion()
          return ok
        },
        collapseSelectionForNavigation() {
          if (!editor) return
          const pos = editor.state.selection.from
          const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos))
          editor.view.dispatch(tr)
        },
        getMarkdown() {
          if (!editor) return markdown
          const serialized = compileEditorMarkdownForSync(editor)
          return serialized.ok ? serialized.markdown : lastExternalMarkdownRef.current
        },
        tryFlushPendingMarkdownSync() {
          if (!editor) return { ok: true, markdown }
          if (serializeTimerRef.current != null) {
            window.clearTimeout(serializeTimerRef.current)
            serializeTimerRef.current = null
          }
          if (
            serializeIdleCallbackRef.current != null &&
            typeof cancelIdleCallback === 'function'
          ) {
            cancelIdleCallback(serializeIdleCallbackRef.current)
            serializeIdleCallbackRef.current = null
          }
          if (suppressMarkdownSyncRef?.current) {
            return { ok: true, markdown: lastExternalMarkdownRef.current }
          }
          const serialized = compileEditorMarkdownForSync(editor)
          if (serialized.ok === false) {
            return serialized
          }
          const next = serialized.markdown
          if (next !== lastExternalMarkdownRef.current) {
            lastExternalMarkdownRef.current = next
            lastNormalizedExternalMarkdownRef.current = next
            onMarkdownChangeRef.current(next)
          }
          return { ok: true, markdown: next }
        },
        flushPendingMarkdownSync() {
          if (!editor) return markdown
          if (serializeTimerRef.current != null) {
            window.clearTimeout(serializeTimerRef.current)
            serializeTimerRef.current = null
          }
          if (
            serializeIdleCallbackRef.current != null &&
            typeof cancelIdleCallback === 'function'
          ) {
            cancelIdleCallback(serializeIdleCallbackRef.current)
            serializeIdleCallbackRef.current = null
          }
          if (suppressMarkdownSyncRef?.current) {
            return lastExternalMarkdownRef.current
          }
          const result = compileEditorMarkdownForSync(editor)
          if (result.ok === false) {
            throw toPendingMarkdownSyncError(result.error)
          }
          if (result.markdown !== lastExternalMarkdownRef.current) {
            lastExternalMarkdownRef.current = result.markdown
            lastNormalizedExternalMarkdownRef.current = result.markdown
            onMarkdownChangeRef.current(result.markdown)
          }
          return result.markdown
        },
        normalizeMarkdownForCompare(input: string) {
          if (!editor) return null
          try {
            return normalizeMarkdown(input, editor)
          } catch {
            return null
          }
        },
        waitForCompositionEnd() {
          if (!editor || (!composingRef.current && !editor.view.composing)) {
            return Promise.resolve()
          }
          return new Promise<void>((resolve) => {
            const view = editor.view
            let settled = false
            const finish = () => {
              if (settled) return
              settled = true
              view.dom.removeEventListener('compositionend', finish)
              window.clearTimeout(timerId)
              resolve()
            }
            view.dom.addEventListener('compositionend', finish, { once: true })
            const timerId = window.setTimeout(finish, 3000)
          })
        },
        getActiveBlockType() {
          if (!editor) return null
          return resolveActiveBlockSelectionTarget(editor)?.blockType ?? null
        },
        hasActiveLocalSourceIsland() {
          if (!editor) return false
          return Boolean(getActiveMarkdownSourceReveal(editor.view)) || hasActiveMermaidSource()
        },
        openSourceIslandForActiveBlock() {
          if (!editor) return false
          const target = resolveActiveBlockSelectionTarget(editor)
          if (!target) return false
          if (openMermaidSourceForTarget(editor, target)) return true
          return startMarkdownBlockSourceReveal(editor.view, { pos: target.pos })
        },
        closeSourceIslandForActiveBlock() {
          if (!editor) return false
          if (commitActiveMarkdownSourceReveal(editor.view)) return true
          return closeActiveMermaidSource(editor)
        },
        captureVisualToSourceTransition(documentKey: string): CaptureVisualToSourceResult {
          if (!editor) return { ok: false, reason: 'no_editor' }
          if (lastDocumentKeyRef.current !== documentKey) {
            return { ok: false, reason: 'document_mismatch' }
          }
          const view = editor.view
          const schema = editor.schema
          const doc = view.state.doc
          const markdownBefore = markdown
          //At the moment of switching, the current PM document serialization result must be used first to avoid relying on the old markdown after anti-shake.
          //Causes "the source code selection is restored to the beginning".
          flushMermaidSourceForSerialize(editor)
          const serializedNow = canonicalMarkdownSemantics.trySerialize(doc, schema)
          const identityMarkdown = serializedNow.ok
            ? normalizeSerializedMarkdownForSource(serializedNow.markdown)
            : markdownBefore
          const captureFrameId = allocModeSwitchCaptureFrameId()
          let modeSwitchSnapshot: ModeSwitchSnapshot
          let preFreezeHierarchical: FrozenModeSwitchHierarchical | null = null
          try {
            preFreezeHierarchical = {
              bufferHash: '',
              anchor: deriveHierarchicalSelectionFromPm(doc, editor.state.selection.anchor),
              head: deriveHierarchicalSelectionFromPm(doc, editor.state.selection.head),
            }
            modeSwitchSnapshot = freezeModeSwitchSnapshot({
              captureFrameId,
              documentKey,
              hierarchical: preFreezeHierarchical,
              doc,
              schema,
              sourceMode: 'visual',
              identityMarkdown,
            })
          } catch (err) {
            reportModeSwitchFreezeFailure(err, { documentKey, phase: 'visualToSource' })
            if (import.meta.env.DEV) {
              assertNoPartialModeSwitchMutation({
                markdownBefore,
                markdownAfter: markdown,
                pmDocUnchanged: doc.eq(view.state.doc),
              })
            }
            const len = identityMarkdown.length
            const cmAnchor = Math.max(0, Math.min(len, editor.state.selection.anchor - 1))
            const cmHead = Math.max(0, Math.min(len, editor.state.selection.head - 1))
            const anchor: SourceModeEnterAnchor = {
              documentKey,
              bufferLength: len,
              bridgeId: makeModeBridgeId(documentKey, cmAnchor, cmHead),
              cmAnchor,
              cmHead,
              captureFrameId,
              hierarchical: preFreezeHierarchical ?? undefined,
              resultKind: 'degraded_success',
            }
            if (import.meta.env.DEV) {
               
              console.warn('[mode-switch] freeze fallback to raw selection offsets', {
                documentKey,
                captureFrameId,
                cmAnchor,
                cmHead,
                reason: isModeSwitchFreezeError(err) ? err.detail.reason : String(err),
              })
            }
            return { ok: true, markdown: identityMarkdown, anchor, resultKind: 'degraded_success' }
          }
          const cmAnchor = modeSwitchSnapshot.selection.anchor
          const cmHead = modeSwitchSnapshot.selection.head
          const canonicalBuffer = modeSwitchSnapshot.canonicalBuffer
          const anchor: SourceModeEnterAnchor = {
            documentKey,
            bufferLength: canonicalBuffer.length,
            bridgeId: makeModeBridgeId(documentKey, cmAnchor, cmHead),
            cmAnchor,
            cmHead,
            captureFrameId,
            hierarchical: modeSwitchSnapshot.hierarchical ?? preFreezeHierarchical,
            modeSwitchSnapshot,
            resultKind: 'strict_success',
          }
          if (import.meta.env.DEV) {
            debugModeSwitch('[mode-switch][visual->source][captured]', {
              frame: captureFrameId,
              documentKey,
              bridgeId: anchor.bridgeId,
              pmSelection: {
                anchor: editor.state.selection.anchor,
                head: editor.state.selection.head,
              },
              cmSelection: describeSelectionInText(canonicalBuffer, cmAnchor, cmHead),
              visualScroll: describeScrollMetrics(editor.view.dom as HTMLElement),
              snapshot: summarizeSnapshot(modeSwitchSnapshot),
            })
          }
          recordModeSwitchGoodAnchor(documentKey, modeSwitchSnapshot.expectedPmHead, cmHead)
          //Switching to source code must use a canonicalBuffer with the same origin as the frozen snapshot.
          return { ok: true, markdown: canonicalBuffer, anchor, resultKind: 'strict_success' }
        },
        getSelectedText() {
          if (!editor) return ''
          return selectedText(editor)
        },
        getSelectedMarkdown() {
          if (!editor) return ''
          const { from, to } = editor.state.selection
          return canonicalMarkdownSemantics.serializeRange(editor.state.doc, editor.schema, from, to)
        },
        deleteSelection() {
          if (!editor) return false
          return editor.chain().focus(null, TI_FOCUS_NO_SCROLL).deleteSelection().run()
        },
        replaceSelection(text: string) {
          if (!editor) return false
          const tr = applyPlainTextInsertion(editor.state, text, 'paste')
          editor.view.dispatch(tr)
          editor.commands.focus(null, TI_FOCUS_NO_SCROLL)
          return true
        },
        runCommand(command: TiptapEditorCommand) {
          if (!editor) return false
          const ok = runTiptapCommand(editor, command)
          if (!ok) onStatusRef.current?.(tRef.current('editor.status.visualOpUnsupported'))
          return ok
        },
        scrollToHeading(id: string) {
          if (!editor) return false
          const { element, pos } = findHeadingRevealElement(editor, id)
          if (element == null || pos == null) return false
          const scrollContainer = revealScrollContainer(editor)
          const pmPos = Math.min(pos + 1, editor.state.doc.content.size)
          editor.view.dispatch(
            editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pmPos)),
          )
          focusTiptapProseMirrorSurface(editor)
          void (async () => {
            await waitAnimationFrame()
            await waitAnimationFrame()
            const scrollTopBefore = scrollContainer.scrollTop
            const centeredScrollTop = centerRevealElementInContainer(scrollContainer, element)
            if (Math.abs(centeredScrollTop - scrollTopBefore) < 1) {
              element.scrollIntoView({ block: 'center', behavior: 'auto' })
            }
            highlightRevealElement(element)
          })()
          return true
        },
        async revealNavigationAnchor(request) {
          if (!editor) return false
          const scrollContainer = revealScrollContainer(editor)
          const selector = request.blockId
            ? `[data-block-id="${CSS.escape(request.blockId)}"]`
            : request.headingSlug
              ? `heading:${request.headingSlug}`
              : request.line
                ? `line:${request.line}`
                : 'document'
          logRevealAnchorTrace('[reveal-anchor-query]', {
            heading: request.headingSlug ?? null,
            blockId: request.blockId ?? null,
            selector,
            found: false,
            scrollTopBefore: scrollContainer.scrollTop,
            scrollTopAfter: scrollContainer.scrollTop,
          })

          const headingResult = request.headingSlug
            ? findHeadingRevealElement(editor, request.headingSlug)
            : { element: null, pos: null }
          const element =
            request.blockId
              ? findBlockRevealElement(editor, request.blockId)
              : headingResult.element ?? findLineRevealElement(editor, request.line)
          const found = Boolean(element)
          logRevealAnchorTrace('[reveal-anchor-found]', {
            heading: request.headingSlug ?? null,
            blockId: request.blockId ?? null,
            selector,
            found,
            scrollTopBefore: scrollContainer.scrollTop,
            scrollTopAfter: scrollContainer.scrollTop,
          })
          if (!element) return false

          const selectionPos =
            headingResult.pos != null
              ? Math.min(headingResult.pos + 1, editor.state.doc.content.size)
              : (() => {
                  try {
                    const domPos = editor.view.posAtDOM(element, 0)
                    return Math.max(1, Math.min(domPos, editor.state.doc.content.size))
                  } catch {
                    return null
                  }
                })()
          if (selectionPos != null) {
            const tr = editor.state.tr
              .setSelection(TextSelection.create(editor.state.doc, selectionPos))
              .scrollIntoView()
            editor.view.dispatch(tr)
          }
          focusTiptapProseMirrorSurface(editor)
          const scrollTopBefore = scrollContainer.scrollTop
          const centeredScrollTop = centerRevealElementInContainer(scrollContainer, element)
          if (Math.abs(centeredScrollTop - scrollTopBefore) < 1) {
            element.scrollIntoView({
              block: 'center',
              behavior: 'auto',
            })
          }
          await waitAnimationFrame()
          await waitAnimationFrame()
          const scrollTopAfter = scrollContainer.scrollTop
          logRevealAnchorTrace('[reveal-anchor-scroll]', {
            heading: request.headingSlug ?? null,
            blockId: request.blockId ?? null,
            selector,
            found,
            scrollTopBefore,
            scrollTopAfter,
          })

          highlightRevealElement(element)
          logRevealAnchorTrace('[reveal-anchor-highlight]', {
            heading: request.headingSlug ?? null,
            blockId: request.blockId ?? null,
            selector,
            found,
            scrollTopBefore,
            scrollTopAfter: scrollContainer.scrollTop,
          })
          return true
        },
        getProseMirrorScrollTop() {
          if (!editor) return null
          const dom = editor.view.dom as HTMLElement
          return Number.isFinite(dom.scrollTop) ? dom.scrollTop : null
        },
        getProseMirrorScrollRatio(): number | null {
          if (!editor) return null
          const dom = editor.view.dom as HTMLElement
          const max = dom.scrollHeight - dom.clientHeight
          if (!Number.isFinite(max) || max <= 0) return 0
          const top = dom.scrollTop
          if (!Number.isFinite(top)) return null
          return Math.max(0, Math.min(1, top / max))
        },
        applyMarkdownSelectionAndScroll(_cmAnchor: number, _cmHead: number) {
          if (import.meta.env.DEV) {
             
            console.warn('[TiptapMarkdownEditor] applyMarkdownSelectionAndScroll is disabled (hierarchical-only)')
          }
          return false
        },
        getNavigationHydrationStatus(documentKey: string) {
          if (!editor) {
            return {
              editorMounted: false,
              pmDocReady: false,
              isHeadingSlugIndexed: () => false,
            }
          }
          const pmDocReady =
            lastDocumentKeyRef.current === documentKey && editor.state.doc.content.size > 0
          return {
            editorMounted: true,
            pmDocReady,
            isHeadingSlugIndexed: (slug: string) =>
              pmDocReady && findHeadingPositionInDoc(editor.state.doc, slug) != null,
          }
        },
      }),
      [editor, markdown, documentKey],
    )

    const searchSnapshot = useMemo(() => getTiptapSearchSnapshot(editor), [editor, searchVersion])

    return (
      <MermaidSourceSessionProvider editor={editor}>
        <div className="tiptap-editor-shell" ref={shellRef}>
          <EditorContent editor={editor} />
          {searchOpen && editor ? (
            <EditorSearchOverlay
              mode={searchMode}
              query={searchSnapshot.query}
              replaceText={searchReplaceText}
              activeIndex={searchSnapshot.activeIndex}
              matchCount={searchSnapshot.matches.length}
              findPlaceholder={tRef.current('editor.search.findPlaceholder')}
              replacePlaceholder={tRef.current('editor.search.replacePlaceholder')}
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
          {wikiLinkMenu && (
            <div
              className={`editor-slash-menu-host pm-slash-menu luna-wiki-suggest-menu${
                wikiLinkMenu.placement === 'above' ? ' pm-slash-menu--above' : ''
              }`}
              style={{
                left: wikiLinkMenu.left,
                top: wikiLinkMenu.top,
                ...(wikiLinkMenu.maxHeight
                  ? { maxHeight: wikiLinkMenu.maxHeight, overflowY: 'auto' as const }
                  : {}),
              }}
              role="listbox"
              aria-label={t('editor.wikiSuggest.aria')}
            >
              {wikiLinkMenu.items.map((item, idx) => {
                const active = idx === wikiLinkMenu.activeIndex
                const selectable = isWikiSuggestItemSelectable(item)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={!selectable}
                    className={`pm-slash-item luna-wiki-suggest-item${active ? ' active' : ''}${
                      !selectable ? ' luna-wiki-suggest-item--disabled' : ''
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      if (!selectable) return
                      void applyWikiLinkSuggestAt(idx)
                    }}
                  >
                    <span className="luna-wiki-suggest-item__title">{item.title}</span>
                    <span className="luna-wiki-suggest-item__hint">{item.hint}</span>
                  </button>
                )
              })}
            </div>
          )}
          {slashMenu && (
            <div
              className={`editor-slash-menu-host pm-slash-menu${
                slashMenu.placement === 'above' ? ' pm-slash-menu--above' : ''
              }`}
              style={{
                left: slashMenu.left,
                top: slashMenu.top,
                ...(slashMenu.maxHeight ? { maxHeight: slashMenu.maxHeight, overflowY: 'auto' as const } : {}),
              }}
              role="listbox"
              aria-label={t('editor.slash.aria')}
              onMouseLeave={() => setSlashHoverIndex(-1)}
            >
              {slashMenu.rows.map((row, idx) => {
                const active = idx === slashMenu.activeIndex || idx === slashHoverIndex
                const nested = row.depth > 0
                const groupHeader = !row.executable
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={groupHeader}
                    className={`pm-slash-item${
                      nested ? ' pm-slash-item--nested' : ''
                    }${groupHeader ? ' pm-slash-item--group' : ''}${active ? ' active' : ''}`}
                    onMouseDown={(e) => {
                      if (groupHeader || !row.run) return
                      e.preventDefault()
                      bridgeCaptureEditorSelection()
                      void applySlashCommandAt(idx).catch((err) => {
                        if (import.meta.env.DEV) console.warn('[slash-menu] apply failed', err)
                      })
                    }}
                    onMouseEnter={() => {
                      if (groupHeader) return
                      setSlashHoverIndex((prev) => (prev === idx ? prev : idx))
                    }}
                  >
                    {row.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </MermaidSourceSessionProvider>
    )
  },
)

TiptapMarkdownEditor.displayName = 'TiptapMarkdownEditor'
