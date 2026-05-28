import { Extension } from '@tiptap/core'

/**
 * During composition, the inline format shortcut keys are swallowed to avoid competing with the IME for the Mod key or accidentally touching toggleMark.
 * High priority, prior to StarterKit's Bold/Italic/Code/Strike bindings.
 */
export const LunaImeSwallowMarkShortcuts = Extension.create({
  name: 'lunaImeSwallowMarkShortcuts',

  priority: 3000,

  addKeyboardShortcuts() {
    const swallow = ({ editor }: { editor: { view: { composing: boolean } } }) => editor.view.composing
    return {
      'Mod-b': swallow,
      'Mod-i': swallow,
      'Mod-`': swallow,
      'Mod-Shift-s': swallow,
    }
  },
})
