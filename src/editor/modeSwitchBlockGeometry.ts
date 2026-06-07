export type ModeSwitchBlockGeometryKind =
  | 'textblock'
  | 'atomic_fence'
  | 'collapsed_atom_carrier'
  | 'zero_payload_structural'
  | 'atomic_container'

/**
 * Single source of truth for freeze/projection geometry strategy.
 *
 * This module is intentionally narrower than `blockEditingPolicy.ts`:
 * - here we only answer "how should this block be frozen/projected numerically?"
 * - we do NOT answer "should the user edit this visually or in source?"
 *
 * `textblock` is the default fallback for normal paragraph-like blocks.
 */
export function getModeSwitchBlockGeometryKind(typeName: string): ModeSwitchBlockGeometryKind {
  switch (typeName) {
    case 'codeBlock':
      return 'atomic_fence'
    case 'rawBlock':
    case 'mermaidBlock':
    case 'blockMath':
    case 'linkReferenceDef':
    case 'tocDirective':
      return 'collapsed_atom_carrier'
    case 'horizontalRule':
      return 'zero_payload_structural'
    case 'table':
      return 'atomic_container'
    default:
      return 'textblock'
  }
}

/**
 * Whether the leaf-row collector should stop descending and treat the node as
 * a standalone projectable leaf, even if it is not a normal PM textblock.
 */
export function isModeSwitchExplicitAtomicLeafType(typeName: string): boolean {
  return getModeSwitchBlockGeometryKind(typeName) !== 'textblock'
}

export function isModeSwitchFenceLikeBlock(typeName: string): boolean {
  return getModeSwitchBlockGeometryKind(typeName) === 'atomic_fence'
}

export function isModeSwitchCollapsedAtomCarrierBlock(typeName: string): boolean {
  return getModeSwitchBlockGeometryKind(typeName) === 'collapsed_atom_carrier'
}

export function isModeSwitchZeroPayloadStructuralBlock(typeName: string): boolean {
  return getModeSwitchBlockGeometryKind(typeName) === 'zero_payload_structural'
}

export function isModeSwitchAtomicContainerBlock(typeName: string): boolean {
  return getModeSwitchBlockGeometryKind(typeName) === 'atomic_container'
}
