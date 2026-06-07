import { type Editor } from '@tiptap/core'
import type { WikiLinkSuggestItem } from './lunaWikiLinkSuggest'

export type SlashCommandLeaf = {
  id: string
  label: string
  aliases: string[]
  /** Use the command id of the manifest / Command VM; you must await when using the slash menu.*/
  manifestCommandId?: string
  run: (editor: Editor) => boolean
}

export type SlashCommandItem =
  | SlashCommandLeaf
  | {
      id: string
      label: string
      aliases: string[]
      children: SlashCommandLeaf[]
    }

export type SlashMenuRow = {
  id: string
  label: string
  depth: number
  executable: boolean
  manifestCommandId?: string
  run?: (editor: Editor) => boolean
}

export type SlashMenuState = {
  from: number
  to: number
  query: string
  left: number
  top: number
  placement: 'above' | 'below'
  maxHeight?: number
  rows: SlashMenuRow[]
  activeIndex: number
}

export type WikiLinkMenuState = {
  replaceFrom: number
  replaceTo: number
  embed: boolean
  query: string
  left: number
  top: number
  placement: 'above' | 'below'
  maxHeight?: number
  items: WikiLinkSuggestItem[]
  activeIndex: number
}

/** When the menu is not open, complete detection is only performed when a `/` trigger may appear in the paragraph (mitigating recalculation of each key)*/
export function shouldProbeSlashMenu(editor: Editor, menuOpen: boolean): boolean {
  if (menuOpen) return true
  if (editor.isDestroyed) return false
  const { selection } = editor.state
  if (!selection.empty) return false
  const { $from } = selection
  if ($from.parent.type.name !== 'paragraph') return false
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  return /(?:^|\s)\/(?:[a-zA-Z0-9\u4e00-\u9fa5-_]*)?$/u.test(textBefore)
}

export function slashMenuFrameEquals(a: SlashMenuState, b: SlashMenuState): boolean {
  if (a.from !== b.from || a.to !== b.to || a.query !== b.query) return false
  if (a.placement !== b.placement) return false
  if (Math.round(a.left) !== Math.round(b.left) || Math.round(a.top) !== Math.round(b.top)) return false
  if (a.maxHeight !== b.maxHeight) return false
  if (a.rows.length !== b.rows.length) return false
  for (let i = 0; i < a.rows.length; i++) {
    if (a.rows[i].id !== b.rows[i].id) return false
  }
  return true
}

function isSlashCommandGroup(
  item: SlashCommandItem,
): item is Extract<SlashCommandItem, { children: SlashCommandLeaf[] }> {
  return 'children' in item && Array.isArray(item.children)
}

function slashCommandMatchesQuery(item: { label: string; aliases: string[] }, query: string): boolean {
  if (!query) return true
  const tokens = [item.label.toLowerCase(), ...item.aliases.map((alias) => alias.toLowerCase())]
  return tokens.some((token) => token.includes(query))
}

export function buildSlashMenuRows(commands: readonly SlashCommandItem[], query: string): SlashMenuRow[] {
  const rows: SlashMenuRow[] = []
  for (const command of commands) {
    if (isSlashCommandGroup(command)) {
      const parentMatch = slashCommandMatchesQuery(command, query)
      const matchingChildren = command.children.filter((child) => slashCommandMatchesQuery(child, query))
      if (!parentMatch && !matchingChildren.length) continue
      rows.push({ id: command.id, label: command.label, depth: 0, executable: false })
      const children = query && !parentMatch ? matchingChildren : command.children
      for (const child of children) {
        rows.push({
          id: `${command.id}/${child.id}`,
          label: child.label,
          depth: 1,
          executable: true,
          manifestCommandId: child.manifestCommandId,
          run: child.run,
        })
      }
      continue
    }
    if (!slashCommandMatchesQuery(command, query)) continue
    rows.push({
      id: command.id,
      label: command.label,
      depth: 0,
      executable: true,
      manifestCommandId: command.manifestCommandId,
      run: command.run,
    })
  }
  return rows.slice(0, 20)
}

export function firstExecutableSlashRowIndex(rows: readonly SlashMenuRow[]): number {
  const index = rows.findIndex((row) => row.executable)
  return index >= 0 ? index : 0
}

export function stepExecutableSlashRowIndex(
  rows: readonly SlashMenuRow[],
  current: number,
  direction: 1 | -1,
): number {
  if (!rows.length) return 0
  let index = current
  for (let step = 0; step < rows.length; step += 1) {
    index = (index + direction + rows.length) % rows.length
    if (rows[index]?.executable) return index
  }
  return current
}

const SLASH_MENU_ITEM_HEIGHT = 36
const SLASH_MENU_PADDING = 12
const SLASH_MENU_GAP = 2
const SLASH_MENU_MARGIN = 8
const SLASH_MENU_MIN_HEIGHT = 120

function estimateSlashMenuHeight(itemCount: number): number {
  if (itemCount <= 0) return SLASH_MENU_PADDING
  return SLASH_MENU_PADDING + itemCount * SLASH_MENU_ITEM_HEIGHT + (itemCount - 1) * SLASH_MENU_GAP
}

type CaretRect = Pick<DOMRect, 'left' | 'top' | 'bottom'>

export function computeSlashMenuPosition(
  caretRect: CaretRect,
  shellRect: DOMRect,
  itemCount: number,
): Pick<SlashMenuState, 'left' | 'top' | 'placement' | 'maxHeight'> {
  const menuHeight = estimateSlashMenuHeight(itemCount)
  const spaceBelow = Math.max(0, shellRect.bottom - caretRect.bottom - SLASH_MENU_MARGIN)
  const spaceAbove = Math.max(0, caretRect.top - shellRect.top - SLASH_MENU_MARGIN)
  const left = Math.max(8, Math.min(caretRect.left - shellRect.left, shellRect.width - 240))

  const fitsBelow = spaceBelow >= menuHeight
  const fitsAbove = spaceAbove >= menuHeight

  if (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)) {
    return {
      left,
      top: caretRect.bottom - shellRect.top + SLASH_MENU_MARGIN,
      placement: 'below',
      maxHeight: fitsBelow ? undefined : Math.max(SLASH_MENU_MIN_HEIGHT, spaceBelow),
    }
  }

  const maxHeight = fitsAbove ? undefined : Math.max(SLASH_MENU_MIN_HEIGHT, spaceAbove)
  const visibleHeight = maxHeight ? Math.min(menuHeight, maxHeight) : menuHeight
  return {
    left,
    top: caretRect.top - shellRect.top - visibleHeight - SLASH_MENU_MARGIN,
    placement: 'above',
    maxHeight,
  }
}

export const SLASH_FILE_LINK_ID = 'file-link'
