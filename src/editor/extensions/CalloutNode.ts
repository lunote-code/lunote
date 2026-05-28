import { ReactNodeViewRenderer } from '@tiptap/react'
import { CalloutView } from '../../components/nodes/CalloutView'
import { LunaCallout } from '../lunaCallout'

/**
 * GitHub/Obsidian-style callout: `> [!NOTE]` etc. lifted by `markdownDocument.liftTyporaCallouts`;
 * React NodeView is responsible for icons, theme colors and folding UI; serialization still uses `calloutFirstLineForKind`.
 */
export const CalloutNode = LunaCallout.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})
