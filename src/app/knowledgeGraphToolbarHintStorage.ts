export const KNOWLEDGE_GRAPH_TOOLBAR_HINT_STORAGE_KEY = 'luna:knowledge-graph-toolbar-hint.dismissed'

export function isKnowledgeGraphToolbarHintDismissed(): boolean {
  try {
    return localStorage.getItem(KNOWLEDGE_GRAPH_TOOLBAR_HINT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissKnowledgeGraphToolbarHint(): void {
  try {
    localStorage.setItem(KNOWLEDGE_GRAPH_TOOLBAR_HINT_STORAGE_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}
