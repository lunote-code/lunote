import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { isMermaidSourceKeyboardActive } from '../mermaid/mermaidSourceDom'

const MERMAID_KB_ISOLATION_KEY = new PluginKey('lunaMermaidSourceKeyboardIsolation')

/**
 * Mermaid swallows PM keymap when editing source code; Mod-a/c/x is processed by the block-level clipboard layer.
 */
export const LunaMermaidSourceKeyboardIsolation = Extension.create({
  name: 'lunaMermaidSourceKeyboardIsolation',
  priority: 100_000,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: MERMAID_KB_ISOLATION_KEY,
        props: {
          handleKeyDown(_view, event) {
            if (!isMermaidSourceKeyboardActive()) return false
            if (event.isComposing || event.keyCode === 229) return false
            if (event.key === 'Enter') return false
            const mod = event.metaKey || event.ctrlKey
            const key = event.key.toLowerCase()
            if (mod && (key === 'a' || key === 'c' || key === 'x' || key === 'v' || key === 'z' || key === 'y')) {
              return false
            }
            if (event.key === 'Tab') return true
            return false
          },
          handleKeyPress() {
            return false
          },
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    const swallow = () => isMermaidSourceKeyboardActive()
    return {
      Tab: swallow,
      'Shift-Tab': swallow,
      'Mod-z': swallow,
      'Mod-y': swallow,
      'Mod-Shift-z': swallow,
    }
  },
})
