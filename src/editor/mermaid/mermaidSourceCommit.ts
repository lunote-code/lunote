import type { Editor } from '@tiptap/core'

import { CBR_COMMIT_META, type CbrCommitMeta } from '../codeBlockRuntime/bridge/syncGuard'

/** @deprecated use CBR_COMMIT_META*/
export const MERMAID_SOURCE_COMMIT_META = CBR_COMMIT_META

export function resolveMermaidBlockPos(editor: Editor, pos: number): number | null {
  const doc = editor.state.doc
  const node = doc.nodeAt(pos)
  if (node?.type.name === 'mermaidBlock') return pos

  let found: number | null = null
  const from = Math.max(0, pos - 1)
  const to = Math.min(doc.content.size, pos + (node?.nodeSize ?? 1))
  doc.nodesBetween(from, to, (n, p) => {
    if (n.type.name === 'mermaidBlock') found = p
  })
  return found
}

export function readMermaidBlockIdAtPos(editor: Editor, pos: number): string | null {
  const resolved = resolveMermaidBlockPos(editor, pos)
  if (resolved == null) return null
  const node = editor.state.doc.nodeAt(resolved)
  if (!node || node.type.name !== 'mermaidBlock') return null
  const id = String((node.attrs as { blockId?: string | null }).blockId ?? '').trim()
  return id || null
}

/** True when PM still has this blockId at the registered pos (guards cross-document/tab flush). */
export function isMermaidBlockAtPos(editor: Editor, pos: number, blockId: string): boolean {
  if (editor.isDestroyed || !blockId.trim()) return false
  const id = readMermaidBlockIdAtPos(editor, pos)
  return id === blockId
}

export function readMermaidSourceAtPos(editor: Editor, pos: number): string | null {
  const resolved = resolveMermaidBlockPos(editor, pos)
  if (resolved == null) return null
  const node = editor.state.doc.nodeAt(resolved)
  if (!node || node.type.name !== 'mermaidBlock') return null
  return String(node.attrs.source ?? '')
}

export function commitMermaidSourceAtPos(
  editor: Editor,
  pos: number,
  source: string,
  commitId: string,
  cbr?: Pick<CbrCommitMeta, 'blockId' | 'reason'>,
): boolean {
  const resolved = resolveMermaidBlockPos(editor, pos)
  if (resolved == null) return false
  const node = editor.state.doc.nodeAt(resolved)
  if (!node || node.type.name !== 'mermaidBlock') return false
  const nodeBlockId = String((node.attrs as { blockId?: string | null }).blockId ?? '').trim()
  if (cbr?.blockId && nodeBlockId && cbr.blockId !== nodeBlockId) return false
  const prev = String(node.attrs.source ?? '')
  if (prev === source) return true

  const blockId = cbr?.blockId ?? nodeBlockId

  return editor
    .chain()
    .command(({ tr }) => {
      tr.setNodeMarkup(resolved, undefined, { ...node.attrs, source })
      tr.setMeta(CBR_COMMIT_META, {
        from: 'cbr',
        blockId,
        commitId,
        reason: cbr?.reason ?? 'explicit',
      } satisfies CbrCommitMeta)
      return true
    })
    .run()
}