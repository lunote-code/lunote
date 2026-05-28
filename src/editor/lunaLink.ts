import Link, { isAllowedUri } from '@tiptap/extension-link'
import { mergeAttributes } from '@tiptap/core'
import { isLunaAssetHref } from '../assets/markdownLinkTransformer'
import { lunaAssetLinkClassForKind, type LunaAssetFileKind } from '../assets/lunaAssetFileKind'
import { ensureLunaLinkifyProtocols } from './lunaLinkifyProtocols'

/**
 * The DOM of the inline `link` mark is `<a href>`. Tiptap will not `window.open` when `openOnClick: false`,
 * But the webview/browser will still perform the default navigation of `<a>` on **click**, which must be on `editorProps.handleDOMEvents.click`
 * (`TiptapMarkdownEditor`) `preventDefault` + check `link` mark, and only Cmd/Ctrl+Click
 * `openExternalUrlInSystemBrowser`。
 */
const MAILTO_TOOLTIP = 'Send email'

function isMailtoHref(href: string | null | undefined): boolean {
  return typeof href === 'string' && /^mailto:/iu.test(href.trim())
}

const LUNA_ASSET_KINDS = new Set<LunaAssetFileKind>(['pdf', 'word', 'zip', 'image', 'file'])

function assetKindFromAttrs(HTMLAttributes: Record<string, unknown>): LunaAssetFileKind {
  const fromData = HTMLAttributes['data-luna-asset-ext']
  if (typeof fromData === 'string' && fromData.trim()) {
    const kind = fromData.trim() as LunaAssetFileKind
    if (LUNA_ASSET_KINDS.has(kind)) return kind
  }
  return 'file'
}

/**
 * Enhanced `mailto:` / `luna-asset:` links (icon + tooltip) in WYSIWYG, the behavior is distinguished from external links.
 */
export const LunaLink = Link.extend({
  name: 'link',

  onCreate() {
    ensureLunaLinkifyProtocols()
    if (this.options.validate && !this.options.shouldAutoLink) {
      this.options.shouldAutoLink = this.options.validate
      if (import.meta.env.DEV) {
        console.warn(
          '[LunaLink] The `validate` option is deprecated. Rename to the `shouldAutoLink` option instead.',
        )
      }
    }
  },

  /** Do not call linkify `reset()`, otherwise `registerCustomProtocol` will warn you repeatedly after remounting*/
  onDestroy() {},

  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title'),
        renderHTML: (attributes) => {
          const t = attributes.title
          if (t == null || t === '') return {}
          return { title: String(t) }
        },
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    if (
      !this.options.isAllowedUri(HTMLAttributes.href, {
        defaultValidate: (href: string) => !!isAllowedUri(href, this.options.protocols),
        protocols: this.options.protocols,
        defaultProtocol: this.options.defaultProtocol,
      })
    ) {
      return ['a', mergeAttributes(this.options.HTMLAttributes, { ...HTMLAttributes, href: '' }), 0]
    }

    const merged = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
    const href = String(merged.href ?? '')

    if (isMailtoHref(href)) {
      const cls = String(merged.class ?? '').trim()
      const nextClass = cls.includes('pm-link-mail') ? cls : `${cls} pm-link-mail`.trim()
      return [
        'a',
        {
          ...merged,
          class: nextClass,
          title: merged.title != null && merged.title !== '' ? merged.title : MAILTO_TOOLTIP,
          'data-luna-mail': '1',
        },
        0,
      ]
    }

    if (isLunaAssetHref(href)) {
      const kind = assetKindFromAttrs(merged as Record<string, unknown>)
      const kindClass = lunaAssetLinkClassForKind(kind)
      const cls = String(merged.class ?? '').trim()
      const nextClass = cls.includes('pm-link-asset') ? cls : `${cls} ${kindClass}`.trim()
      const { title: _omitTitle, ...rest } = merged
      void _omitTitle
      return [
        'a',
        {
          ...rest,
          class: nextClass,
          'data-luna-asset': '1',
          'data-luna-asset-ext': kind,
        },
        0,
      ]
    }

    const title =
      merged.title != null && String(merged.title).trim() !== '' ? String(merged.title).trim() : undefined
    return [
      'a',
      {
        ...merged,
        ...(title ? { title } : {}),
      },
      0,
    ]
  },
})
