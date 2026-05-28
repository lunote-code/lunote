import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
  useEditorState,
} from '@tiptap/react'
import { memo, useCallback, useMemo } from 'react'
import { buildLiftStandaloneTocDirectiveTransform } from './markdownStructuralTransforms'
import { buildHeadingOutlineTree } from './outlineHeadingTree'
import { DocumentOutlineTree } from '../components/DocumentOutlineTree'
import { activeHeadingSlugBeforePos, findHeadingPositionInDoc, parseHeadingsFromPmDoc } from './pmHeadingNav'

const TOC_LIFT_PLUGIN_KEY = new PluginKey('lunaTocDirectiveTransactionLift')

/**
 * Consistent with `[toc]` on a single line in Markdown (case insensitive, leading and trailing whitespace allowed)
 */
export const TOC_DIRECTIVE_LINE = /^\s*\[toc\]\s*$/iu

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tocDirective: {
      insertTocDirective: () => ReturnType
    }
  }
}

const TocDirectiveNodeView = memo(function TocDirectiveNodeView(props: ReactNodeViewProps) {
  const { editor } = props

  const doc = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed?.state.doc ?? null,
    equalityFn: (a, b) => a === b,
  })

  const selectionFrom = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed?.state.selection.from ?? 0,
    equalityFn: (a, b) => a === b,
  })

  const headings = useMemo(() => (doc ? parseHeadingsFromPmDoc(doc) : []), [doc])

  const tocTree = useMemo(() => buildHeadingOutlineTree(headings), [headings])

  const activeHeadingId = useMemo(
    () => (doc ? activeHeadingSlugBeforePos(doc, selectionFrom) : ''),
    [doc, selectionFrom],
  )

  const onNavigate = useCallback(
    (id: string) => {
      if (!editor) return
      const pos = findHeadingPositionInDoc(editor.state.doc, id)
      if (pos == null) return
      const { doc: d } = editor.state
      const tr = editor.state.tr
        .setSelection(TextSelection.create(d, Math.min(pos + 1, d.content.size)))
        .scrollIntoView()
      editor.view.dispatch(tr)
      editor.commands.focus()
    },
    [editor],
  )

  return (
    <NodeViewWrapper
      as="div"
      className="inline-doc-toc"
      data-type="toc-directive"
      contentEditable={false}
      spellCheck={false}
      aria-label="Documentation table of contents [toc]"
    >
      <div className="inline-doc-toc-inner">
        <div className="inline-doc-toc-label">Contents</div>
        {headings.length === 0 ? (
          <p className="inline-doc-toc-empty">
            Add <code># </code> headings and jump links will appear here.
          </p>
        ) : (
          <nav className="inline-doc-toc-nav" aria-label="directory entry">
            <DocumentOutlineTree nodes={tocTree} activeId={activeHeadingId} onJump={onNavigate} />
          </nav>
        )}
      </div>
    </NodeViewWrapper>
  )
})

/**
 * Directory placeholder used by tools such as Typora; there must be a corresponding node in the document model, otherwise the Markdown round-trip will be lost.
 */
export const TocDirective = Node.create({
  name: 'tocDirective',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: TOC_LIFT_PLUGIN_KEY,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null
          const lift = buildLiftStandaloneTocDirectiveTransform(newState.doc, newState.schema)
          if (!lift || lift.steps.length === 0) return null
          const tr = newState.tr
          for (let i = 0; i < lift.steps.length; i += 1) tr.step(lift.steps[i])
          if (import.meta.env.DEV) {
            const transactionId = transactions[transactions.length - 1]?.time ?? 0
            const headingCount = parseHeadingsFromPmDoc(tr.doc).length
            console.warn('[TOC_REFRESH]', {
              docChanged: true,
              headingCount,
              tocDetected: true,
              transactionId,
            })
          }
          return tr
        },
      }),
    ]
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toc-directive"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toc-directive',
        class: 'inline-doc-toc inline-doc-toc-fallback',
        spellcheck: 'false',
      }),
      ['span', { class: 'inline-doc-toc-fallback-text' }, '[toc]'],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocDirectiveNodeView)
  },

  addCommands() {
    return {
      insertTocDirective:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    }
  },
})
