import type { Node as PMNode } from 'prosemirror-model'

import type { ModeSwitchLeafPath } from './modeSwitchLeafRow'
import type { HierarchicalSelectionCore } from './modeSwitchSelectionCore'

/** Same shape as the hierarchical reference in `modeSwitchSnapshot`*/
export type ModeSwitchFrozenHierarchicalRef = {
  readonly bufferHash: string
  readonly anchor: HierarchicalSelectionCore
  readonly head: HierarchicalSelectionCore
} | null

/** freeze-time slicing semantic class (IR metadata only; projection does not branch).*/
export type SemanticSliceKind =
  | 'text'
  | 'strong'
  | 'em'
  | 'code'
  | 'strike'
  | 'sup'
  | 'sub'
  | 'link'
  | 'html'
  | 'image'
  | 'task'

/**
 * Freeze semantic token: semantic intra interval + canonical pure payload half-open interval + absolute position within PM (only freeze writing).
 * `semanticFrom`…`semanticTo` (half-open): the same space as `intraBlockOffset`; within a single token
 * `markdownTo - markdownFrom === semanticTo - semanticFrom - 1` (payload length L).
 */
export type FrozenSemanticToken = {
  readonly semanticFrom: number
  readonly semanticTo: number
  readonly markdownFrom: number
  readonly markdownTo: number
  readonly pmFrom: number
  readonly pmToExclusive: number
  readonly kind: SemanticSliceKind
}

/**
 * Frozen mapping of semantic text coordinates (same space as `intraBlockOffset`) to canonical markdown half-open intervals.
 * Only built within freeze; `computeSelection` only does token lookup + constant offset (no ratio).
 */
export type SemanticSlice = FrozenSemanticToken

/** DEV: Additional diagnostics when zip fails (freeze fail-fast).*/
export type SemanticTokenizationError = {
  readonly blockIndex: number
  readonly rowKey?: string
  readonly pmTokenIndex: number
  readonly mdTokenIndex: number
  readonly pmText: string
  readonly mdText: string
  readonly pmKind: SemanticSliceKind
  readonly mdKind: SemanticSliceKind
  readonly canonicalExcerpt: string
}

/**
 * Unique projection substrate: frozen, normalized geometry (with intra scale `semanticExtent`).
 */
export type FrozenGeometryRow = {
  readonly blockIndex: number
  readonly rowId: string
  readonly rowKey: string
  readonly blockPath: ModeSwitchLeafPath
  readonly blockType: string
  readonly bindingResolution?: string
  readonly cmStart: number
  readonly cmEnd: number
  readonly pmStart: number
  readonly pmEnd: number
  /** Freeze is written by PM text ruler; runtime is only used as the upper bound of intra clamp and does not provide type explanation.*/
  readonly semanticExtent: number
  /** Override the semantics of [0, semanticExtent] → markdown frozen slices (ordered, end-to-end)*/
  readonly semanticSlices: readonly SemanticSlice[]
}

export type FrozenStructuralIR = {
  readonly canonicalFingerprint: string
  readonly blocks: readonly FrozenGeometryRow[]
}

export type ModeSwitchSemanticBuildPath =
  | 'fence'
  | 'atomic-container'
  | 'collapsed-atom-carrier'
  | 'zero-payload-structural'
  | 'inline-zip'

export type ModeSwitchSemanticBuildLayer = 'structural_core' | 'precision_adapter'

export type CollapsedAtomSemanticTextReader = (node: PMNode) => string
