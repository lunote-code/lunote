import { getBlockEditingPolicy } from './blockEditingPolicy'

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
  if (context.mainPaneMode === 'source') return 'switch_source_to_visual'
  if (context.activeBlockType === 'codeBlock') return 'suppress_in_code_block'
  if (context.hasActiveLocalSourceIsland) return 'close_local_source_island'
  if (getBlockEditingPolicy(context.activeBlockType).sourceIslandCandidate) {
    return 'open_local_source_island'
  }
  return 'switch_visual_to_source'
}
