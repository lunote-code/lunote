import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { shouldBypassRuntimeForTarget } from '../documentRuntime/nativeInput'

const NATIVE_INPUT_ISOLATION_KEY = new PluginKey('lunaNativeTextInputIsolation')

/**
 * textarea / native input: prohibit PM from taking over pointer, drag, NodeSelection.
 */
export const LunaNativeTextInputIsolation = Extension.create({
  name: 'lunaNativeTextInputIsolation',
  priority: 1300,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: NATIVE_INPUT_ISOLATION_KEY,
        props: {
          handleDOMEvents: {
            mousedown(_view, event) {
              if (!shouldBypassRuntimeForTarget(event.target)) return false
              return false
            },
            pointerdown(_view, event) {
              if (!shouldBypassRuntimeForTarget(event.target)) return false
              return false
            },
            dragstart(_view, event) {
              if (!shouldBypassRuntimeForTarget(event.target)) return false
              event.preventDefault()
              return true
            },
            selectstart(_view, event) {
              if (!shouldBypassRuntimeForTarget(event.target)) return false
              return false
            },
          },
        },
      }),
    ]
  },
})
