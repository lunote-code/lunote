import type { RefObject } from 'react'
import { parseFrontmatter } from '../../knowledgeRuntime/wikiLinkParser'
import type { TiptapMarkdownEditorHandle } from '../../TiptapMarkdownEditor'
import {
  AI_CHAT_EXCERPT_MAX_CHARS,
  AI_CHAT_SELECTION_MAX_CHARS,
  type AiChatContext,
} from '../aiChatTypes'
import { readAiEditorSelectionText } from './readAiEditorSelection'

export type BuildAiContextInput = {
  docKey: string | null
  activePath: string | null
  activeTabLabel?: string | null
  content: string
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
}

function basenameWithoutExtension(path: string): string {
  const name = path.split(/[/\\]/).pop() ?? path
  return name.replace(/\.[^.]+$/, '')
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}…`
}

export function buildAiContext(input: BuildAiContextInput): AiChatContext {
  const title =
    input.activeTabLabel?.trim() ||
    (input.activePath ? basenameWithoutExtension(input.activePath) : null)
  const body = input.activePath ? parseFrontmatter(input.content).body : input.content
  const excerpt = body.trim() ? truncate(body.trim(), AI_CHAT_EXCERPT_MAX_CHARS) : null
  const rawSelection = readAiEditorSelectionText(input.visualEditorRef)
  const selection = rawSelection ? truncate(rawSelection, AI_CHAT_SELECTION_MAX_CHARS) : null

  return {
    docKey: input.docKey,
    title,
    excerpt,
    selection,
  }
}
