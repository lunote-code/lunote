import type { TaskMode } from './prompts/types'
import { buildListTransformSystemHint } from './listTransformPrompt'

export const BLOCK_AI_SUPPORTED_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'taskList',
  'callout',
  'table',
  'codeBlock',
] as const

export type BlockAiBlockType = (typeof BLOCK_AI_SUPPORTED_TYPES)[number]

export type BlockAiActionId = 'simplify-block' | 'to-list-block' | 'explain-code-block'

export type BlockAiTargetSnapshot = {
  blockType: BlockAiBlockType
  from: number
  to: number
  blockMarkdown: string
}

const BLOCK_AI_ACTIONS_BY_TYPE: Record<BlockAiBlockType, readonly BlockAiActionId[]> = {
  paragraph: ['simplify-block', 'to-list-block'],
  heading: ['simplify-block', 'to-list-block'],
  blockquote: ['simplify-block', 'to-list-block'],
  bulletList: ['simplify-block', 'to-list-block'],
  orderedList: ['simplify-block', 'to-list-block'],
  taskList: ['simplify-block', 'to-list-block'],
  callout: ['simplify-block', 'to-list-block'],
  table: ['simplify-block', 'to-list-block'],
  codeBlock: ['explain-code-block'],
}

export function listBlockAiActions(blockType: BlockAiBlockType): readonly BlockAiActionId[] {
  return BLOCK_AI_ACTIONS_BY_TYPE[blockType]
}

export function resolveBlockAiApplyMode(actionId: BlockAiActionId): 'replace' | 'insert' {
  return actionId === 'explain-code-block' ? 'insert' : 'replace'
}

export function resolveBlockAiTaskMode(actionId: BlockAiActionId): TaskMode {
  if (actionId === 'explain-code-block') return 'chat'
  return 'rewrite'
}

const BLOCK_AI_ACTION_LABEL_KEYS: Record<BlockAiActionId, string> = {
  'simplify-block': 'editor.blockAi.simplify',
  'to-list-block': 'editor.blockAi.toList',
  'explain-code-block': 'editor.blockAi.explainCode',
}

const BLOCK_AI_ACTION_MESSAGE_KEYS: Record<BlockAiActionId, string> = {
  'simplify-block': 'editor.blockAi.simplify.message',
  'to-list-block': 'editor.blockAi.toList.message',
  'explain-code-block': 'editor.blockAi.explainCode.message',
}

export function blockAiActionLabelKey(actionId: BlockAiActionId): string {
  return BLOCK_AI_ACTION_LABEL_KEYS[actionId]
}

const BLOCK_AI_ACTION_DONE_KEYS: Record<BlockAiActionId, string> = {
  'simplify-block': 'ai.editor.directApply.doneSimplify',
  'to-list-block': 'ai.editor.directApply.doneToList',
  'explain-code-block': 'ai.editor.directApply.doneExplainCode',
}

export function blockAiActionDoneKey(actionId: BlockAiActionId): string {
  return BLOCK_AI_ACTION_DONE_KEYS[actionId]
}

export function buildBlockAiUserMessage(
  actionId: BlockAiActionId,
  blockMarkdown: string,
  t: (key: string) => string,
): string {
  const instruction = t(BLOCK_AI_ACTION_MESSAGE_KEYS[actionId])
  const body = blockMarkdown.trim()
  if (!body) return instruction
  return `${instruction}\n\n---\n\n${body}`
}

export function buildBlockAiSystemHint(actionId: BlockAiActionId): string {
  switch (actionId) {
    case 'simplify-block':
      return 'Action output format: Output paste-ready Markdown for a single block only—no preamble, postscript, or document wrapper. Keep wiki links [[Note Title]] when present. Preserve factual meaning while shortening.'
    case 'to-list-block':
      return buildListTransformSystemHint('block')
    case 'explain-code-block':
      return 'Action output format: Output a short plain-language explanation as Markdown prose (one or two paragraphs). Do not repeat the full code block unless quoting a tiny snippet inline.'
    default:
      return ''
  }
}

export function isBlockAiSupportedType(name: string): name is BlockAiBlockType {
  return (BLOCK_AI_SUPPORTED_TYPES as readonly string[]).includes(name)
}
