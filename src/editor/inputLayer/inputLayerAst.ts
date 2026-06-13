import type { Node as ProseMirrorNode } from 'prosemirror-model'

export type NodeTypeCounts = Record<string, number>

export function countNodesByType(doc: ProseMirrorNode, typeName?: string): NodeTypeCounts {
  const counts: NodeTypeCounts = {}
  doc.descendants((node) => {
    const name = node.type.name
    if (typeName && name !== typeName) return
    counts[name] = (counts[name] ?? 0) + 1
  })
  return counts
}

export function countNodeType(doc: ProseMirrorNode, typeName: string): number {
  return countNodesByType(doc, typeName)[typeName] ?? 0
}

export function collectNodeTypes(doc: ProseMirrorNode, typeNames: readonly string[]): Set<string> {
  const found = new Set<string>()
  doc.descendants((node) => {
    if (typeNames.includes(node.type.name)) found.add(node.type.name)
  })
  return found
}

export function assertNoPasteStructuralInjection(
  before: ProseMirrorNode,
  after: ProseMirrorNode,
  opts?: { allowRichStructure?: boolean; allowListMultiline?: boolean },
): void {
  const forbidden = ['codeBlock', 'mermaidBlock'] as const
  for (const typeName of forbidden) {
    const beforeCount = countNodeType(before, typeName)
    const afterCount = countNodeType(after, typeName)
    if (afterCount > beforeCount) {
      throw new Error(
        `Invalid paste transformation: ${typeName} count increased (${beforeCount} → ${afterCount}); structural paste inference is forbidden`,
      )
    }
  }

  if (opts?.allowRichStructure) return

  const paraBefore = countNodeType(before, 'paragraph')
  const paraAfter = countNodeType(after, 'paragraph')
  if (paraAfter > paraBefore) {
    if (opts?.allowListMultiline) {
      const listItemBefore = countNodeType(before, 'listItem')
      const listItemAfter = countNodeType(after, 'listItem')
      if (listItemAfter > listItemBefore && listItemAfter - listItemBefore === paraAfter - paraBefore) {
        return
      }
    }
    throw new Error(
      `Invalid paste transformation: paragraph count increased (${paraBefore} → ${paraAfter}); paste must be plain text insert only`,
    )
  }
}
