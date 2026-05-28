import { BlockMath, InlineMath } from '@tiptap/extension-mathematics'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathBlockView } from '../../components/nodes/MathBlockView'
import { MathInlineView } from '../../components/nodes/MathInlineView'

/** Block level `$$…$$`: React NodeView + `katex.renderToString` cache (see `MathBlockView`)*/
export const LunaBlockMath = BlockMath.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})

/** Inline `$…$`: Same as above*/
export const LunaInlineMath = InlineMath.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView)
  },
})
