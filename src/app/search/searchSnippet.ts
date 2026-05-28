import DOMPurify from 'dompurify'
import type { Config as DomPurifyConfig } from 'dompurify'

export const SEARCH_SNIPPET_PURIFY: DomPurifyConfig = {
  ALLOWED_TAGS: ['mark'],
  ALLOWED_ATTR: [],
  RETURN_TRUSTED_TYPE: false,
}

export function safeSearchSnippetHtml(snippet: string): string {
  return DOMPurify.sanitize(snippet, SEARCH_SNIPPET_PURIFY) as string
}
