import type { Editor } from '@tiptap/core'

import { newDrawingBlockId } from '../extensions/DrawingNode'

export function createDrawingBlockInsertContent(blockId?: string) {
  return [
    {
      type: 'drawingBlock',
      attrs: {
        blockId: blockId ?? newDrawingBlockId(),
        width: 640,
        height: 360,
        strokes: '[]',
      },
    },
    { type: 'paragraph' },
  ] as const
}

export function insertDrawingBlock(editor: Editor, focusNoScroll = { scrollIntoView: false }): boolean {
  return editor
    .chain()
    .focus(null, focusNoScroll)
    .insertContent([...createDrawingBlockInsertContent()])
    .run()
}
