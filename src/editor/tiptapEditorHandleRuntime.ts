import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { MutableRefObject } from 'react'

import type {
  TiptapEditorCommand,
  TiptapMarkdownEditorHandle,
} from './tiptapEditorTypes'
import { classifyVisualOpFailure, type VisualOpFailureReason } from './visualOpFailure'

type FocusNoScroll = { scrollIntoView: false }

type ActiveBlockTarget = {
  blockType: string
  pos: number
  node: PmNode
}

type RevealHeadingResult = { element: HTMLElement | null; pos: number | null }

type RevealRequest = Parameters<TiptapMarkdownEditorHandle['revealNavigationAnchor']>[0]

type HandleActionsArgs = {
  editor: Editor | null
  focusNoScroll: FocusNoScroll
  markUserEditIntent: () => void
  resolveActiveBlockSelectionTarget: (editor: Editor) => ActiveBlockTarget | null
  hasActiveMarkdownSourceReveal: (editor: Editor) => boolean
  hasActiveMermaidSource: () => boolean
  openMermaidSourceForTarget: (editor: Editor, target: ActiveBlockTarget) => boolean
  startMarkdownBlockSourceReveal: (view: Editor['view'], args: { pos: number }) => boolean
  commitActiveMarkdownSourceReveal: (view: Editor['view']) => boolean
  closeActiveMermaidSource: (editor: Editor) => boolean
  selectedText: (editor: Editor) => string
  serializeSelectedMarkdown: (editor: Editor) => string
  applyPlainTextInsertion: (editor: Editor, text: string) => void
  runTiptapCommand: (editor: Editor, command: TiptapEditorCommand) => boolean
  onUnsupportedVisualOp: (reason: VisualOpFailureReason) => void
}

export function createTiptapEditorHandleActions(
  args: HandleActionsArgs,
): Pick<
  TiptapMarkdownEditorHandle,
  | 'getActiveBlockType'
  | 'hasActiveLocalSourceIsland'
  | 'openSourceIslandForActiveBlock'
  | 'closeSourceIslandForActiveBlock'
  | 'getSelectedText'
  | 'getSelectedMarkdown'
  | 'deleteSelection'
  | 'replaceSelection'
  | 'runCommand'
> {
  return {
    getActiveBlockType() {
      if (!args.editor) return null
      return args.resolveActiveBlockSelectionTarget(args.editor)?.blockType ?? null
    },
    hasActiveLocalSourceIsland() {
      if (!args.editor) return false
      return args.hasActiveMarkdownSourceReveal(args.editor) || args.hasActiveMermaidSource()
    },
    openSourceIslandForActiveBlock() {
      if (!args.editor) return false
      const target = args.resolveActiveBlockSelectionTarget(args.editor)
      if (!target) return false
      if (args.openMermaidSourceForTarget(args.editor, target)) return true
      return args.startMarkdownBlockSourceReveal(args.editor.view, { pos: target.pos })
    },
    closeSourceIslandForActiveBlock() {
      if (!args.editor) return false
      if (args.commitActiveMarkdownSourceReveal(args.editor.view)) return true
      return args.closeActiveMermaidSource(args.editor)
    },
    getSelectedText() {
      if (!args.editor) return ''
      return args.selectedText(args.editor)
    },
    getSelectedMarkdown() {
      if (!args.editor) return ''
      return args.serializeSelectedMarkdown(args.editor)
    },
    deleteSelection() {
      if (!args.editor) return false
      args.markUserEditIntent()
      return args.editor.chain().focus(null, args.focusNoScroll).deleteSelection().run()
    },
    replaceSelection(text: string) {
      if (!args.editor) return false
      args.markUserEditIntent()
      args.applyPlainTextInsertion(args.editor, text)
      args.editor.commands.focus(null, args.focusNoScroll)
      return true
    },
    runCommand(command: TiptapEditorCommand) {
      if (!args.editor) return false
      args.markUserEditIntent()
      const ok = args.runTiptapCommand(args.editor, command)
      if (!ok) args.onUnsupportedVisualOp(classifyVisualOpFailure(args.editor, command))
      return ok
    },
  }
}

type HandleNavigationArgs = {
  editor: Editor | null
  lastDocumentKeyRef: MutableRefObject<string>
  waitAnimationFrame: () => Promise<void>
  findHeadingRevealElement: (editor: Editor, id: string) => RevealHeadingResult
  revealScrollContainer: (editor: Editor) => HTMLElement
  focusEditor: (editor: Editor) => void
  centerRevealElementInContainer: (container: HTMLElement, element: HTMLElement) => number
  highlightRevealElement: (element: HTMLElement) => void
  logRevealAnchorTrace: (message: string, data: Record<string, unknown>) => void
  findBlockRevealElement: (editor: Editor, blockId: string) => HTMLElement | null
  findLineRevealElement: (editor: Editor, line?: number) => HTMLElement | null
  findHeadingPositionInDoc: (doc: Editor['state']['doc'], slug: string) => number | null
}

export function createTiptapEditorHandleNavigation(
  args: HandleNavigationArgs,
): Pick<
  TiptapMarkdownEditorHandle,
  | 'scrollToHeading'
  | 'revealNavigationAnchor'
  | 'getProseMirrorScrollTop'
  | 'getProseMirrorScrollRatio'
  | 'applyMarkdownSelectionAndScroll'
  | 'getNavigationHydrationStatus'
> {
  return {
    scrollToHeading(id: string) {
      if (!args.editor) return false
      const { element, pos } = args.findHeadingRevealElement(args.editor, id)
      if (element == null || pos == null) return false
      const scrollContainer = args.revealScrollContainer(args.editor)
      const pmPos = Math.min(pos + 1, args.editor.state.doc.content.size)
      args.editor.view.dispatch(
        args.editor.state.tr.setSelection(TextSelection.create(args.editor.state.doc, pmPos)),
      )
      args.focusEditor(args.editor)
      void (async () => {
        await args.waitAnimationFrame()
        await args.waitAnimationFrame()
        const scrollTopBefore = scrollContainer.scrollTop
        const centeredScrollTop = args.centerRevealElementInContainer(scrollContainer, element)
        if (Math.abs(centeredScrollTop - scrollTopBefore) < 1) {
          element.scrollIntoView({ block: 'center', behavior: 'auto' })
        }
        args.highlightRevealElement(element)
      })()
      return true
    },
    async revealNavigationAnchor(request: RevealRequest) {
      if (!args.editor) return false
      const scrollContainer = args.revealScrollContainer(args.editor)
      const selector = request.blockId
        ? `[data-block-id="${CSS.escape(request.blockId)}"]`
        : request.headingSlug
          ? `heading:${request.headingSlug}`
          : request.line
            ? `line:${request.line}`
            : 'document'
      args.logRevealAnchorTrace('[reveal-anchor-query]', {
        heading: request.headingSlug ?? null,
        blockId: request.blockId ?? null,
        selector,
        found: false,
        scrollTopBefore: scrollContainer.scrollTop,
        scrollTopAfter: scrollContainer.scrollTop,
      })

      const headingResult = request.headingSlug
        ? args.findHeadingRevealElement(args.editor, request.headingSlug)
        : { element: null, pos: null }
      const element = request.blockId
        ? args.findBlockRevealElement(args.editor, request.blockId)
        : headingResult.element ?? args.findLineRevealElement(args.editor, request.line)
      const found = Boolean(element)
      args.logRevealAnchorTrace('[reveal-anchor-found]', {
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
          ? Math.min(headingResult.pos + 1, args.editor.state.doc.content.size)
          : (() => {
              try {
                const domPos = args.editor!.view.posAtDOM(element, 0)
                return Math.max(1, Math.min(domPos, args.editor!.state.doc.content.size))
              } catch {
                return null
              }
            })()
      if (selectionPos != null) {
        const tr = args.editor.state.tr
          .setSelection(TextSelection.create(args.editor.state.doc, selectionPos))
          .scrollIntoView()
        args.editor.view.dispatch(tr)
      }
      args.focusEditor(args.editor)
      const scrollTopBefore = scrollContainer.scrollTop
      const centeredScrollTop = args.centerRevealElementInContainer(scrollContainer, element)
      if (Math.abs(centeredScrollTop - scrollTopBefore) < 1) {
        element.scrollIntoView({
          block: 'center',
          behavior: 'auto',
        })
      }
      await args.waitAnimationFrame()
      await args.waitAnimationFrame()
      const scrollTopAfter = scrollContainer.scrollTop
      args.logRevealAnchorTrace('[reveal-anchor-scroll]', {
        heading: request.headingSlug ?? null,
        blockId: request.blockId ?? null,
        selector,
        found,
        scrollTopBefore,
        scrollTopAfter,
      })

      args.highlightRevealElement(element)
      args.logRevealAnchorTrace('[reveal-anchor-highlight]', {
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
      if (!args.editor) return null
      const dom = args.editor.view.dom as HTMLElement
      return Number.isFinite(dom.scrollTop) ? dom.scrollTop : null
    },
    getProseMirrorScrollRatio(): number | null {
      if (!args.editor) return null
      const dom = args.editor.view.dom as HTMLElement
      const max = dom.scrollHeight - dom.clientHeight
      if (!Number.isFinite(max) || max <= 0) return 0
      const top = dom.scrollTop
      if (!Number.isFinite(top)) return null
      return Math.max(0, Math.min(1, top / max))
    },
    applyMarkdownSelectionAndScroll(_cmAnchor: number, _cmHead: number) {
      if (import.meta.env.DEV) {
        console.warn(
          '[TiptapMarkdownEditor] applyMarkdownSelectionAndScroll is disabled (hierarchical-only)',
        )
      }
      return false
    },
    getNavigationHydrationStatus(documentKey: string) {
      if (!args.editor) {
        return {
          editorMounted: false,
          pmDocReady: false,
          isHeadingSlugIndexed: () => false,
        }
      }
      const pmDocReady =
        args.lastDocumentKeyRef.current === documentKey && args.editor.state.doc.content.size > 0
      return {
        editorMounted: true,
        pmDocReady,
        isHeadingSlugIndexed: (slug: string) =>
          pmDocReady && args.findHeadingPositionInDoc(args.editor!.state.doc, slug) != null,
      }
    },
  }
}
