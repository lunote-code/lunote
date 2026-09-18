export type AiGrammarIssue = {
  id: string
  original: string
  suggestion: string
  reason: string
}

export type ParsedGrammarCheckResponse = {
  issues: AiGrammarIssue[]
}
