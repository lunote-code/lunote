import type { AiQuickActionId } from '../actions/aiQuickActions'

function p(...lines: string[]): string {
  return lines.join('\n')
}

type ActionPromptTable = Partial<Record<AiQuickActionId, string>>

const ACTION_PROMPTS: ActionPromptTable = {
  'translate-selection': p(
    'Action output format: Output the translation only—no preamble, postscript, commentary, or explanation.',
    'For translation actions, follow the explicit target language requested by the user message, even if it differs from the source language or the surrounding conversation language.',
    'Preserve Markdown structure, links, inline code, and fenced code blocks.',
  ),
  'auto-format': p(
    'Action output format: Output paste-ready Markdown only—the formatted note body or selection from the first line through the last line, with no preamble or postscript.',
    'Normalize heading levels, list indentation, blank lines between blocks, and fenced code spacing. Preserve meaning, wiki links [[Note Title]], and factual content.',
    'Do not add new sections or commentary.',
  ),
  'grammar-check': p(
    'Action output format: Output a single JSON array only—no markdown fences, preamble, or commentary.',
    'Each item must be an object with keys: "original" (exact substring from the supplied text), "suggestion" (corrected replacement), "reason" (short explanation in the user\'s language).',
    'List only genuine grammar, spelling, punctuation, or clarity issues. Preserve wiki links [[Note Title]] inside suggestions when present in the original.',
    'If no issues are found, output [].',
  ),
  'generate-flowchart': p(
    'Action output format: Output a single paste-ready ```mermaid fenced code block only—no prose, headings, or explanation before or after.',
    'Use flowchart TD or flowchart LR with concise node labels. Reflect processes, steps, or relationships from the supplied note and selection accurately.',
  ),
  'workspace-overview': p(
    'Action output format: Summarize themes, clusters, and notable notes from the supplied workspace search and graph context.',
    'Be concise and factual. Cite notes with [[Exact Note Title]] when referencing them.',
  ),
  'related-to-note': p(
    'Action output format: Use the supplied note, graph neighbors, and workspace context.',
    'Describe how related notes connect. Be concise and factual. Cite with [[Exact Note Title]].',
  ),
}

export function hasActionPrompt(actionId: AiQuickActionId): boolean {
  return actionId in ACTION_PROMPTS
}

export function getActionPrompt(actionId: AiQuickActionId | undefined | null): string | null {
  if (!actionId) return null
  return ACTION_PROMPTS[actionId] ?? null
}
