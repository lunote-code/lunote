export {
  buildCodeBlockLineModel,
  codeBlockGutterLineCount,
  computeLineStarts,
  countCodeBlockLogicalLines,
  countCodeBlockLogicalLinesFromText,
  countDocumentLinesFromText,
  lineIndexFromCharOffset,
  lineIndexFromVisibleCharOffset,
  normalizeCodeBlockText,
  type CodeBlockLineModel,
} from './model/lineModel'

export { toggleCodeBlockWithFocusAndLog } from './behavior/toggleWithFocus'
export {
  getTextblockLineDocRange,
  insertCodeBlockAtRange,
  normalizeCodeBlockInsertText,
  resolveInsertCodeBlockRange,
  type InsertCodeBlockRange,
} from './behavior/toggle'
export {
  LunaCodeBlockNav,
  codeBlockStartDocPos,
  exitCodeBlockBackward,
  exitCodeBlockForward,
  focusCodeBlockLangInput,
  isAtCodeBlockFirstLineStart,
  isAtCodeBlockLastLineEnd,
} from './behavior/nav'
export { LunaCodeFenceGuard } from './behavior/fenceGuard'
export {
  collapseCodeBlockTrailingEmptyLines,
  collapseCodeBlockTrailingEmptyLinesOnEdit,
  collapseCodeBlockTrailingEmptyLinesOnLoad,
  countNonEmptyLines,
  countTrailingEmptyLines,
  MAX_ALL_EMPTY_BLOCK_NEWLINES,
  MAX_CODE_BLOCK_TRAILING_EMPTY_LINES,
  normalizeCodeBlockTrailingEmptyLinesInDoc,
  shouldRejectCodeBlockEnterNewline,
  splitCodeBlockLines,
} from './behavior/trailingEmptyLines'
export { createCodeBlockTrailingEmptyLinesPlugin } from './behavior/trailingEmptyLinesPlugin'
export { LunaCodeBlock } from './extension/lunaCodeBlockExtension'
export {
  computeCodeBlockInputPolicy,
  createCodeBlockBoundarySession,
  resolveCodeBlockInputPolicy,
  resolveCodeBlockInputPolicyFromView,
  shouldPmDelegateCodeBlockInputToCm,
  shouldPmRedirectFoldedCodeBlockKeyboard,
  useCodeBlockBoundary,
  type CodeBlockBoundarySession,
  type CodeBlockBoundarySnapshot,
  type CodeBlockInputPolicy,
} from './boundary'
export {
  caretLineInCodeBlock,
  codeBlockNodeAt,
  resolveCodeBlockTextRange,
  resolveOwnedCodeBlockPos,
  selectionInCodeBlockAt,
  type CodeBlockTextRange,
} from './behavior/selection'
