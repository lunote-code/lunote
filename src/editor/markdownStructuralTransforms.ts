import { Fragment, type Node as ProseMirrorNode, type ResolvedPos, type Schema } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'

const STANDALONE_TOC_LINE = /^\s*\[toc\]\s*$/iu

type TaskStrip = { checked: boolean; node: ProseMirrorNode }

/**
 * GFM task list: only `[ ]` / `[x]` / `[X]` (exactly one legal character within brackets).
 * `- [ ]foo` without spaces does not count as a task; `- [ ]` without text still counts as unchecked task items.
 */
function stripTaskMarker(item: ProseMirrorNode, schema: Schema): TaskStrip | null {
  if (item.type.name !== 'listItem' || item.childCount === 0) return null
  const first = item.child(0)
  if (first.type.name !== 'paragraph' || first.childCount === 0) return null

  let checked = false
  let stripped = false
  const paraChildren: ProseMirrorNode[] = []
  first.forEach((child) => {
    if (!stripped && child.isText) {
      const text = child.text ?? ''
      const m = text.match(/^\[( |x|X)\](?:\s+(.*))?$/su)
      if (!m) {
        paraChildren.push(child)
        return
      }
      const marker = m[1]
      const rawRest = m[2] ?? ''
      const isChecked = marker !== ' ' && marker.toLowerCase() === 'x'
      stripped = true
      checked = isChecked
      if (rawRest.trim()) paraChildren.push(schema.text(rawRest.trimStart(), child.marks))
      return
    }
    paraChildren.push(child)
  })
  if (!stripped) return null

  const children: ProseMirrorNode[] = [
    first.copy(paraChildren.length > 0 ? Fragment.fromArray(paraChildren) : Fragment.empty),
  ]
  for (let i = 1; i < item.childCount; i += 1) children.push(transformTaskLists(item.child(i), schema))
  return { checked, node: schema.nodes.taskItem.create({ checked }, Fragment.fromArray(children)) }
}

/** Whether a bullet `listItem` still stores the GFM `[ ]` / `[x]` marker in paragraph text. */
export function listItemHasTaskMarker(item: ProseMirrorNode, schema: Schema): boolean {
  return stripTaskMarker(item, schema) !== null
}

export function selectionInTaskItem($from: ResolvedPos): boolean {
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === 'taskItem') return true
  }
  return false
}

function bulletListLooksLikeTaskList(listNode: ProseMirrorNode, schema: Schema): boolean {
  if (listNode.type.name !== 'bulletList' || listNode.childCount === 0) return false
  for (let i = 0; i < listNode.childCount; i += 1) {
    if (listItemHasTaskMarker(listNode.child(i), schema)) return true
  }
  return false
}

/** Task checkbox list in PM, including bullet lists awaiting live-lift promotion. */
export function selectionInTaskLikeList($from: ResolvedPos, schema: Schema): boolean {
  if (selectionInTaskItem($from)) return true
  for (let d = $from.depth; d > 0; d -= 1) {
    const node = $from.node(d)
    if (node.type.name === 'listItem' && listItemHasTaskMarker(node, schema)) return true
    if (node.type.name === 'bulletList' && bulletListLooksLikeTaskList(node, schema)) {
      for (let e = d + 1; e <= $from.depth; e += 1) {
        if ($from.node(e).type.name === 'listItem') return true
      }
    }
  }
  return false
}

function transformTaskLists(node: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const taskList = schema.nodes.taskList
  const taskItem = schema.nodes.taskItem
  if (!taskList || !taskItem) return node

  if ((node.type.name === 'bulletList' || node.type.name === 'orderedList') && node.childCount > 0) {
    const items: ProseMirrorNode[] = []
    for (let i = 0; i < node.childCount; i += 1) {
      const stripped = stripTaskMarker(node.child(i), schema)
      if (!stripped) {
        items.length = 0
        break
      }
      items.push(stripped.node)
    }
    if (items.length === node.childCount) return taskList.create(null, Fragment.fromArray(items))
  }

  if (node.childCount === 0) return node
  const children: ProseMirrorNode[] = []
  for (let i = 0; i < node.childCount; i += 1) children.push(transformTaskLists(node.child(i), schema))
  return node.copy(Fragment.fromArray(children))
}

/** Promote GFM-compliant lists such as `- [ ]` / `1. [x]` to `taskList`. */
export function liftMarkdownTaskLists(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  return transformTaskLists(doc, schema)
}

/**
 * Promote top-level paragraphs containing only `[toc]` into `tocDirective` nodes.
 * This keeps runtime editing aligned with markdown-it parsing semantics.
 */
export function buildLiftStandaloneTocDirectiveTransform(
  doc: ProseMirrorNode,
  schema: Schema,
): Transform | null {
  const tocType = schema.nodes.tocDirective
  const paraType = schema.nodes.paragraph
  if (!tocType || !paraType || doc.type.name !== 'doc') return null

  const hits: { pos: number; size: number }[] = []
  doc.forEach((child, offset) => {
    if (child.type !== paraType) return
    if (child.childCount !== 1) return
    const first = child.child(0)
    if (!first.isText || first.marks.length > 0) return
    if (!STANDALONE_TOC_LINE.test(first.text ?? '')) return
    hits.push({ pos: 1 + offset, size: child.nodeSize })
  })

  if (hits.length === 0) return null

  let tr = new Transform(doc)
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const { pos, size } = hits[i]
    tr = tr.replaceWith(pos, pos + size, tocType.create())
  }
  return tr
}
