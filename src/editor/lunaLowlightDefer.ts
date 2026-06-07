import type { Transaction } from '@tiptap/pm/state'

import { getInputLayerSource, isPasteLayerSource } from './inputLayer/inputLayerPaste'

export const LOWLIGHT_PATCH_BLOCKS_META = 'luna-lowlight-patch-blocks'
export const LOWLIGHT_REFRESH_META = 'luna-lowlight-refresh'

/** Debounce highlight repaint while the caret is actively typing in a code block. */
export const TYPING_HIGHLIGHT_DEBOUNCE_MS = 100
export const LARGE_BLOCK_HIGHLIGHT_DEBOUNCE_MS = 150

/**
 * Whether a doc-changing transaction should defer synchronous hljs repaint.
 * Paste/drop/programmatic refresh still repaint immediately for correct colors.
 */
export function shouldDeferCodeBlockHighlightRepaint(transaction: Transaction): boolean {
  if (!transaction.docChanged) return false
  if (transaction.getMeta(LOWLIGHT_REFRESH_META) === true) return false
  if (transaction.getMeta(LOWLIGHT_PATCH_BLOCKS_META)) return false

  const uiEvent = transaction.getMeta('uiEvent') as string | undefined
  if (uiEvent === 'paste' || uiEvent === 'drop') return false

  const inputSource = getInputLayerSource(transaction)
  if (isPasteLayerSource(inputSource)) return false
  if (inputSource === 'command') return false

  return uiEvent === 'input' || inputSource === 'typing'
}

export function highlightDebounceMsForBlockSize(charCount: number, largeBlockChars: number): number {
  return charCount > largeBlockChars ? LARGE_BLOCK_HIGHLIGHT_DEBOUNCE_MS : TYPING_HIGHLIGHT_DEBOUNCE_MS
}
