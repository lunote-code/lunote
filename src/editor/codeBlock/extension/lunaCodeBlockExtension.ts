import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'

import {
  detectLanguageFromCodeSample,
  normalizeLanguageForLowlight,
  resolveCanonicalLanguageId,
} from '../../lunaCodeLanguages'
import { createCodeBlockClickBelowPlugin } from '../behavior/codeBlockClickBelowPlugin'
import { createCodeBlockTrailingEmptyLinesPlugin } from '../behavior/trailingEmptyLinesPlugin'
import { isCodeBlockCmEnabled } from '../cm/codeBlockCmFeature'
import { debugCodeBlockCmFocus, describeDomTarget } from '../cm/codeBlockCmFocusDebug'
import { createCodeBlockCmInputPlugin } from '../cm/codeBlockCmInputPlugin'
import { LunaCodeBlockView } from '../nodeView/LunaCodeBlockView'
import { lunaCodeBlockAttrDelta, lunaCodeBlockAttrsNeedRerender } from '../nodeView/lunaCodeBlockNodeViewUpdate'

/** Internal experiment: only apply diff related DOM/CSS when it is true; the product UI does not provide a switching entry*/
const ENABLE_EXPERIMENTAL_DIFF = false

export const LunaCodeBlock = CodeBlockLowlight.extend({
  /** Disable automatic codeBlock triggered by VS Code clipboard metadata (input layer disables structure inference)*/
  addProseMirrorPlugins() {
    const parent = this.parent?.() ?? []
    const withoutDefaultLowlight = parent.filter((plugin) => {
      const key = plugin.spec.key
      return !(key instanceof PluginKey && String(key) === 'lowlight$')
    })
    const patched = withoutDefaultLowlight.map((plugin) => {
      if (!plugin.props?.handlePaste) return plugin
      return new Plugin({
        ...plugin.spec,
        props: {
          ...plugin.spec.props,
          handlePaste: () => false,
        },
      })
    })
    const autoDetectLanguageOnPaste = new Plugin({
      props: {
        handlePaste: (view, event) => {
          const { $from } = view.state.selection
          if ($from.parent.type.name !== 'codeBlock') return false
          const nodePos = $from.before()
          const node = view.state.doc.nodeAt(nodePos)
          if (!node || node.type.name !== 'codeBlock') return false

          const currentRaw = String(node.attrs.language ?? '').trim()
          const current = resolveCanonicalLanguageId(currentRaw) ?? currentRaw.toLowerCase()
          const canAutoDetect =
            !current ||
            current === 'text' ||
            current === 'txt' ||
            current === 'plain' ||
            current === 'plaintext'
          if (!canAutoDetect) return false

          const pastedText = event.clipboardData?.getData('text/plain')?.trim() ?? ''
          if (!pastedText) return false
          const detected = detectLanguageFromCodeSample(pastedText)
          if (!detected) return false
          const canonical = normalizeLanguageForLowlight(detected)
          if (!canonical || canonical === current) return false

          view.dispatch(
            view.state.tr.setNodeMarkup(nodePos, node.type, {
              ...node.attrs,
              language: canonical,
            }),
          )
          return false
        },
      },
    })
    const plugins = [
      ...patched,
      autoDetectLanguageOnPaste,
      createCodeBlockTrailingEmptyLinesPlugin(),
      createCodeBlockClickBelowPlugin(this.editor),
    ]
    if (isCodeBlockCmEnabled()) {
      plugins.push(createCodeBlockCmInputPlugin(this.editor))
    }
    return plugins
  },

  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      language: {
        default: this.options.defaultLanguage,
        parseHTML: (element) => {
          const el = element as HTMLElement
          const wrap = el.closest('[data-luna-code-block-wrap]') as HTMLElement | null
          const fromWrap = wrap?.getAttribute('data-language')?.trim()
          if (fromWrap) return fromWrap
          const fromData = el.getAttribute('data-language')?.trim()
          if (fromData) return fromData
          const { languageClassPrefix } = this.options
          if (!languageClassPrefix) return null
          const codeEl: HTMLElement | null =
            el.tagName === 'PRE' ? (el.firstElementChild as HTMLElement | null) : el
          const classNames: string[] = codeEl ? Array.from(codeEl.classList) : []
          const languages = classNames
            .filter((className) => className.startsWith(languageClassPrefix))
            .map((className) => className.replace(languageClassPrefix, ''))
          return languages[0] || null
        },
        rendered: false,
      },
      folded: {
        default: false,
        parseHTML: (element) => {
          const el = element as HTMLElement
          if (el.getAttribute('data-folded') === 'true') return true
          const wrap = el.closest('[data-luna-code-block-wrap]') as HTMLElement | null
          return wrap?.getAttribute('data-folded') === 'true'
        },
        renderHTML: (attrs) => ((attrs as { folded?: boolean }).folded ? { 'data-folded': 'true' } : {}),
      },
      diffMode: {
        default: false,
        parseHTML: (element) => {
          const el = element as HTMLElement
          if (el.getAttribute('data-diff') === 'true') return true
          const wrap = el.closest('[data-luna-code-block-wrap]') as HTMLElement | null
          return wrap?.getAttribute('data-diff') === 'true'
        },
        renderHTML: (attrs) => ((attrs as { diffMode?: boolean }).diffMode ? { 'data-diff': 'true' } : {}),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(LunaCodeBlockView, {
      contentDOMElementTag: 'div',
      /** Align PM node-view updates with LunaCodeBlockView memo: skip updateProps on text-only edits. */
      update: ({ oldNode, newNode, updateProps }) => {
        if (oldNode.type !== newNode.type) return false
        const delta = lunaCodeBlockAttrDelta(
          oldNode.attrs as { language?: string | null; folded?: boolean; diffMode?: boolean },
          newNode.attrs as { language?: string | null; folded?: boolean; diffMode?: boolean },
        )
        if (lunaCodeBlockAttrsNeedRerender(delta)) {
          updateProps()
        }
        return true
      },
      stopEvent: ({ event }) => {
        const t = event.target
        if (!(t instanceof HTMLElement)) return false
        if (t.closest('.luna-code-toolbar, .luna-code-lang-palette')) return true
        const stopped = !!t.closest(
          '.pm-code-block-surface, .pm-code-block-static, .pm-code-block-cm, .pm-code-block-cm-root, .cm-editor, .cm-scroller, .cm-content, .cm-gutters',
        )
        debugCodeBlockCmFocus('nodeview-stopEvent', {
          type: event.type,
          target: describeDomTarget(t),
          stopped,
        })
        return stopped
      },
      ignoreMutation: ({ mutation }) => {
        if (!isCodeBlockCmEnabled()) return false
        const target = mutation.target
        if (!(target instanceof Node)) return false
        const el = target instanceof Element ? target : target.parentElement
        // React owns the entire wrap (CM ↔ static swap on fold). Unignored childList
        // mutations would destroy/recreate the node view and freeze the editor.
        return !!el?.closest('[data-luna-code-block-wrap]')
      },
    })
  },

  renderHTML({ node, HTMLAttributes }) {
    const lang = (node.attrs.language as string | null | undefined) || ''
    const folded = Boolean(node.attrs.folded)
    const diffMode = Boolean(node.attrs.diffMode)
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-language': lang,
        ...(folded ? { 'data-folded': 'true' } : {}),
        ...(ENABLE_EXPERIMENTAL_DIFF && diffMode ? { 'data-diff': 'true' } : {}),
      }),
      [
        'code',
        {
          class: ['hljs', lang ? `${this.options.languageClassPrefix}${lang}` : null].filter(Boolean).join(' '),
        },
        0,
      ],
    ]
  },
})
