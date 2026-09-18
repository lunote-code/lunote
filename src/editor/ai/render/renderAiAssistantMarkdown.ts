import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import {
  matchCalloutFirstLine,
  parseCalloutLeadingParagraph,
  type CalloutKind,
} from '../../lunaCallout'
import { AI_WIKI_LINK_HREF_PREFIX, preprocessAiWikiLinks } from './preprocessAiWikiLinks'

const aiChatMarkdown = MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

aiChatMarkdown.disable(['image', 'hr', 'table', 'html_block', 'html_inline'])

const AI_CHAT_MARKDOWN_PURIFY = {
  USE_PROFILES: { html: true },
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'aside',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-luna-callout', 'data-wiki-target'],
  ALLOW_DATA_ATTR: false,
}

const defaultLinkOpen =
  aiChatMarkdown.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

aiChatMarkdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const href = token.attrGet('href') ?? ''
  if (href.startsWith(AI_WIKI_LINK_HREF_PREFIX)) {
    token.attrSet('href', '#')
    token.attrSet('class', 'ai-wiki-link')
    token.attrSet('data-wiki-target', href.slice(AI_WIKI_LINK_HREF_PREFIX.length))
    return defaultLinkOpen(tokens, idx, options, env, self)
  }
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function calloutKindFromFirstParagraph(text: string): CalloutKind | null {
  const plain = stripHtmlTags(text)
  const led = parseCalloutLeadingParagraph(plain)
  if (led) return led.kind
  return matchCalloutFirstLine(plain)
}

function transformCalloutBlockquotes(html: string): string {
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (match, inner) => {
    const firstParagraph = inner.match(/^\s*<p>([\s\S]*?)<\/p>/i)
    if (!firstParagraph) return match
    const kind = calloutKindFromFirstParagraph(firstParagraph[1])
    if (!kind) return match

    const led = parseCalloutLeadingParagraph(stripHtmlTags(firstParagraph[1]))
    let remainder: string
    if (led && !led.body) {
      remainder = inner.replace(firstParagraph[0], '')
    } else if (led?.body) {
      remainder = inner.replace(firstParagraph[0], `<p>${led.body}</p>`)
    } else {
      remainder = inner.replace(firstParagraph[0], '')
    }

    return `<aside class="md-callout md-callout-${kind} pm-callout pm-callout--${kind} luna-callout-card" data-luna-callout="${kind}">${remainder.trim()}</aside>`
  })
}

export function renderAiAssistantMarkdown(markdown: string): string {
  const trimmed = markdown.trim()
  if (!trimmed) return ''
  const html = transformCalloutBlockquotes(aiChatMarkdown.render(preprocessAiWikiLinks(trimmed)))
  return DOMPurify.sanitize(html, AI_CHAT_MARKDOWN_PURIFY) as string
}
