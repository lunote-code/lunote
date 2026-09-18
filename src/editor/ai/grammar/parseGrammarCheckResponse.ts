import { createAiChatMessageId } from '../aiChatTypes'
import type { AiGrammarIssue, ParsedGrammarCheckResponse } from './grammarCheckTypes'

function stripJsonFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) return fenced[1].trim()
  return trimmed
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeIssue(raw: unknown, index: number): AiGrammarIssue | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const original =
    readString(item.original) ??
    readString(item.source) ??
    readString(item.text) ??
    readString(item.before)
  const suggestion =
    readString(item.suggestion) ??
    readString(item.fix) ??
    readString(item.replacement) ??
    readString(item.after)
  if (!original || !suggestion) return null
  if (original === suggestion) return null

  const reason =
    readString(item.reason) ??
    readString(item.explanation) ??
    readString(item.message) ??
    readString(item.note) ??
    ''

  return {
    id: readString(item.id) ?? `grammar-${index + 1}-${createAiChatMessageId()}`,
    original,
    suggestion,
    reason,
  }
}

export function parseGrammarCheckResponse(text: string): ParsedGrammarCheckResponse | null {
  const payload = stripJsonFence(text)
  if (!payload) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { issues?: unknown }).issues)
      ? (parsed as { issues: unknown[] }).issues
      : null
  if (!rows) return null

  const issues: AiGrammarIssue[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const issue = normalizeIssue(rows[index], index)
    if (issue) issues.push(issue)
  }

  return { issues }
}
