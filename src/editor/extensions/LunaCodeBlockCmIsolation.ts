import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { debugCodeBlockCmFocus, describeDomTarget } from '../codeBlock/cm/codeBlockCmFocusDebug'
import {
  isCodeBlockCmDom,
  isCodeBlockCmEditableDom,
  isCodeBlockCmGutterDom,
  isCodeBlockToolbarDom,
} from '../codeBlock/cm/codeBlockCmDom'
import { isCodeBlockCmEnabled } from '../codeBlock/cm/codeBlockCmFeature'

const CODE_BLOCK_CM_ISOLATION_KEY = new PluginKey('lunaCodeBlockCmIsolation')

/**
 * Embedded code-block CM: block PM mousedown/pointerdown from moving TextSelection
 * (e.g. caret jumping to document start). CM is registered as a native input separately.
 */
export const LunaCodeBlockCmIsolation = Extension.create({
  name: 'lunaCodeBlockCmIsolation',
  priority: 1310,

  addProseMirrorPlugins() {
    if (!isCodeBlockCmEnabled()) return []
    return [
      new Plugin({
        key: CODE_BLOCK_CM_ISOLATION_KEY,
        props: {
          handleDOMEvents: {
            mousedown(_view, event) {
              const t = event.target as HTMLElement
              if (isCodeBlockToolbarDom(t)) return false
              if (!isCodeBlockCmDom(t)) return false
              if (isCodeBlockCmGutterDom(t)) {
                event.preventDefault()
                debugCodeBlockCmFocus('isolation-mousedown', {
                  target: describeDomTarget(t),
                  action: 'gutter-block-pm-only',
                })
                return true
              }
              if (isCodeBlockCmEditableDom(t)) {
                debugCodeBlockCmFocus('isolation-mousedown', {
                  target: describeDomTarget(t),
                  action: 'content-return-true-no-preventDefault',
                })
                return true
              }
              return true
            },
            pointerdown(_view, event) {
              const t = event.target as HTMLElement
              if (isCodeBlockToolbarDom(t)) return false
              if (!isCodeBlockCmDom(t)) return false
              if (isCodeBlockCmGutterDom(t)) {
                event.preventDefault()
                debugCodeBlockCmFocus('isolation-pointerdown', {
                  target: describeDomTarget(t),
                  action: 'gutter-block-pm-only',
                })
                return true
              }
              if (isCodeBlockCmEditableDom(t)) {
                debugCodeBlockCmFocus('isolation-pointerdown', {
                  target: describeDomTarget(t),
                  action: 'content-return-true-no-preventDefault',
                })
                return true
              }
              return true
            },
          },
        },
      }),
    ]
  },
})
