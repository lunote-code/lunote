import type { AiChatContext } from '../aiChatTypes'
import { getActionPrompt } from './action-prompts'
import { AI_CHAT_SYSTEM_PROMPT } from './system'
import { getTaskPrompt } from './task-prompts'
import { resolveTaskMode } from './types'

/** Task modes whose output should be paste-ready when the user has a selection. */
export const PASTE_READY_TASK_MODES = new Set(['write', 'rewrite', 'translate', 'summarize'])

const WORKSPACE_BOUNDARY =
  'The sections below are the only workspace note context available for this request. Do not assume, request, or reference content from files not listed here. If context is insufficient, state what is missing—do not invent notes, titles, or quotes.'

const WIKI_LINK_HINT =
  'When referencing notes listed above, use wiki-style links ([[Exact Note Title]]) with titles exactly as shown in context—they are clickable in Lunote.'

const SELECTION_PASTE_READY_HINT =
  'The user has selected text in their note. Output paste-ready Markdown only: substantive content from the first line through the last line, with no preamble or postscript. The output should directly replace or insert into the note.'

function buildWorkspaceContextSections(context: AiChatContext): string[] {
  const contextSections: string[] = []
  if (context.title) contextSections.push(`Note title: ${context.title}`)
  if (context.excerpt) contextSections.push(`Note excerpt:\n${context.excerpt}`)
  if (context.selection) contextSections.push(`User selection:\n${context.selection}`)
  if (context.graphNeighbors?.length) {
    const hopLabel =
      context.graphNeighborMaxHops === 2 ? 'up to 2-hop neighbors' : '1-hop neighbors'
    const lines = context.graphNeighbors.map((neighbor) => {
      if (neighbor.excerpt?.trim()) {
        return `- ${neighbor.title} (${neighbor.path})\n  ${neighbor.excerpt.trim()}`
      }
      return `- ${neighbor.title} (${neighbor.path})`
    })
    contextSections.push(`Linked notes (${hopLabel}):\n${lines.join('\n')}`)
  }
  if (context.workspaceSnippets?.length) {
    const lines = context.workspaceSnippets.map(
      (snippet, index) => `${index + 1}. [${snippet.title}] (${snippet.docKey})\n${snippet.snippet}`,
    )
    contextSections.push(`Related notes from workspace search:\n${lines.join('\n\n')}`)
  }
  if (context.mentionedNotes?.length) {
    const lines = context.mentionedNotes.map(
      (note) => `- [${note.title}] (${note.docKey})\n${note.snippet}`,
    )
    contextSections.push(`Notes referenced in the user's message (@-mentions):\n${lines.join('\n\n')}`)
  }
  return contextSections
}

/**
 * Builds the full system prompt: System + Task + optional hints + Workspace Context.
 */
export function buildAiPrompt(context: AiChatContext): string {
  const taskMode = resolveTaskMode(context.taskMode)
  const sections = [AI_CHAT_SYSTEM_PROMPT, getTaskPrompt(taskMode)]

  const customPrompt = context.customSystemPrompt?.trim()
  if (customPrompt) {
    sections.push(`Additional user instructions:\n${customPrompt}`)
  }
  const actionPrompt = getActionPrompt(context.actionId)
  if (actionPrompt) sections.push(actionPrompt)
  if (context.systemHint) sections.push(context.systemHint)
  if (context.selection?.trim() && PASTE_READY_TASK_MODES.has(taskMode)) {
    sections.push(SELECTION_PASTE_READY_HINT)
  }

  const contextSections = buildWorkspaceContextSections(context)
  if (contextSections.length > 0) {
    sections.push(WORKSPACE_BOUNDARY, ...contextSections)
    if (context.graphNeighbors?.length || context.workspaceSnippets?.length || context.mentionedNotes?.length) {
      sections.push(WIKI_LINK_HINT)
    }
  }

  return sections.join('\n\n')
}
