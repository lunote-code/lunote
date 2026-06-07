import type { EditorView } from '@codemirror/view'

import {
  isModeSwitchFreezeError,
  reportModeSwitchFreezeFailure,
} from './modeSwitchFreezeFailure'
import type { ModeSwitchAnchorPayload, ModeSwitchFsmSemanticPatch } from './modeSwitchFSM'
import { setSourceModeIdentity } from './sourceModeIdentity'
import { freezeReturningToVisualSnapshot } from './modeSwitchSnapshot'
import { buildFrozenStructuralIR } from './modeSwitchStructuralIR'
import {
  deriveHierarchicalFromCmSelection,
  pmHierarchicalCoreToSemanticAnchor,
  semanticAnchorToPm,
  type ModeSelectionSpan,
} from './modeSwitchSemanticProjection'
import { modeSwitchPlainTextFingerprint } from './modeSwitchFingerprint'
import { debugModeSwitch, describeSelectionInText, summarizeSnapshot } from './modeSwitchDebug'
import { summarizeModeSwitchRestoreQuality } from './modeSwitchQualitySignals'
import type { CaptureVisualToSourceResult, TiptapMarkdownEditorHandle } from './TiptapMarkdownEditor'
import { getOutlineParseSchema } from './markdownOutlineFromMarkdown'
import { getSourceModeIdentity } from './sourceModeIdentity'
import {
  makeModeBridgeId,
  type ModeSwitchPrepareResultKind,
  type SourceModeEnterAnchor,
  type VisualModeRestorePayload,
} from './viewportModeAnchor'
import { viewportAnchorEngine } from './viewportAnchorEngine'
import { projectModeSwitchSourceBuffer } from '../lib/editorContentSync'
import { syncDocumentFrontmatterFromMarkdown } from './documentFrontmatterStore'
import { sourceSelectionToBodySelection, splitFullSourceMarkdown } from './documentFrontmatterOffsets'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import {
  normalizeWikiLinkBlockRefEscapesInMarkdown,
  originalToNormalizedAfterWikiBlockRefUnescape,
} from './knowledgeRuntime/wikiLinkParser'

export type VisualToSourcePrepareResult = {
  /** Full markdown for source CodeMirror (includes YAML when detached). */
  readonly markdown: string
  /** Visual/kernel edit surface without leading YAML. */
  readonly editorSurface: string
  /** Extra bytes prepended before PM body (selection offset adjustment). */
  readonly frontmatterPrefixLength: number
  readonly resultKind: ModeSwitchPrepareResultKind
  readonly sourceEnter: SourceModeEnterAnchor | null
  readonly cmSelection: ModeSelectionSpan | null
  readonly pmSelection: ModeSelectionSpan | null
  readonly semantic: ModeSwitchFsmSemanticPatch
  readonly anchorPayload: ModeSwitchAnchorPayload | null
}

export type SourceToVisualPrepareResult = {
  /** Visual edit surface (body without YAML). */
  readonly markdown: string
  readonly editorSurface: string
  readonly fullSourceMarkdown: string
  readonly frontmatterPrefixLength: number
  readonly resultKind: ModeSwitchPrepareResultKind
  readonly visualRestore: VisualModeRestorePayload | null
  readonly semantic: ModeSwitchFsmSemanticPatch
  readonly anchorPayload: ModeSwitchAnchorPayload | null
}

function buildDegradedVisualRestore(args: {
  documentKey: string
  markdown: string
  cmAnchor: number
  cmHead: number
  pending: SourceModeEnterAnchor | null
  cmSelection: ModeSelectionSpan
}): { visualRestore: VisualModeRestorePayload; semantic: ModeSwitchFsmSemanticPatch } {
  const schema = getOutlineParseSchema()
  const canonicalBuffer = normalizeWikiLinkBlockRefEscapesInMarkdown(args.markdown)
  const cmAnchor = originalToNormalizedAfterWikiBlockRefUnescape(args.markdown, args.cmAnchor)
  const cmHead = originalToNormalizedAfterWikiBlockRefUnescape(args.markdown, args.cmHead)
  const parsed = canonicalMarkdownSemantics.parse(args.markdown, schema)
  const provisionalIR = buildFrozenStructuralIR({
    canonicalBuffer,
    hierarchical: null,
    doc: parsed,
  })
  const cmHier = deriveHierarchicalFromCmSelection(cmAnchor, cmHead, provisionalIR)
  const pmInnerMax = Math.max(1, parsed.content.size)
  const pmSelection = Object.freeze({
    from: semanticAnchorToPm(
      pmHierarchicalCoreToSemanticAnchor(cmHier.anchor),
      provisionalIR,
      canonicalBuffer.length,
      pmInnerMax,
    ),
    to: semanticAnchorToPm(
      pmHierarchicalCoreToSemanticAnchor(cmHier.head),
      provisionalIR,
      canonicalBuffer.length,
      pmInnerMax,
    ),
  })
  const hierarchical = Object.freeze({
    bufferHash: modeSwitchPlainTextFingerprint(canonicalBuffer),
    anchor: cmHier.anchor,
    head: cmHier.head,
  })
  return {
    semantic: {
      semanticAnchor: pmHierarchicalCoreToSemanticAnchor(cmHier.anchor),
      semanticHead: pmHierarchicalCoreToSemanticAnchor(cmHier.head),
      cmSelection: Object.freeze({ from: cmAnchor, to: cmHead }),
      pmSelection,
      ir: provisionalIR,
      canonicalBuffer,
    },
    visualRestore: {
      documentKey: args.documentKey,
      bufferLength: canonicalBuffer.length,
      bridgeId: makeModeBridgeId(args.documentKey, cmAnchor, cmHead),
      cmAnchor,
      cmHead,
      hierarchical: hierarchical ?? args.pending?.hierarchical ?? null,
      captureFrameId: args.pending?.captureFrameId,
      modeSwitchSnapshot: null,
      resultKind: 'degraded_success',
    },
  }
}

/**
 * Synchronize capture before unloading PM: semantic anchors, CM/PM selections, canonical body.
 * The caller must execute before `setMainPaneMode('source')`.
 */
export function prepareVisualToSourceTransition(args: {
  documentKey: string
  contentFallback: string
  visualEditor: TiptapMarkdownEditorHandle | null
  onFailed?: (error: unknown) => void
}): VisualToSourcePrepareResult {
  const dk = args.documentKey
  const identityBeforeCapture = getSourceModeIdentity(dk)
  if (identityBeforeCapture) {
    syncDocumentFrontmatterFromMarkdown(dk, identityBeforeCapture)
  }
  let markdown = identityBeforeCapture ?? args.contentFallback
  let resultKind: ModeSwitchPrepareResultKind = 'hard_fail'
  let sourceEnter: SourceModeEnterAnchor | null = null
  let semantic: ModeSwitchFsmSemanticPatch = {}
  let cmSelection: ModeSelectionSpan | null = null
  let pmSelection: ModeSelectionSpan | null = null

  const v = args.visualEditor
  if (v) {
    const r: CaptureVisualToSourceResult = v.captureVisualToSourceTransition(dk)
    if ('reason' in r && r.reason === 'document_mismatch') {
      // activePath switched but PM still shows previous doc — do not enter source with stale text
      resultKind = 'hard_fail'
    } else if (r.ok) {
      markdown = r.markdown
      resultKind = r.resultKind
      sourceEnter = r.anchor
      const snap = r.anchor.modeSwitchSnapshot
      const hier = snap?.hierarchical
      if (snap && hier) {
        const semanticAnchor = pmHierarchicalCoreToSemanticAnchor(hier.anchor)
        const semanticHead = pmHierarchicalCoreToSemanticAnchor(hier.head)
        cmSelection = Object.freeze({
          from: snap.selection.anchor,
          to: snap.selection.head,
        })
        pmSelection = Object.freeze({
          from: snap.expectedPmAnchor,
          to: snap.expectedPmHead,
        })
        semantic = {
          semanticAnchor,
          semanticHead,
          cmSelection,
          pmSelection,
          ir: snap.frozenStructuralIR,
          canonicalBuffer: snap.canonicalBuffer,
        }
      }
      debugModeSwitch('[mode-switch][visual->source][prepare]', {
        documentKey: dk,
        resultKind,
        bridgeId: sourceEnter?.bridgeId ?? null,
        cmSelection: sourceEnter
          ? describeSelectionInText(markdown, sourceEnter.cmAnchor, sourceEnter.cmHead)
          : null,
        pmSelection,
        semanticAnchor: semantic.semanticAnchor ?? null,
        semanticHead: semantic.semanticHead ?? null,
        snapshot: summarizeSnapshot(sourceEnter?.modeSwitchSnapshot),
      })
    }
  }


  const projected = projectModeSwitchSourceBuffer(dk, markdown)
  const sourceEnterWithPrefix =
    sourceEnter && projected.frontmatterPrefixLength > 0
      ? {
          ...sourceEnter,
          frontmatterPrefixLengthAtCapture: projected.frontmatterPrefixLength,
        }
      : sourceEnter

  return Object.freeze({
    markdown: projected.sourceIdentity,
    editorSurface: projected.editorSurface,
    frontmatterPrefixLength: projected.frontmatterPrefixLength,
    resultKind,
    sourceEnter: sourceEnterWithPrefix,
    cmSelection,
    pmSelection,
    semantic,
    anchorPayload: sourceEnter ? { sourceEnter, visualRestore: null } : null,
  })
}

/**
 * Synchronously read selections and freeze back to visual snapshot before unloading CM.
 * The caller must execute before `setMainPaneMode('visual')`.
 */
export function prepareSourceToVisualTransition(args: {
  documentKey: string
  editorView: EditorView | null
  pendingSourceModeAnchorRef: { current: SourceModeEnterAnchor | null }
  /** When ref was cleared too early (e.g. legacy CM ready handler), recover from FSM pendingAnchor.sourceEnter. */
  fallbackSourceEnter?: SourceModeEnterAnchor | null
  onFailed?: (error: unknown) => void
}): SourceToVisualPrepareResult {
  const dk = args.documentKey
  const cm = args.editorView
  const fullSourceMarkdown = cm?.state.doc.toString() ?? ''
  setSourceModeIdentity(dk, fullSourceMarkdown)
  syncDocumentFrontmatterFromMarkdown(dk, fullSourceMarkdown)
  const { body: editorSurface, frontmatterPrefixLength } = splitFullSourceMarkdown(fullSourceMarkdown)
  const pend = args.pendingSourceModeAnchorRef.current ?? args.fallbackSourceEnter ?? null
  args.pendingSourceModeAnchorRef.current = null

  if (cm) {
    const cmAnchor = cm.state.selection.main.anchor
    const cmHead = cm.state.selection.main.head
    try {
      viewportAnchorEngine.recordAnchorLeavingSource({
        bridgeId: makeModeBridgeId(dk, cmAnchor, cmHead),
        cmAnchor,
        cmHead,
      })
    } catch (e) {
      reportModeSwitchFreezeFailure(e, { documentKey: dk, phase: 'recordAnchorLeavingSource' })
    }
  }

  if (!cm) {
    return Object.freeze({
      markdown: editorSurface,
      editorSurface,
      fullSourceMarkdown,
      frontmatterPrefixLength,
      resultKind: 'hard_fail',
      visualRestore: null,
      semantic: {},
      anchorPayload: null,
    })
  }

  const cmAnchor = cm.state.selection.main.anchor
  const cmHead = cm.state.selection.main.head
  const cmSelection = Object.freeze({ from: cmAnchor, to: cmHead })
  const bodySel = sourceSelectionToBodySelection(
    cmAnchor,
    cmHead,
    frontmatterPrefixLength,
    editorSurface.length,
  )

  if (!pend?.modeSwitchSnapshot) {
    try {
      const degraded = buildDegradedVisualRestore({
        documentKey: dk,
        markdown: editorSurface,
        cmAnchor: bodySel.bodyAnchor,
        cmHead: bodySel.bodyHead,
        pending: pend,
        cmSelection: Object.freeze({ from: bodySel.bodyAnchor, to: bodySel.bodyHead }),
      })
      debugModeSwitch('[mode-switch][source->visual][prepare-degraded]', {
        documentKey: dk,
        resultKind: 'degraded_success',
        bridgeId: degraded.visualRestore.bridgeId,
        cmSelection: describeSelectionInText(editorSurface, bodySel.bodyAnchor, bodySel.bodyHead),
        semanticAnchor: degraded.semantic.semanticAnchor ?? null,
        semanticHead: degraded.semantic.semanticHead ?? null,
        pmSelection: degraded.semantic.pmSelection ?? null,
        snapshot: null,
        restoreQuality: summarizeModeSwitchRestoreQuality({
          expected: degraded.visualRestore.hierarchical?.anchor ?? null,
          actual: degraded.visualRestore.hierarchical?.anchor ?? null,
          ir: degraded.semantic.ir ?? null,
        }),
      })
      return Object.freeze({
        markdown: editorSurface,
        editorSurface,
        fullSourceMarkdown,
        frontmatterPrefixLength,
        resultKind: 'degraded_success',
        visualRestore: degraded.visualRestore,
        semantic: degraded.semantic,
        anchorPayload: { sourceEnter: null, visualRestore: degraded.visualRestore },
      })
    } catch (e) {
      reportModeSwitchFreezeFailure(e, {
        documentKey: dk,
        phase: 'returningToVisualDegraded',
        failureKind: 'degraded_restore_compile',
        documentFingerprint: modeSwitchPlainTextFingerprint(editorSurface),
        resultKind: 'hard_fail',
        qualitySummary: {
          pendingSnapshot: summarizeSnapshot(pend?.modeSwitchSnapshot ?? null),
          cmSelection: describeSelectionInText(editorSurface, bodySel.bodyAnchor, bodySel.bodyHead),
        },
      })
      args.onFailed?.(isModeSwitchFreezeError(e) ? e.detail.reason ?? e : e)
    }
    return Object.freeze({
      markdown: editorSurface,
      editorSurface,
      fullSourceMarkdown,
      frontmatterPrefixLength,
      resultKind: 'hard_fail',
      visualRestore: null,
      semantic: { cmSelection },
      anchorPayload: null,
    })
  }

  try {
    const merged = freezeReturningToVisualSnapshot(pend.modeSwitchSnapshot, {
      markdown: editorSurface,
      anchor: bodySel.bodyAnchor,
      head: bodySel.bodyHead,
    })
    const frozenMd = merged.canonicalBuffer
    const hier = merged.hierarchical
    const semantic: ModeSwitchFsmSemanticPatch = {
      semanticAnchor: hier ? pmHierarchicalCoreToSemanticAnchor(hier.anchor) : null,
      semanticHead: hier ? pmHierarchicalCoreToSemanticAnchor(hier.head) : null,
      cmSelection,
      pmSelection: Object.freeze({
        from: merged.expectedPmAnchor,
        to: merged.expectedPmHead,
      }),
      ir: merged.frozenStructuralIR,
      canonicalBuffer: frozenMd,
    }
    const visualRestore: VisualModeRestorePayload = {
      documentKey: dk,
      bufferLength: frozenMd.length,
      bridgeId: makeModeBridgeId(dk, bodySel.bodyAnchor, bodySel.bodyHead),
      cmAnchor: bodySel.bodyAnchor,
      cmHead: bodySel.bodyHead,
      hierarchical: merged.hierarchical ?? pend.hierarchical ?? null,
      captureFrameId: merged.captureFrameId,
      modeSwitchSnapshot: merged,
      resultKind: 'strict_success',
    }
    debugModeSwitch('[mode-switch][source->visual][prepare]', {
      documentKey: dk,
      resultKind: 'strict_success',
      bridgeId: visualRestore.bridgeId,
      cmSelection: describeSelectionInText(editorSurface, bodySel.bodyAnchor, bodySel.bodyHead),
      semanticAnchor: semantic.semanticAnchor ?? null,
      semanticHead: semantic.semanticHead ?? null,
      pmSelection: semantic.pmSelection ?? null,
      snapshot: summarizeSnapshot(merged),
      restoreQuality: summarizeModeSwitchRestoreQuality({
        expected: pend.modeSwitchSnapshot.hierarchical?.anchor ?? null,
        actual: merged.hierarchical?.anchor ?? null,
        ir: merged.frozenStructuralIR,
      }),
    })
    return Object.freeze({
      markdown: frozenMd,
      editorSurface: frozenMd,
      fullSourceMarkdown,
      frontmatterPrefixLength,
      resultKind: 'strict_success',
      visualRestore,
      semantic,
      anchorPayload: { sourceEnter: null, visualRestore },
    })
  } catch (e) {
    reportModeSwitchFreezeFailure(e, {
      documentKey: dk,
      phase: 'returningToVisual',
      failureKind: 'strict_restore_compile',
      documentFingerprint: modeSwitchPlainTextFingerprint(editorSurface),
      resultKind: 'hard_fail',
      qualitySummary: {
        pendingSnapshot: summarizeSnapshot(pend.modeSwitchSnapshot),
        cmSelection: describeSelectionInText(editorSurface, bodySel.bodyAnchor, bodySel.bodyHead),
      },
    })
    try {
      const degraded = buildDegradedVisualRestore({
        documentKey: dk,
        markdown: editorSurface,
        cmAnchor: bodySel.bodyAnchor,
        cmHead: bodySel.bodyHead,
        pending: pend,
        cmSelection: Object.freeze({ from: bodySel.bodyAnchor, to: bodySel.bodyHead }),
      })
      debugModeSwitch('[mode-switch][source->visual][prepare-degraded-after-strict-fail]', {
        documentKey: dk,
        strictFailure: isModeSwitchFreezeError(e) ? e.detail.reason ?? e.message : String(e),
        bridgeId: degraded.visualRestore.bridgeId,
        cmSelection: describeSelectionInText(editorSurface, bodySel.bodyAnchor, bodySel.bodyHead),
      })
      return Object.freeze({
        markdown: editorSurface,
        editorSurface,
        fullSourceMarkdown,
        frontmatterPrefixLength,
        resultKind: 'degraded_success',
        visualRestore: degraded.visualRestore,
        semantic: degraded.semantic,
        anchorPayload: { sourceEnter: null, visualRestore: degraded.visualRestore },
      })
    } catch (degradedErr) {
      reportModeSwitchFreezeFailure(degradedErr, {
        documentKey: dk,
        phase: 'returningToVisualDegradedAfterStrictFail',
        failureKind: 'degraded_restore_compile',
        documentFingerprint: modeSwitchPlainTextFingerprint(editorSurface),
        resultKind: 'hard_fail',
      })
    }
    args.onFailed?.(isModeSwitchFreezeError(e) ? e.detail.reason ?? e : e)
    return Object.freeze({
      markdown: editorSurface,
      editorSurface,
      fullSourceMarkdown,
      frontmatterPrefixLength,
      resultKind: 'hard_fail',
      visualRestore: null,
      semantic: { cmSelection },
      anchorPayload: null,
    })
  }
}
