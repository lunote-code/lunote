export type ModeToggleCommandActionKind =
  | 'close_local_source_island'
  | 'open_local_source_island'
  | 'switch_visual_to_source'
  | 'switch_source_to_visual'
  | 'suppress_in_code_block'

export type ModeToggleCommandDecisionContext = {
  readonly mainPaneMode: 'visual' | 'source'
  readonly activeBlockType: string | null
  readonly hasActiveLocalSourceIsland: boolean
}

export function decideModeToggleCommandAction(
  context: ModeToggleCommandDecisionContext,
): ModeToggleCommandActionKind {
  // Cmd+/ always toggles the document pane. Local islands stay click/UI only so
  // Mermaid, math, and raw HTML are not trapped away from full source.
  if (context.mainPaneMode === 'source') return 'switch_source_to_visual'
  return 'switch_visual_to_source'
}
