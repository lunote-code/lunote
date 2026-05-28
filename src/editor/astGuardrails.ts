export type AstGuardViolationCode =
  | 'footnote_content_contains_prefix'
  | 'footnote_content_contains_escaped_prefix'
  | 'formula_source_empty'
  | 'link_href_invalid'

export type AstGuardViolation = {
  code: AstGuardViolationCode
  message: string
}

export type AstGuardResult<T> = {
  ok: boolean
  value: T
  violations: AstGuardViolation[]
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function sanitizeFootnotePrefix(content: string, label: string): string {
  const escapedPrefix = new RegExp(
    `^\\\\\\[\\^${escapeRegExp(label)}\\\\\\]:\\s?`,
    'u',
  )
  const plainPrefix = new RegExp(`^\\[\\^${escapeRegExp(label)}\\]:\\s?`, 'u')
  let out = content
  out = out.replace(escapedPrefix, '')
  out = out.replace(plainPrefix, '')
  return out
}

export function validateFootnoteAstContent(label: string, content: string): AstGuardResult<string> {
  const violations: AstGuardViolation[] = []
  const raw = content.trimStart()
  const escapedPrefix = new RegExp(`^\\\\\\[\\^[^\\]]+\\\\\\]:`, 'u')
  const plainPrefix = new RegExp(`^\\[\\^[^\\]]+\\]:`, 'u')
  if (escapedPrefix.test(raw)) {
    violations.push({
      code: 'footnote_content_contains_escaped_prefix',
      message: 'Footnote content must not include escaped markdown prefix',
    })
  }
  if (plainPrefix.test(raw)) {
    violations.push({
      code: 'footnote_content_contains_prefix',
      message: 'Footnote content must not include markdown prefix',
    })
  }
  return {
    ok: true,
    value: sanitizeFootnotePrefix(content, label),
    violations,
  }
}

export function validateFormulaSource(next: string, previous: string): AstGuardResult<string> {
  const violations: AstGuardViolation[] = []
  const normalized = next.replace(/\r\n/gu, '\n')
  if (!normalized.trim()) {
    violations.push({
      code: 'formula_source_empty',
      message: 'Formula source must not be empty, fallback to previous source',
    })
    return { ok: false, value: previous, violations }
  }
  return { ok: true, value: normalized, violations }
}

export function normalizeLinkHref(input: string): AstGuardResult<string> {
  const violations: AstGuardViolation[] = []
  const text = input.trim()
  if (/^https?:\/\/\S+$/iu.test(text)) return { ok: true, value: text, violations }
  if (/^www\.\S+$/iu.test(text)) return { ok: true, value: `https://${text}`, violations }
  violations.push({
    code: 'link_href_invalid',
    message: 'Link href is invalid, fallback to placeholder protocol',
  })
  return { ok: false, value: 'https://', violations }
}

export function validateASTBeforeCommit(
  input:
    | { type: 'footnoteDef'; label: string; content: string }
    | { type: 'blockMath'; next: string; previous: string }
    | { type: 'linkHref'; href: string },
): AstGuardResult<string> {
  if (input.type === 'footnoteDef') {
    return validateFootnoteAstContent(input.label, input.content)
  }
  if (input.type === 'blockMath') {
    return validateFormulaSource(input.next, input.previous)
  }
  return normalizeLinkHref(input.href)
}

