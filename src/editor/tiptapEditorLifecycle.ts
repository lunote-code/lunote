import type { MutableRefObject } from 'react'
import type { Editor } from '@tiptap/core'
import { Slice } from '@tiptap/pm/model'
import { TextSelection, type Transaction } from '@tiptap/pm/state'

import { commitEphemeralSessionIfSelectionLeft } from './ephemeralFormatting'
import { CODE_BLOCK_CM_ORIGIN_META } from './codeBlock/cm/codeBlockCmDefer'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import { INPUT_LAYER_SOURCE_META, isPasteLayerSource, type InputLayerSource } from './inputLayer/inputLayerPaste'
import { runAfterReactCommit } from './reactCommitScheduler'
import { debugPasteScroll } from './pasteScrollDebug'
import type { AtomicVisualDocumentEnter } from './tiptapEditorTypes'
import type { PmTocHeading } from './pmHeadingNav'

type TiptapEditorLifecycleArgs = {
  documentKeyRef: MutableRefObject<string>
  markdownRef: MutableRefObject<string>
  hasUserEditedSinceDocumentLoadRef: MutableRefObject<boolean>
  atomicVisualDocumentEnterRef: MutableRefObject<AtomicVisualDocumentEnter | null>
  onAtomicVisualDocumentEnterConsumedRef: MutableRefObject<(() => void) | undefined>
  editorInstanceRef: MutableRefObject<Editor | null>
  didAtomicVisualBootstrapRef: MutableRefObject<boolean>
  pendingInitialHydrationRef: MutableRefObject<{ documentKey: string; markdown: string } | null>
  resolveVisualTabRestore: (
    documentKey: string,
    boot: AtomicVisualDocumentEnter | null,
  ) => AtomicVisualDocumentEnter | null
  applyVisualTabViewportRestore: (editor: Editor, restore: AtomicVisualDocumentEnter) => void
  syncExternalMarkdownRefs: (markdown: string, editor: Editor | null) => void
  lastDocumentKeyRef: MutableRefObject<string>
  flushVmTiptapRecorderBatch: (documentKey: string) => void
  resetTransactionLog: (documentKey: string) => void
  scheduleVisualTailTrace: (editor: Editor, reason: string, documentKey: string) => void
  scheduleVisualBlockGapTrace: (editor: Editor, reason: string, documentKey: string) => void
  scheduleRefreshSlashMenu: (editor: Editor) => void
  refreshWikiLinkMenu: (editor: Editor) => void
  onOutlineHeadingsChangeRef: MutableRefObject<((headings: PmTocHeading[]) => void) | undefined>
  parseHeadingsFromPmDoc: (doc: Editor['state']['doc']) => PmTocHeading[]
  scheduleOutlineHeadingsSync: (editor: Editor) => void
  composingRef: MutableRefObject<boolean>
  scheduleMarkdownSync: (editor: Editor, delay?: number) => void
  bridgeRememberCurrentSelection: () => void
  shouldShowCodeChromeForBlockType: (blockType: string) => boolean
  emitLunaSurface: (payload: { type: 'SET_CODE_CHROME'; active: boolean } | { type: 'SET_ACTIVE_BLOCK'; nodeName: string }) => void
  sidebarListModeRef: MutableRefObject<'files' | 'outline'>
  onActiveHeadingChangeRef: MutableRefObject<(id: string) => void>
  onSelectionActivityRef: MutableRefObject<(() => void) | undefined>
  headingIdBeforeSelection: (editor: Editor) => string
  skipRecordMetaKey: string
  markUserEditIntent: () => void
}

function isUserInitiatedDocTransaction(
  transaction: Transaction,
  hasUserEditedSinceLoad: boolean,
): boolean {
  if (hasUserEditedSinceLoad) return true
  if (transaction.getMeta(CODE_BLOCK_CM_ORIGIN_META)) return true
  const inputLayerSource = transaction.getMeta(INPUT_LAYER_SOURCE_META) as InputLayerSource | undefined
  const uiEvent = transaction.getMeta('uiEvent') as string | undefined
  return (
    uiEvent === 'input' ||
    uiEvent === 'paste' ||
    uiEvent === 'drop' ||
    inputLayerSource === 'typing' ||
    isPasteLayerSource(inputLayerSource)
  )
}

export function createTiptapEditorLifecycleHandlers(args: TiptapEditorLifecycleArgs) {
  return {
    onCreate: ({ editor }: { editor: Editor }) => {
      args.editorInstanceRef.current = editor
      args.didAtomicVisualBootstrapRef.current = false
      args.hasUserEditedSinceDocumentLoadRef.current = false
      const documentKey = args.documentKeyRef.current
      const boot = args.atomicVisualDocumentEnterRef.current
      const tabRestore = args.resolveVisualTabRestore(documentKey, boot)
      const usedAtomicProp =
        boot != null &&
        tabRestore != null &&
        boot.documentKey === documentKey &&
        tabRestore.pmAnchor === boot.pmAnchor &&
        tabRestore.pmHead === boot.pmHead
      const md = args.markdownRef.current
      const newDoc = canonicalMarkdownSemantics.parse(md, editor.schema)
      const oldSize = editor.state.doc.content.size
      let tr = editor.state.tr.replace(0, oldSize, new Slice(newDoc.content, 0, 0))
      tr = tr.setMeta(args.skipRecordMetaKey, true)

      if (tabRestore) {
        const max = tr.doc.content.size
        if (max >= 1) {
          const anchor = Math.max(1, Math.min(Math.round(tabRestore.pmAnchor), max))
          const head = Math.max(1, Math.min(Math.round(tabRestore.pmHead), max))
          try {
            tr = tr.setSelection(TextSelection.create(tr.doc, anchor, head))
          } catch {
            /* documentation only */
          }
        }
        if (usedAtomicProp) args.onAtomicVisualDocumentEnterConsumedRef.current?.()
        args.didAtomicVisualBootstrapRef.current = true
      } else if (tr.doc.content.size >= 1) {
        try {
          tr = tr.setSelection(TextSelection.create(tr.doc, 1))
        } catch {
          /* ignore */
        }
      }

      args.pendingInitialHydrationRef.current = { documentKey, markdown: md }

      runAfterReactCommit(() => {
        if (editor.isDestroyed || !editor.view?.dom) return
        editor.view.dispatch(tr)
        if (tabRestore) {
          args.applyVisualTabViewportRestore(editor, tabRestore)
        }
        args.syncExternalMarkdownRefs(md, editor)
        args.lastDocumentKeyRef.current = documentKey
        args.flushVmTiptapRecorderBatch(documentKey)
        args.resetTransactionLog(documentKey)
        args.scheduleVisualTailTrace(editor, 'on-create', documentKey)
        args.scheduleVisualBlockGapTrace(editor, 'on-create', documentKey)
        args.scheduleRefreshSlashMenu(editor)
        args.refreshWikiLinkMenu(editor)
        args.onOutlineHeadingsChangeRef.current?.(args.parseHeadingsFromPmDoc(editor.state.doc))
        args.onSelectionActivityRef.current?.()
      })
    },
    onUpdate: ({ editor, transaction }: { editor: Editor; transaction: Transaction }) => {
      args.scheduleRefreshSlashMenu(editor)
      args.refreshWikiLinkMenu(editor)
      const inputLayerSource = transaction.getMeta(INPUT_LAYER_SOURCE_META) as InputLayerSource | undefined
      if (transaction.docChanged) {
        args.scheduleOutlineHeadingsSync(editor)
        debugPasteScroll('tiptap-onUpdate-docChanged', {
          steps: transaction.steps.length,
          scrollIntoView:
            Object.prototype.hasOwnProperty.call(transaction, 'scrollIntoView') &&
            (transaction as Transaction & { scrollIntoView?: boolean }).scrollIntoView === true,
          inputLayerSource,
          uiEvent: transaction.getMeta('uiEvent'),
          pmScrollTop: (editor.view.dom as HTMLElement).scrollTop,
        })
      }
      if (!transaction.docChanged) return
      if (transaction.getMeta(args.skipRecordMetaKey)) return
      if (args.composingRef.current || editor.view.composing) return
      if (!isUserInitiatedDocTransaction(transaction, args.hasUserEditedSinceDocumentLoadRef.current)) {
        return
      }
      if (!args.hasUserEditedSinceDocumentLoadRef.current) {
        args.markUserEditIntent()
      }
      const delay =
        isPasteLayerSource(inputLayerSource) || transaction.getMeta('uiEvent') === 'paste'
          ? 0
          : undefined
      args.scheduleMarkdownSync(editor, delay)
    },
    onSelectionUpdate: ({ editor }: { editor: Editor }) => {
      commitEphemeralSessionIfSelectionLeft(editor)
      args.onSelectionActivityRef.current?.()
      args.scheduleRefreshSlashMenu(editor)
      args.refreshWikiLinkMenu(editor)
      args.bridgeRememberCurrentSelection()
      const blockType = editor.state.selection.$from.parent.type.name
      args.emitLunaSurface({
        type: 'SET_CODE_CHROME',
        active: args.shouldShowCodeChromeForBlockType(blockType),
      })
      args.emitLunaSurface({ type: 'SET_ACTIVE_BLOCK', nodeName: blockType })
      if (args.sidebarListModeRef.current !== 'outline') return
      args.onActiveHeadingChangeRef.current(args.headingIdBeforeSelection(editor))
    },
  }
}
