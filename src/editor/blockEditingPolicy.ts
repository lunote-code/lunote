export type BlockEditingPreference = 'visual_preferred' | 'source_preferred'

export type BlockEditingClassification =
  | 'visual_preferred'
  | 'source_preferred'
  | 'source_island_candidate'

export type BlockTabBehavior = 'plain_text' | 'native'

export type BlockEditingPolicy = {
  readonly blockType: string
  readonly primaryPreference: BlockEditingPreference
  readonly sourceIslandCandidate: boolean
  readonly tabBehavior: BlockTabBehavior
  readonly showCodeChrome: boolean
}

/**
 * Runtime editing policy for a block type.
 *
 * This is intentionally independent from freeze/projection geometry:
 * - `modeSwitchBlockGeometry.ts` decides how a block maps across PM/Markdown space
 * - this module decides editor UX such as local source islands, tab handling,
 *   and whether the block is visually or source oriented
 *
 * A block may therefore be geometrically "atomic" while still being treated as
 * a normal non-island editing surface, or vice versa.
 */

const DEFAULT_BLOCK_EDITING_POLICY: BlockEditingPolicy = Object.freeze({
  blockType: 'unknown',
  primaryPreference: 'visual_preferred',
  sourceIslandCandidate: false,
  tabBehavior: 'native',
  showCodeChrome: false,
})

const BLOCK_EDITING_POLICIES: readonly BlockEditingPolicy[] = Object.freeze([
  {
    blockType: 'paragraph',
    primaryPreference: 'visual_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'plain_text',
    showCodeChrome: false,
  },
  {
    blockType: 'heading',
    primaryPreference: 'visual_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'plain_text',
    showCodeChrome: false,
  },
  {
    blockType: 'blockquote',
    primaryPreference: 'visual_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'plain_text',
    showCodeChrome: false,
  },
  {
    blockType: 'callout',
    primaryPreference: 'visual_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'plain_text',
    showCodeChrome: false,
  },
  {
    blockType: 'definitionTerm',
    primaryPreference: 'visual_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'plain_text',
    showCodeChrome: false,
  },
  {
    blockType: 'definitionDescription',
    primaryPreference: 'visual_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'plain_text',
    showCodeChrome: false,
  },
  {
    blockType: 'table',
    primaryPreference: 'visual_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'native',
    showCodeChrome: false,
  },
  {
    blockType: 'codeBlock',
    primaryPreference: 'visual_preferred',
    sourceIslandCandidate: true,
    tabBehavior: 'native',
    showCodeChrome: true,
  },
  {
    blockType: 'mermaidBlock',
    primaryPreference: 'source_preferred',
    sourceIslandCandidate: true,
    tabBehavior: 'native',
    showCodeChrome: true,
  },
  {
    blockType: 'blockMath',
    primaryPreference: 'source_preferred',
    sourceIslandCandidate: true,
    tabBehavior: 'native',
    showCodeChrome: true,
  },
  {
    blockType: 'rawBlock',
    primaryPreference: 'source_preferred',
    sourceIslandCandidate: true,
    tabBehavior: 'native',
    showCodeChrome: true,
  },
  {
    blockType: 'footnoteDef',
    primaryPreference: 'source_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'native',
    showCodeChrome: false,
  },
  {
    blockType: 'linkReferenceDef',
    primaryPreference: 'source_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'native',
    showCodeChrome: false,
  },
  {
    blockType: 'tocDirective',
    primaryPreference: 'source_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'native',
    showCodeChrome: false,
  },
  {
    blockType: 'horizontalRule',
    primaryPreference: 'source_preferred',
    sourceIslandCandidate: false,
    tabBehavior: 'native',
    showCodeChrome: false,
  },
])

const BLOCK_EDITING_POLICY_MAP = new Map(
  BLOCK_EDITING_POLICIES.map((policy) => [policy.blockType, Object.freeze(policy)]),
)

export function getBlockEditingPolicy(blockType: string | null | undefined): BlockEditingPolicy {
  if (!blockType) return DEFAULT_BLOCK_EDITING_POLICY
  return BLOCK_EDITING_POLICY_MAP.get(blockType) ?? { ...DEFAULT_BLOCK_EDITING_POLICY, blockType }
}

export function classifyBlockEditing(blockType: string | null | undefined): BlockEditingClassification {
  const policy = getBlockEditingPolicy(blockType)
  // `source_island_candidate` is a runtime UX affordance, not a freeze geometry kind.
  if (policy.sourceIslandCandidate) return 'source_island_candidate'
  return policy.primaryPreference
}

export function isPlainTextTabBlockType(blockType: string | null | undefined): boolean {
  return getBlockEditingPolicy(blockType).tabBehavior === 'plain_text'
}

export function shouldShowCodeChromeForBlockType(blockType: string | null | undefined): boolean {
  return getBlockEditingPolicy(blockType).showCodeChrome
}

export function listBlockEditingPolicies(): readonly BlockEditingPolicy[] {
  return BLOCK_EDITING_POLICIES
}
