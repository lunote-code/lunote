import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'

export type PmCodeBlockScanEntry = {
  blockId: string
  pos: number
  type: 'mermaid' | 'code'
  source: string
}

function readSource(node: PmNode, type: 'mermaid' | 'code'): string {
  if (type === 'mermaid') return String(node.attrs.source ?? '')
  return node.textContent
}

/** Scan the PM document for code/mermaid blocks with blockId*/
export function scanPmCodeBlocks(editor: Editor): PmCodeBlockScanEntry[] {
  const out: PmCodeBlockScanEntry[] = []
  const doc = editor.state.doc

  doc.descendants((node, pos) => {
    if (node.type.name === 'mermaidBlock') {
      const blockId = String((node.attrs as { blockId?: string | null }).blockId ?? '').trim()
      if (!blockId) return
      out.push({ blockId, pos, type: 'mermaid', source: readSource(node, 'mermaid') })
      return false
    }
    if (node.type.name === 'codeBlock') {
      const blockId = String((node.attrs as { blockId?: string | null }).blockId ?? '').trim()
      if (!blockId) return
      out.push({ blockId, pos, type: 'code', source: readSource(node, 'code') })
      return false
    }
  })

  return out
}
