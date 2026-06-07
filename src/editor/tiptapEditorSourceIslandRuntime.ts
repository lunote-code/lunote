import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'

import { ensureMermaidBlockIdAtPos } from './extensions/MermaidNode'
import { switchMermaidActiveBlock } from './mermaid/mermaidSourceBlockSwitch'
import {
  flushMermaidBlockSession,
  getActiveMermaidBlockId,
  getMermaidBlockSession,
  getMermaidBlockTab,
  registerMermaidBlockSession,
  setActiveMermaidTab,
} from './mermaid/mermaidSourceStore'

const TI_FOCUS_NO_SCROLL = { scrollIntoView: false as const }

export type ActiveBlockTarget = {
  blockType: string
  pos: number
  node: PmNode
}

export function resolveActiveBlockSelectionTarget(editor: Editor): ActiveBlockTarget | null {
  const { selection } = editor.state
  if (selection instanceof NodeSelection) {
    return { blockType: selection.node.type.name, pos: selection.from, node: selection.node }
  }
  const depth = selection.$from.depth
  if (depth > 0) {
    return {
      blockType: selection.$from.node(depth).type.name,
      pos: selection.$from.before(depth),
      node: selection.$from.node(depth),
    }
  }
  const nodeAtSelection = editor.state.doc.nodeAt(selection.from)
  if (nodeAtSelection) {
    return { blockType: nodeAtSelection.type.name, pos: selection.from, node: nodeAtSelection }
  }
  return null
}

export function openMermaidSourceForTarget(editor: Editor, target: ActiveBlockTarget): boolean {
  if (target.blockType !== 'mermaidBlock') return false
  const attrs = target.node.attrs as { blockId?: string | null; source?: string }
  const blockId = ensureMermaidBlockIdAtPos(editor, target.pos, attrs)
  registerMermaidBlockSession(blockId, target.pos, String(attrs.source ?? ''))
  setActiveMermaidTab(blockId, 'source')
  switchMermaidActiveBlock(editor, blockId, getActiveMermaidBlockId())
  return true
}

export function closeActiveMermaidSource(editor: Editor): boolean {
  const activeBlockId = getActiveMermaidBlockId()
  if (!activeBlockId) return false
  if (!getMermaidBlockSession(activeBlockId)) return false
  if (getMermaidBlockTab(activeBlockId) !== 'source') return false
  flushMermaidBlockSession(editor, activeBlockId, 'explicit')
  setActiveMermaidTab(activeBlockId, 'preview')
  switchMermaidActiveBlock(editor, null, activeBlockId, 'explicit', { skipFlush: true })
  editor.commands.focus(null, TI_FOCUS_NO_SCROLL)
  return true
}

export function hasActiveMermaidSource(): boolean {
  const activeBlockId = getActiveMermaidBlockId()
  if (!activeBlockId) return false
  if (!getMermaidBlockSession(activeBlockId)) return false
  return getMermaidBlockTab(activeBlockId) === 'source'
}
