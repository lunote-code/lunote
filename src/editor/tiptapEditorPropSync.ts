import type { MutableRefObject } from 'react'
import type { Editor } from '@tiptap/core'
import type { AtomicVisualDocumentEnter } from './tiptapEditorTypes'
import type { PmTocHeading } from './pmHeadingNav'

import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import { flushMermaidSourceForSerialize } from './mermaid/mermaidSourceBridge'
import { logPasteScrollPropSync } from './pasteScrollDebug'
import { preserveProseMirrorScrollDuring } from './preserveProseMirrorScroll'
import {
  checkBlankContentSuspect,
  isTabNavLogEnabled,
  logTabNav,
  snapshotDocumentBodyMeta,
} from '../lib/tabNavigationDebug'

type PendingInitialHydration = {
  documentKey: string
  markdown: string
}

type TiptapEditorPropSyncArgs = {
  editor: Editor
  documentKey: string
  markdown: string
  hasUserEditedSinceDocumentLoadRef: MutableRefObject<boolean>
  suppressMarkdownSyncRef?: MutableRefObject<boolean> | undefined
  pendingInitialHydrationRef: MutableRefObject<PendingInitialHydration | null>
  syncExternalMarkdownRefs: (markdown: string, editor: Editor | null) => void
  lastExternalMarkdownRef: MutableRefObject<string>
  lastNormalizedExternalMarkdownRef: MutableRefObject<string>
  lastDocumentKeyRef: MutableRefObject<string>
  didAtomicVisualBootstrapRef: MutableRefObject<boolean>
  normalizeSerializedMarkdownForSource: (markdown: string) => string
  atomicVisualDocumentEnterRef: MutableRefObject<AtomicVisualDocumentEnter | null>
  resolveVisualTabRestore: (
    documentKey: string,
    boot: AtomicVisualDocumentEnter | null,
  ) => AtomicVisualDocumentEnter | null
  flushMermaidSourceForDocumentSwitch: (editor: Editor) => void
  composingRef: MutableRefObject<boolean>
  pointerLinkRef: MutableRefObject<HTMLAnchorElement | null>
  clearLinkModifierHint: () => void
  scheduleVisualTailTrace: (editor: Editor, reason: string, documentKey: string) => void
  scheduleVisualBlockGapTrace: (editor: Editor, reason: string, documentKey: string) => void
  flushVmTiptapRecorderBatch: (documentKey: string) => void
  resetTransactionLog: (documentKey: string) => void
  applyVisualTabViewportRestore: (editor: Editor, restore: AtomicVisualDocumentEnter) => void
  onAtomicVisualDocumentEnterConsumedRef: MutableRefObject<(() => void) | undefined>
  onOutlineHeadingsChangeRef: MutableRefObject<((headings: PmTocHeading[]) => void) | undefined>
  parseHeadingsFromPmDoc: (doc: Editor['state']['doc']) => PmTocHeading[]
}

export function syncTiptapEditorFromProps(args: TiptapEditorPropSyncArgs): void {
  if (args.editor.isDestroyed) return
  if (args.suppressMarkdownSyncRef?.current) {
    logPasteScrollPropSync({
      path: 'skip-suppressed-sync',
      documentKey: args.documentKey,
      markdownLength: args.markdown.length,
      pmView: args.editor.view,
    })
    if (isTabNavLogEnabled()) {
      logTabNav('editor-hydrate-skipped', {
        skipPath: 'skip-suppressed-sync',
        documentKey: args.documentKey,
        markdown: snapshotDocumentBodyMeta(args.documentKey, args.markdown),
      })
    }
    return
  }

  const pendingInitialHydration = args.pendingInitialHydrationRef.current
  if (
    pendingInitialHydration != null &&
    pendingInitialHydration.documentKey === args.documentKey &&
    pendingInitialHydration.markdown === args.markdown
  ) {
    args.pendingInitialHydrationRef.current = null
    args.syncExternalMarkdownRefs(args.markdown, args.editor)
    args.lastDocumentKeyRef.current = args.documentKey
    logPasteScrollPropSync({
      path: 'skip-duplicate-hydration',
      documentKey: args.documentKey,
      markdownLength: args.markdown.length,
      pmView: args.editor.view,
    })
    if (import.meta.env.DEV) {
      console.debug('[PM_SKIP_DUPLICATE_HYDRATION]', {
        documentKey: args.documentKey,
        markdownLength: args.markdown.length,
        reason: 'onCreate-owned-initial-hydration',
      })
    }
    return
  }

  if (args.didAtomicVisualBootstrapRef.current) {
    args.syncExternalMarkdownRefs(args.markdown, args.editor)
    args.lastDocumentKeyRef.current = args.documentKey
    args.didAtomicVisualBootstrapRef.current = false
    logPasteScrollPropSync({
      path: 'skip-atomic-bootstrap',
      documentKey: args.documentKey,
      markdownLength: args.markdown.length,
      pmView: args.editor.view,
    })
    return
  }

  // Editor → kernel → props round trip: do not setContent again (resets scroll/selection).
  if (
    args.markdown === args.lastNormalizedExternalMarkdownRef.current &&
    args.lastDocumentKeyRef.current === args.documentKey
  ) {
    args.syncExternalMarkdownRefs(args.markdown, args.editor)
    logPasteScrollPropSync({
      path: 'skip-editor-echo',
      documentKey: args.documentKey,
      markdownLength: args.markdown.length,
      pmView: args.editor.view,
    })
    return
  }

  flushMermaidSourceForSerialize(args.editor)
  const serialized = canonicalMarkdownSemantics.trySerialize(
    args.editor.state.doc,
    args.editor.schema,
  )
  const serializedNormalized = serialized.ok
    ? args.normalizeSerializedMarkdownForSource(serialized.markdown)
    : null
  if (
    serialized.ok &&
    serializedNormalized === args.markdown &&
    args.lastDocumentKeyRef.current === args.documentKey
  ) {
    args.syncExternalMarkdownRefs(args.markdown, args.editor)
    logPasteScrollPropSync({
      path: 'skip-serialized-match',
      documentKey: args.documentKey,
      markdownLength: args.markdown.length,
      pmView: args.editor.view,
    })
    return
  }

  const documentChanged = args.lastDocumentKeyRef.current !== args.documentKey
  const boot = args.atomicVisualDocumentEnterRef.current
  const tabRestore = documentChanged ? args.resolveVisualTabRestore(args.documentKey, boot) : null
  const usedAtomicProp =
    boot != null &&
    tabRestore != null &&
    boot.documentKey === args.documentKey &&
    tabRestore.pmAnchor === boot.pmAnchor &&
    tabRestore.pmHead === boot.pmHead

  if (documentChanged) {
    args.flushMermaidSourceForDocumentSwitch(args.editor)
  }
  if (args.composingRef.current || args.editor.view.composing) {
    logPasteScrollPropSync({
      path: 'skip-composing',
      documentKey: args.documentKey,
      markdownLength: args.markdown.length,
      pmView: args.editor.view,
      detail: { composingRef: args.composingRef.current, pmComposing: args.editor.view.composing },
    })
    return
  }

  args.pointerLinkRef.current = null
  args.clearLinkModifierHint()

  const currentSerialized = canonicalMarkdownSemantics.trySerialize(
    args.editor.state.doc,
    args.editor.schema,
  )
  const currentSerializedNormalized = currentSerialized.ok
    ? args.normalizeSerializedMarkdownForSource(currentSerialized.markdown)
    : null
  const doc = canonicalMarkdownSemantics.parse(args.markdown, args.editor.schema)
  checkBlankContentSuspect('editor-hydrate-set-content', args.documentKey, args.markdown, {
    documentChanged,
    serializedNormalizedLength: serializedNormalized?.length ?? null,
    markdownMatchesSerialized: serializedNormalized === args.markdown,
    currentSerialized: snapshotDocumentBodyMeta(args.documentKey, currentSerializedNormalized),
    previousExternal: snapshotDocumentBodyMeta(args.documentKey, args.lastExternalMarkdownRef.current),
    previousNormalized: snapshotDocumentBodyMeta(
      args.documentKey,
      args.lastNormalizedExternalMarkdownRef.current,
    ),
  })
  if (isTabNavLogEnabled()) {
    logTabNav('editor-hydrate', {
      documentKey: args.documentKey,
      markdown: snapshotDocumentBodyMeta(args.documentKey, args.markdown),
      documentChanged,
      skipPath: 'set-content',
      pmDocSize: doc.content.size,
      serializedNormalizedLength: serializedNormalized?.length ?? null,
      markdownMatchesSerialized: serializedNormalized === args.markdown,
      currentSerialized: snapshotDocumentBodyMeta(args.documentKey, currentSerializedNormalized),
      previousExternal: snapshotDocumentBodyMeta(args.documentKey, args.lastExternalMarkdownRef.current),
      previousNormalized: snapshotDocumentBodyMeta(
        args.documentKey,
        args.lastNormalizedExternalMarkdownRef.current,
      ),
    })
  }
  logPasteScrollPropSync({
    path: 'set-content',
    documentKey: args.documentKey,
    markdownLength: args.markdown.length,
    pmView: args.editor.view,
    detail: {
      documentChanged,
      serializedNormalizedLength: serializedNormalized?.length ?? null,
      markdownMatchesSerialized: serializedNormalized === args.markdown,
    },
  })
  args.hasUserEditedSinceDocumentLoadRef.current = false
  preserveProseMirrorScrollDuring(args.editor, () => {
    args.editor.commands['setContent'](doc, { emitUpdate: false })
  })
  args.syncExternalMarkdownRefs(args.markdown, args.editor)
  args.lastDocumentKeyRef.current = args.documentKey
  args.scheduleVisualTailTrace(args.editor, 'set-content', args.documentKey)
  args.scheduleVisualBlockGapTrace(args.editor, 'set-content', args.documentKey)

  if (documentChanged) {
    args.flushVmTiptapRecorderBatch(args.documentKey)
    args.resetTransactionLog(args.documentKey)
  }
  if (tabRestore) {
    args.applyVisualTabViewportRestore(args.editor, tabRestore)
    if (usedAtomicProp) args.onAtomicVisualDocumentEnterConsumedRef.current?.()
    args.didAtomicVisualBootstrapRef.current = true
  }
  args.onOutlineHeadingsChangeRef.current?.(args.parseHeadingsFromPmDoc(args.editor.state.doc))
}
