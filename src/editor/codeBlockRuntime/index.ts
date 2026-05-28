export type { CodeBlockMode, CodeBlockRuntime, CodeBlockRuntimeSnapshot, CodeBlockType } from './types'
export {
  clearCodeBlockRuntime,
  applyBlockDraftFromPm,
  focusBlock,
  getBlock,
  getBlockMode,
  getCodeBlockRuntimeSnapshot,
  getFocusedBlockId,
  registerBlock,
  removeBlock,
  setBlockDirty,
  setBlockLayout,
  setBlockMode,
  subscribeCodeBlockRuntime,
  updateBlockDraft,
} from './codeBlockRuntimeStore'
export * from './bridge'
export * from './kernel'
export * from './collab'
export { useCodeBlock, useCodeBlockDraft, useCodeBlockMode } from './useCodeBlock'

/** Source code textarea identification class (non-Portal, only DOM/clipboard boundary)*/
export const CODE_BLOCK_INPUT_CLASS = 'code-block-input'
