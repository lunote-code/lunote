import type { Editor } from '@tiptap/core'

import { applyCodeBlockTextFromCm, replaceEmptyCodeBlockWithParagraph } from '../cm/codeBlockCmSync'

/**
 * Transitional PM adapter for code-block editing sessions.
 * The controller talks to this adapter instead of dispatching PM transactions directly.
 */
export function commitCodeBlockSessionText(editor: Editor, blockPos: number, text: string): boolean {
  return applyCodeBlockTextFromCm(editor, blockPos, text)
}

export function deleteEmptyCodeBlock(editor: Editor, blockPos: number): boolean {
  return replaceEmptyCodeBlockWithParagraph(editor, blockPos)
}
