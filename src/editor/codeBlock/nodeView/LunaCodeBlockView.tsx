import type { ReactNodeViewProps } from '@tiptap/react'
import { memo } from 'react'

import { debugCodeBlockCmFocus, isCodeBlockCmFocusDebug } from '../cm/codeBlockCmFocusDebug'
import { CodeBlockNodeController } from './CodeBlockNodeController'
import { lunaCodeBlockAttrDelta, lunaCodeBlockAttrsNeedRerender } from './lunaCodeBlockNodeViewUpdate'

/** Skip React re-render when only in-block text changes; PM still updates contentDOM. */
function lunaCodeBlockViewPropsAreEqual(prev: ReactNodeViewProps, next: ReactNodeViewProps): boolean {
  if (prev.editor !== next.editor) return false
  if (prev.selected !== next.selected) return false
  if (prev.node.type !== next.node.type) return false

  const prevAttrs = prev.node.attrs as {
    language?: string | null
    folded?: boolean
    diffMode?: boolean
  }
  const nextAttrs = next.node.attrs as typeof prevAttrs
  const delta = lunaCodeBlockAttrDelta(prevAttrs, nextAttrs)
  if (lunaCodeBlockAttrsNeedRerender(delta)) {
    const { foldedChanged, languageChanged, diffChanged } = delta
    if (isCodeBlockCmFocusDebug()) {
      debugCodeBlockCmFocus('nodeview-memo-rerender', {
        foldedChanged,
        languageChanged,
        diffChanged,
        prevFolded: Boolean(prevAttrs.folded),
        nextFolded: Boolean(nextAttrs.folded),
      })
    }
    return false
  }

  if (isCodeBlockCmFocusDebug() && prev.node.textContent !== next.node.textContent) {
    debugCodeBlockCmFocus('nodeview-memo-skip-text-only', {
      prevLen: prev.node.textContent.length,
      nextLen: next.node.textContent.length,
    })
  }
  return true
}

export const LunaCodeBlockView = memo(function LunaCodeBlockView(props: ReactNodeViewProps) {
  return <CodeBlockNodeController {...props} />
}, lunaCodeBlockViewPropsAreEqual)
