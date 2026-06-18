import { Node, mergeAttributes, type Editor } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MermaidView } from '../../components/nodes/MermaidView'
import { isNativeInputDom } from '../documentRuntime/nativeInput'
import { resolveMermaidBlockPos } from '../mermaid/mermaidSourceCommit'

/**
 * Corresponds to Markdown ` ```mermaid ` fences: lifted from `codeBlock` by `markdownDocument.liftMermaidCodeBlocks`,
 * Serialized back to ` ```mermaid\n...\n``` `, guaranteed to be round-trip with CodeMirror source code.
 *
 * Source code editing is in the NodeView slot: see MermaidBlockSourceEditor + MermaidSourceSession.
 */
export function newMermaidBlockId(): string {
  return `mmd-${crypto.randomUUID()}`
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  /** The source code textarea requires native drag selection; block-level drag is handled by PM NodeSelection, and HTML5 node drag is prohibited.*/
  draggable: false,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-block-id') || null,
        renderHTML: (attrs) => {
          const id = (attrs as { blockId?: string | null }).blockId
          return id ? { 'data-block-id': id } : {}
        },
      },
      source: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-source') ?? '',
        renderHTML: (attrs) => ({
          'data-source': String((attrs as { source?: string }).source ?? ''),
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid-block"]',
        getAttrs: (el) => ({
          blockId: (el as HTMLElement).getAttribute('data-block-id') || null,
          source: (el as HTMLElement).getAttribute('data-source') ?? '',
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const blockId = (node.attrs as { blockId?: string | null }).blockId
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'mermaid-block',
        ...(blockId ? { 'data-block-id': blockId } : {}),
        'data-source': String(node.attrs.source ?? ''),
        class: 'pm-mermaid-block',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView, {
      selectedOnTextSelection: false,
      stopEvent: ({ event }) => {
        if (isNativeInputDom(event.target instanceof HTMLElement ? event.target : null)) {
          return true
        }
        const t = event.target
        if (!(t instanceof HTMLElement)) return false
        return !!t.closest('.code-header, .code-block-input, .pm-mermaid-source-panel')
      },
    })
  },
})

export function ensureMermaidBlockId(attrs: { blockId?: string | null; source?: string }): string {
  const existing = String(attrs.blockId ?? '').trim()
  return existing || newMermaidBlockId()
}

export function ensureMermaidBlockIdAtPos(
  editor: Editor,
  pos: number,
  attrs: { blockId?: string | null; source?: string },
): string {
  const existing = String(attrs.blockId ?? '').trim()
  if (existing) return existing
  if (editor.isDestroyed) return ensureMermaidBlockId(attrs)

  const resolved = resolveMermaidBlockPos(editor, pos)
  if (resolved == null) return ensureMermaidBlockId(attrs)

  const node = editor.state.doc.nodeAt(resolved)
  if (!node || node.type.name !== 'mermaidBlock') return ensureMermaidBlockId(attrs)

  const nodeBlockId = String((node.attrs as { blockId?: string | null }).blockId ?? '').trim()
  if (nodeBlockId) return nodeBlockId

  const blockId = newMermaidBlockId()
  editor.view.dispatch(
    editor.view.state.tr.setNodeMarkup(resolved, undefined, { ...node.attrs, blockId }),
  )
  return blockId
}
