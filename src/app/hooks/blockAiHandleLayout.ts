export const BLOCK_AI_HANDLE_WIDTH = 22
export const BLOCK_AI_HANDLE_HEIGHT = 22
export const BLOCK_AI_HANDLE_OFFSET = 6
export const BLOCK_AI_HANDLE_FLIP_LEFT_THRESHOLD = 8
export const BLOCK_AI_HANDLE_INNER_GAP = 4
export const BLOCK_AI_HANDLE_TOP_INSET = 2
export const BLOCK_AI_HANDLE_SHELL_INSET = 4

export type BlockHandlePlacement = 'left' | 'right' | 'above'

export type BlockHandleLayoutInput = {
  shellLeft: number
  shellTop: number
  shellWidth: number
  blockLeft: number
  blockRight: number
  blockTop: number
  /** Paragraph inside listItem/taskItem: left gutter overlaps the list marker column. */
  inListItem?: boolean
}

export type BlockHandleLayout = {
  left: number
  top: number
  placement: BlockHandlePlacement
}

/** True when the block rect is entirely above or below the shell viewport. */
export function isBlockFullyOutsideShellVertically(
  blockTop: number,
  blockBottom: number,
  shellTop: number,
  shellBottom: number,
): boolean {
  return blockBottom <= shellTop || blockTop >= shellBottom
}

function clampLeftToShell(left: number, shellWidth: number): number {
  const maxLeft = shellWidth - BLOCK_AI_HANDLE_WIDTH - BLOCK_AI_HANDLE_SHELL_INSET
  return Math.max(BLOCK_AI_HANDLE_SHELL_INSET, Math.min(left, maxLeft))
}

function fitsInsideRight(insideRight: number, shellWidth: number): boolean {
  return (
    insideRight >= BLOCK_AI_HANDLE_SHELL_INSET &&
    insideRight + BLOCK_AI_HANDLE_WIDTH <= shellWidth - BLOCK_AI_HANDLE_SHELL_INSET
  )
}

/** Prefer left gutter; flip inside block right edge, then above block when clipping risk. */
export function resolveBlockHandleLayout(input: BlockHandleLayoutInput): BlockHandleLayout {
  const leftOfBlock =
    input.blockLeft - input.shellLeft - BLOCK_AI_HANDLE_WIDTH - BLOCK_AI_HANDLE_OFFSET
  const defaultTop = input.blockTop - input.shellTop + BLOCK_AI_HANDLE_TOP_INSET

  if (!input.inListItem && leftOfBlock >= BLOCK_AI_HANDLE_FLIP_LEFT_THRESHOLD) {
    return {
      left: clampLeftToShell(leftOfBlock, input.shellWidth),
      top: defaultTop,
      placement: 'left',
    }
  }

  const insideRight =
    input.blockRight - input.shellLeft - BLOCK_AI_HANDLE_WIDTH - BLOCK_AI_HANDLE_INNER_GAP

  if (fitsInsideRight(insideRight, input.shellWidth)) {
    return {
      left: insideRight,
      top: defaultTop,
      placement: 'right',
    }
  }

  const aboveTop =
    input.blockTop - input.shellTop - BLOCK_AI_HANDLE_HEIGHT - BLOCK_AI_HANDLE_INNER_GAP
  const fallbackLeft = clampLeftToShell(insideRight, input.shellWidth)

  if (aboveTop >= BLOCK_AI_HANDLE_SHELL_INSET) {
    return {
      left: fallbackLeft,
      top: aboveTop,
      placement: 'above',
    }
  }

  return {
    left: fallbackLeft,
    top: defaultTop,
    placement: 'right',
  }
}

/** @deprecated Use {@link resolveBlockHandleLayout} for placement-aware layout. */
export function resolveBlockHandleLeft(input: BlockHandleLayoutInput): number {
  return resolveBlockHandleLayout(input).left
}
