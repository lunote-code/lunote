import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { DrawingView } from '../../components/nodes/DrawingView'

/**
 * Markdown ` ```drawing ` fences: lifted from `codeBlock` by `markdownDocument.liftDrawingCodeBlocks`,
 * serialized back to a JSON payload inside the fence.
 */
export function newDrawingBlockId(): string {
  return `drw-${crypto.randomUUID()}`
}

export const DrawingBlock = Node.create({
  name: 'drawingBlock',
  group: 'block',
  atom: true,
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
      width: {
        default: 640,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-width') ?? 640),
        renderHTML: (attrs) => ({
          'data-width': String((attrs as { width?: number }).width ?? 640),
        }),
      },
      height: {
        default: 360,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-height') ?? 360),
        renderHTML: (attrs) => ({
          'data-height': String((attrs as { height?: number }).height ?? 360),
        }),
      },
      originX: {
        default: 0,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-origin-x') ?? 0),
        renderHTML: (attrs) => ({
          'data-origin-x': String((attrs as { originX?: number }).originX ?? 0),
        }),
      },
      originY: {
        default: 0,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-origin-y') ?? 0),
        renderHTML: (attrs) => ({
          'data-origin-y': String((attrs as { originY?: number }).originY ?? 0),
        }),
      },
      strokes: {
        default: '[]',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-strokes') ?? '[]',
        renderHTML: (attrs) => ({
          'data-strokes': String((attrs as { strokes?: string }).strokes ?? '[]'),
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="drawing-block"]',
        getAttrs: (el) => ({
          blockId: (el as HTMLElement).getAttribute('data-block-id') || null,
          width: Number((el as HTMLElement).getAttribute('data-width') ?? 640),
          height: Number((el as HTMLElement).getAttribute('data-height') ?? 360),
          originX: Number((el as HTMLElement).getAttribute('data-origin-x') ?? 0),
          originY: Number((el as HTMLElement).getAttribute('data-origin-y') ?? 0),
          strokes: (el as HTMLElement).getAttribute('data-strokes') ?? '[]',
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const blockId = (node.attrs as { blockId?: string | null }).blockId
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'drawing-block',
        ...(blockId ? { 'data-block-id': blockId } : {}),
        'data-width': String(node.attrs.width ?? 640),
        'data-height': String(node.attrs.height ?? 360),
        'data-origin-x': String(node.attrs.originX ?? 0),
        'data-origin-y': String(node.attrs.originY ?? 0),
        'data-strokes': String(node.attrs.strokes ?? '[]'),
        class: 'pm-drawing-block',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingView, {
      selectedOnTextSelection: false,
      stopEvent: ({ event }) => {
        const t = event.target
        if (!(t instanceof HTMLElement)) return false
        return !!t.closest('.pm-drawing-toolbar, .pm-drawing-canvas-wrap, .pm-drawing-canvas')
      },
    })
  },
})
