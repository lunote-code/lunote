import type { Editor } from '@tiptap/core'
import type { Node as PmNode, Schema } from '@tiptap/pm/model'

import type {
  CaptureVisualToSourceResult,
  TiptapMarkdownEditorHandle,
} from './tiptapEditorTypes'
import type {
  FrozenModeSwitchHierarchical,
  ModeSwitchSnapshot,
} from './modeSwitchSnapshot'
import type { SourceModeEnterAnchor } from './viewportModeAnchor'

type TiptapEditorCaptureHandleArgs = {
  editor: Editor | null
  boundDocumentKey: string
  markdown: string
  flushMermaidSourceForSerialize: (editor: Editor) => void
  trySerialize: (
    doc: PmNode,
    schema: Schema,
  ) => { ok: true; markdown: string } | { ok: false; error?: unknown }
  normalizeSerializedMarkdownForSource: (markdown: string) => string
  allocModeSwitchCaptureFrameId: () => number
  deriveHierarchicalSelectionFromPm: (
    doc: PmNode,
    pos: number,
  ) => FrozenModeSwitchHierarchical['anchor']
  freezeModeSwitchSnapshot: (args: {
    captureFrameId: number
    documentKey: string
    hierarchical: FrozenModeSwitchHierarchical | null
    doc: PmNode
    schema: Schema
    sourceMode: 'visual' | 'source'
    identityMarkdown?: string
  }) => ModeSwitchSnapshot
  reportModeSwitchFreezeFailure: (
    err: unknown,
    ctx?: {
      documentKey?: string
      phase?: string
      failureKind?: string
      bridgeId?: string
      documentFingerprint?: string
      resultKind?: string
      qualitySummary?: Record<string, unknown> | null
    },
  ) => void
  assertNoPartialModeSwitchMutation: (args: {
    markdownBefore: string
    markdownAfter: string
    pmDocUnchanged: boolean
  }) => void
  isModeSwitchFreezeError: (err: unknown) => err is Error & { detail: Record<string, unknown> }
  makeModeBridgeId: (documentKey: string, cmAnchor: number, cmHead: number) => string
  recordModeSwitchGoodAnchor: (documentKey: string, pmHead: number, cmHead: number) => void
  debugModeSwitch: (message: string, data: Record<string, unknown>) => void
  describeSelectionInText: (text: string, anchor: number, head: number) => unknown
  describeScrollMetrics: (element: HTMLElement) => unknown
  summarizeSnapshot: (snapshot: ModeSwitchSnapshot | null | undefined) => unknown
}

export function createTiptapEditorCaptureHandle(
  args: TiptapEditorCaptureHandleArgs,
): Pick<TiptapMarkdownEditorHandle, 'captureVisualToSourceTransition'> {
  return {
    captureVisualToSourceTransition(documentKey: string): CaptureVisualToSourceResult {
      if (!args.editor) return { ok: false, reason: 'no_editor' }
      if (args.boundDocumentKey !== documentKey) {
        return { ok: false, reason: 'document_mismatch' }
      }
      const view = args.editor.view
      const schema = args.editor.schema
      const doc = view.state.doc
      const markdownBefore = args.markdown

      args.flushMermaidSourceForSerialize(args.editor)
      const serializedNow = args.trySerialize(doc, schema)
      const identityMarkdown =
        serializedNow.ok
          ? args.normalizeSerializedMarkdownForSource(serializedNow.markdown)
          : markdownBefore

      const captureFrameId = args.allocModeSwitchCaptureFrameId()
      let modeSwitchSnapshot: ModeSwitchSnapshot
      let preFreezeHierarchical: FrozenModeSwitchHierarchical | null = null

      try {
        preFreezeHierarchical = {
          bufferHash: '',
          anchor: args.deriveHierarchicalSelectionFromPm(doc, args.editor.state.selection.anchor),
          head: args.deriveHierarchicalSelectionFromPm(doc, args.editor.state.selection.head),
        }
        modeSwitchSnapshot = args.freezeModeSwitchSnapshot({
          captureFrameId,
          documentKey,
          hierarchical: preFreezeHierarchical,
          doc,
          schema,
          sourceMode: 'visual',
          identityMarkdown,
        })
      } catch (err) {
        args.reportModeSwitchFreezeFailure(err, { documentKey, phase: 'visualToSource' })
        if (import.meta.env.DEV) {
          args.assertNoPartialModeSwitchMutation({
            markdownBefore,
            markdownAfter: args.markdown,
            pmDocUnchanged: doc.eq(view.state.doc),
          })
        }

        const len = identityMarkdown.length
        const cmAnchor = Math.max(0, Math.min(len, args.editor.state.selection.anchor - 1))
        const cmHead = Math.max(0, Math.min(len, args.editor.state.selection.head - 1))
        const anchor: SourceModeEnterAnchor = {
          documentKey,
          bufferLength: len,
          bridgeId: args.makeModeBridgeId(documentKey, cmAnchor, cmHead),
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
            reason: args.isModeSwitchFreezeError(err) ? err.detail.reason : String(err),
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
        bridgeId: args.makeModeBridgeId(documentKey, cmAnchor, cmHead),
        cmAnchor,
        cmHead,
        captureFrameId,
        hierarchical: modeSwitchSnapshot.hierarchical ?? preFreezeHierarchical,
        modeSwitchSnapshot,
        resultKind: 'strict_success',
      }

      if (import.meta.env.DEV) {
        args.debugModeSwitch('[mode-switch][visual->source][captured]', {
          frame: captureFrameId,
          documentKey,
          bridgeId: anchor.bridgeId,
          pmSelection: {
            anchor: args.editor.state.selection.anchor,
            head: args.editor.state.selection.head,
          },
          cmSelection: args.describeSelectionInText(canonicalBuffer, cmAnchor, cmHead),
          visualScroll: args.describeScrollMetrics(args.editor.view.dom as HTMLElement),
          snapshot: args.summarizeSnapshot(modeSwitchSnapshot),
        })
      }

      args.recordModeSwitchGoodAnchor(documentKey, modeSwitchSnapshot.expectedPmHead, cmHead)
      return { ok: true, markdown: canonicalBuffer, anchor, resultKind: 'strict_success' }
    },
  }
}
