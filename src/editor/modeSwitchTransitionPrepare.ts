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
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'

export type VisualToSourcePrepareResult = {
  readonly markdown: string
  readonly resultKind: ModeSwitchPrepareResultKind
  readonly sourceEnter: SourceModeEnterAnchor | null
  readonly cmSelection: ModeSelectionSpan | null
  readonly pmSelection: ModeSelectionSpan | null
  readonly semantic: ModeSwitchFsmSemanticPatch
  readonly anchorPayload: ModeSwitchAnchorPayload | null
}

export type SourceToVisualPrepareResult = {
  readonly markdown: string
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
  const parsed = canonicalMarkdownSemantics.parse(args.markdown, schema)
  const provisionalIR = buildFrozenStructuralIR({
    canonicalBuffer: args.markdown,
    hierarchical: null,
    doc: parsed,
  })
  const cmHier = deriveHierarchicalFromCmSelection(args.cmAnchor, args.cmHead, provisionalIR)
  const pmInnerMax = Math.max(1, parsed.content.size)
  const pmSelection = Object.freeze({
    from: semanticAnchorToPm(
      pmHierarchicalCoreToSemanticAnchor(cmHier.anchor),
      provisionalIR,
      args.markdown.length,
      pmInnerMax,
    ),
    to: semanticAnchorToPm(
      pmHierarchicalCoreToSemanticAnchor(cmHier.head),
      provisionalIR,
      args.markdown.length,
      pmInnerMax,
    ),
  })
  const hierarchical = Object.freeze({
    bufferHash: modeSwitchPlainTextFingerprint(args.markdown),
    anchor: cmHier.anchor,
    head: cmHier.head,
  })
  return {
    semantic: {
      semanticAnchor: pmHierarchicalCoreToSemanticAnchor(cmHier.anchor),
      semanticHead: pmHierarchicalCoreToSemanticAnchor(cmHier.head),
      cmSelection: args.cmSelection,
      pmSelection,
      ir: provisionalIR,
      canonicalBuffer: args.markdown,
    },
    visualRestore: {
      documentKey: args.documentKey,
      bufferLength: args.markdown.length,
      bridgeId: makeModeBridgeId(args.documentKey, args.cmAnchor, args.cmHead),
      cmAnchor: args.cmAnchor,
      cmHead: args.cmHead,
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
  let markdown = getSourceModeIdentity(dk) ?? args.contentFallback
  let resultKind: ModeSwitchPrepareResultKind = 'hard_fail'
  let sourceEnter: SourceModeEnterAnchor | null = null
  let semantic: ModeSwitchFsmSemanticPatch = {}
  let cmSelection: ModeSelectionSpan | null = null
  let pmSelection: ModeSelectionSpan | null = null

  const v = args.visualEditor
  if (v) {
    const r: CaptureVisualToSourceResult = v.captureVisualToSourceTransition(dk)
    if (r.ok) {
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
    } else if (r.reason === 'document_mismatch') {
      //activePath has been switched but PM still displays Previous article: It is forbidden to enter the source code/write kernel with error text
      resultKind = 'hard_fail'
    }
  }

  return Object.freeze({
    markdown,
    resultKind,
    sourceEnter,
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
  onFailed?: (error: unknown) => void
}): SourceToVisualPrepareResult {
  const dk = args.documentKey
  const cm = args.editorView
  const md = cm?.state.doc.toString() ?? ''
  setSourceModeIdentity(dk, md)
  const pend = args.pendingSourceModeAnchorRef.current
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
      markdown: md,
      resultKind: 'hard_fail',
      visualRestore: null,
      semantic: {},
      anchorPayload: null,
    })
  }

  const cmAnchor = cm.state.selection.main.anchor
  const cmHead = cm.state.selection.main.head
  const cmSelection = Object.freeze({ from: cmAnchor, to: cmHead })

  if (!pend?.modeSwitchSnapshot) {
    try {
      const degraded = buildDegradedVisualRestore({
        documentKey: dk,
        markdown: md,
        cmAnchor,
        cmHead,
        pending: pend,
        cmSelection,
      })
      debugModeSwitch('[mode-switch][source->visual][prepare-degraded]', {
        documentKey: dk,
        resultKind: 'degraded_success',
        bridgeId: degraded.visualRestore.bridgeId,
        cmSelection: describeSelectionInText(md, cmAnchor, cmHead),
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
        markdown: md,
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
        documentFingerprint: modeSwitchPlainTextFingerprint(md),
        resultKind: 'hard_fail',
        qualitySummary: {
          pendingSnapshot: summarizeSnapshot(pend?.modeSwitchSnapshot ?? null),
          cmSelection: describeSelectionInText(md, cmAnchor, cmHead),
        },
      })
      args.onFailed?.(isModeSwitchFreezeError(e) ? e.detail.reason ?? e : e)
    }
    return Object.freeze({
      markdown: md,
      resultKind: 'hard_fail',
      visualRestore: null,
      semantic: { cmSelection },
      anchorPayload: null,
    })
  }

  try {
    const merged = freezeReturningToVisualSnapshot(pend.modeSwitchSnapshot, {
      markdown: md,
      anchor: cmAnchor,
      head: cmHead,
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
      bridgeId: makeModeBridgeId(dk, cmAnchor, cmHead),
      cmAnchor,
      cmHead,
      hierarchical: merged.hierarchical ?? pend.hierarchical ?? null,
      captureFrameId: merged.captureFrameId,
      modeSwitchSnapshot: merged,
      resultKind: 'strict_success',
    }
    debugModeSwitch('[mode-switch][source->visual][prepare]', {
      documentKey: dk,
      resultKind: 'strict_success',
      bridgeId: visualRestore.bridgeId,
      cmSelection: describeSelectionInText(md, cmAnchor, cmHead),
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
      markdown: md,
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
      documentFingerprint: modeSwitchPlainTextFingerprint(md),
      resultKind: 'hard_fail',
      qualitySummary: {
        pendingSnapshot: summarizeSnapshot(pend.modeSwitchSnapshot),
        cmSelection: describeSelectionInText(md, cmAnchor, cmHead),
      },
    })
    args.onFailed?.(isModeSwitchFreezeError(e) ? e.detail.reason ?? e : e)
    return Object.freeze({
      markdown: md,
      resultKind: 'hard_fail',
      visualRestore: null,
      semantic: { cmSelection },
      anchorPayload: null,
    })
  }
}
