import {
  bridgeFindAndSelectText,
  bridgeReplaceSelection,
} from '../../editorMutationBridge'

export function applyGrammarIssueFix(original: string, suggestion: string): boolean {
  const needle = original.trim()
  const replacement = suggestion.trim()
  if (!needle || !replacement) return false
  if (!bridgeFindAndSelectText(needle)) return false
  bridgeReplaceSelection(replacement)
  return true
}
