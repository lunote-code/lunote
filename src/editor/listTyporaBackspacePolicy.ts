import type { EditorState } from '@tiptap/pm/state'

export function hasSiblingListItemBefore(state: EditorState): boolean {
  const { $anchor } = state.selection
  const $targetPos = state.doc.resolve($anchor.pos - 2)
  if ($targetPos.index() === 0) return false
  return $targetPos.nodeBefore?.type.name === 'listItem'
}

export function previousSiblingListItemHasNestedListItem(state: EditorState): boolean {
  const listItemType = state.schema.nodes.listItem
  if (!listItemType) return false

  const { $anchor } = state.selection
  const $targetPos = state.doc.resolve($anchor.pos - 2)
  const previous = $targetPos.nodeBefore
  if (!previous || previous.type.name !== 'listItem') return false

  let nested = false
  previous.descendants((child) => {
    if (child.type === listItemType) nested = true
  })
  return nested
}

/** Whether Backspace on an empty list item may join backward into the previous sibling. */
export function shouldJoinEmptyListItemBackward(state: EditorState): boolean {
  return hasSiblingListItemBefore(state) && !previousSiblingListItemHasNestedListItem(state)
}
