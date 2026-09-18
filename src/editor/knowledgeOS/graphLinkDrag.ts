import type { NoteGraphNode } from './types'

export function isGraphWikiLinkSourceNode(node: NoteGraphNode): boolean {
  return node.navigable && node.status === 'resolved' && node.id.startsWith('page:')
}

export function isGraphWikiLinkTargetNode(node: NoteGraphNode): boolean {
  return node.status === 'resolved' && node.id.startsWith('page:')
}

export function resolveGraphLinkDropTarget(
  hover: NoteGraphNode | null,
  sourceNodeId: string,
): NoteGraphNode | null {
  if (!hover || hover.id === sourceNodeId) return null
  if (!isGraphWikiLinkTargetNode(hover)) return null
  return hover
}
