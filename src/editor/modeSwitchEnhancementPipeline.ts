import type { EditorView } from '@codemirror/view'

import {
  isModeSwitchFreezeError,
  reportModeSwitchFreezeFailure,
} from './modeSwitchFreezeFailure'
import type { ModeSwitchAnchorPayload } from './modeSwitchFSM'
import { projectModeSwitchSourceBuffer } from '../lib/editorContentSync'
import { syncDocumentFrontmatterFromMarkdown } from './documentFrontmatterStore'
import { sourceSelectionToBodySelection, splitFullSourceMarkdown } from './documentFrontmatterOffsets'
import { getSourceModeIdentity, setSourceModeIdentity } from './sourceModeIdentity'
import { freezeReturningToVisualSnapshot } from './modeSwitchSnapshot'
import type { CaptureVisualToSourceResult, TiptapMarkdownEditorHandle } from './TiptapMarkdownEditor'
import { makeModeBridgeId, type SourceModeEnterAnchor, type VisualModeRestorePayload } from './viewportModeAnchor'
import { viewportAnchorEngine } from './viewportAnchorEngine'

export type VisualToSourceEnhancementCtx = {
  documentKey: string
  contentFallback: string
  visualEditor: TiptapMarkdownEditorHandle | null
  editorView: EditorView | null
  pendingSourceModeAnchorRef: { current: SourceModeEnterAnchor | null }
  renderContent: (markdown: string) => void
  onAnchorPayload: (payload: ModeSwitchAnchorPayload | null) => void
  onFailed: (error: unknown) => void
  onApplyingAnchor: () => void
  runCmEnterPipeline: (view: EditorView, anchor: SourceModeEnterAnchor) => void
  expectDocumentKey: string
}

export type SourceToVisualEnhancementCtx = {
  documentKey: string
  editorView: EditorView | null
  pendingSourceModeAnchorRef: { current: SourceModeEnterAnchor | null }
  renderContent: (markdown: string) => void
  setVisualRestoreFromSource: (payload: VisualModeRestorePayload | null) => void
  onAnchorPayload: (payload: ModeSwitchAnchorPayload | null) => void
  onFailed: (error: unknown) => void
  onApplyingAnchor: () => void
}

/**
 * The enhancement layer after the UI has been cut to the source code: freeze/anchor/text synchronization; **Does not throw or block UI on failure**.
 * Must be called at the end of the same sync stack before React commits to unload PM (`visualEditor` is still readable).
 */
export function runVisualToSourceEnhancement(ctx: VisualToSourceEnhancementCtx): void {
  const dk = ctx.documentKey
  const projected = projectModeSwitchSourceBuffer(dk, getSourceModeIdentity(dk) ?? ctx.contentFallback)
  let sourceEnter: SourceModeEnterAnchor | null = null

  const v = ctx.visualEditor
  if (v) {
    const r: CaptureVisualToSourceResult = v.captureVisualToSourceTransition(dk)
    if (r.ok) {
      sourceEnter = r.anchor
    }
  }

  ctx.renderContent(projected.editorSurface)

  if (sourceEnter) {
    const prefix = projected.frontmatterPrefixLength
    const shiftedEnter: SourceModeEnterAnchor =
      prefix > 0
        ? {
            ...sourceEnter,
            cmAnchor: sourceEnter.cmAnchor + prefix,
            cmHead: sourceEnter.cmHead + prefix,
            bufferLength: projected.sourceIdentity.length,
            frontmatterPrefixLengthAtCapture: prefix,
          }
        : sourceEnter
    ctx.pendingSourceModeAnchorRef.current = sourceEnter
    try {
      viewportAnchorEngine.recordAnchorLeavingEditor(shiftedEnter)
    } catch (e) {
      reportModeSwitchFreezeFailure(e, { documentKey: dk, phase: 'recordAnchorLeavingEditor' })
    }
    ctx.onAnchorPayload({ sourceEnter, visualRestore: null })
    ctx.onApplyingAnchor()
    const cm = ctx.editorView
    if (cm) {
      ctx.runCmEnterPipeline(cm, shiftedEnter)
    }
  } else {
    ctx.pendingSourceModeAnchorRef.current = null
    ctx.onAnchorPayload(null)
  }
}

/**
 * The UI has been cut to the enhancement layer after WYSIWYG; CM is usually still readable at the end of the sync stack.
 */
export function runSourceToVisualEnhancement(ctx: SourceToVisualEnhancementCtx): void {
  const dk = ctx.documentKey
  const cm = ctx.editorView
  const md = cm?.state.doc.toString() ?? ''
  if (md) {
    setSourceModeIdentity(dk, md)
    syncDocumentFrontmatterFromMarkdown(dk, md)
  }

  const pend = ctx.pendingSourceModeAnchorRef.current
  ctx.pendingSourceModeAnchorRef.current = null

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

  if (!pend?.modeSwitchSnapshot || !cm) {
    ctx.setVisualRestoreFromSource(null)
    ctx.onAnchorPayload(null)
    return
  }

  const cmAnchor = cm.state.selection.main.anchor
  const cmHead = cm.state.selection.main.head
  const { body: editorSurface, frontmatterPrefixLength } = splitFullSourceMarkdown(md)
  const bodySel = sourceSelectionToBodySelection(
    cmAnchor,
    cmHead,
    frontmatterPrefixLength,
    editorSurface.length,
  )

  try {
    const merged = freezeReturningToVisualSnapshot(pend.modeSwitchSnapshot, {
      markdown: editorSurface,
      anchor: bodySel.bodyAnchor,
      head: bodySel.bodyHead,
    })
    const frozenMd = merged.canonicalBuffer
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
    ctx.setVisualRestoreFromSource(visualRestore)
    ctx.onApplyingAnchor()
    ctx.onAnchorPayload({ sourceEnter: null, visualRestore })
  } catch (e) {
    reportModeSwitchFreezeFailure(e, { documentKey: dk, phase: 'returningToVisual' })
    ctx.onFailed(isModeSwitchFreezeError(e) ? e.detail.reason ?? e : e)
    ctx.setVisualRestoreFromSource(null)
    ctx.onAnchorPayload(null)
  }
}
