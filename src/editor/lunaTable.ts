import { Table } from '@tiptap/extension-table'
import { TableView } from '@tiptap/extension-table'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorView, ViewMutationRecord } from '@tiptap/pm/view'
import { isInTable, selectedRect, TableMap } from '@tiptap/pm/tables'
import { emitLunaSurface } from './lunaEditorSurfaceState'
import type { LunaCellTextAlign } from './lunaTableCellAlign'
import { openLunaTableStructurePicker } from './lunaTableInsertPicker'
import { isPosInsideCodeSpecBlock } from './lunaCodeContext'

/** Table toolbar "Cell Text Alignment"; see `applyWrapperLayout` for the outer layout of the table*/
export type LunaTableAlign = LunaCellTextAlign

const PLUGIN_KEY = new PluginKey('lunaTableChrome')

function tiptapFromView(view: EditorView): Editor | null {
  let dom: HTMLElement | null = view.dom as HTMLElement
  while (dom) {
    const ed = (dom as HTMLElement & { editor?: Editor }).editor
    if (ed) return ed
    dom = dom.parentElement
  }
  return null
}

function clearTableActive(root: HTMLElement) {
  root.querySelectorAll('.pm-luna-table-wrap--active').forEach((el) => el.classList.remove('pm-luna-table-wrap--active'))
}

/**
 * Editing state: only activated when clicking "inside table `<table>`"; remains activated when clicking the toolbar/delete button of the activated table; click outside to cancel.
 * Use the toolbar "▦" to open the structural grid (change the row and column of the current table); still use `openLunaTableInsertPicker` for menu insertion.
 */
function lunaTableChromePlugin(): Plugin {
  return new Plugin({
    key: PLUGIN_KEY,
    view: (view) => {
      const onPointerDown = (e: PointerEvent) => {
        const root = view.dom as HTMLElement
        const t = e.target as HTMLElement | null
        if (!t) return

        if (!root.contains(t)) {
          clearTableActive(root)
          emitLunaSurface({ type: 'SET_TABLE_CHROME', active: false })
          return
        }

        const wrap = t.closest('.pm-luna-table-wrap') as HTMLElement | null
        const inChrome = t.closest('[data-luna-table-chrome]')

        if (wrap && root.contains(wrap) && inChrome && wrap.classList.contains('pm-luna-table-wrap--active')) {
          emitLunaSurface({ type: 'SET_TABLE_CHROME', active: true })
          return
        }

        clearTableActive(root)

        if (!wrap || !root.contains(wrap)) {
          emitLunaSurface({ type: 'SET_TABLE_CHROME', active: false })
          return
        }

        const tableEl = wrap.querySelector('table')
        if (tableEl && tableEl.contains(t)) {
          wrap.classList.add('pm-luna-table-wrap--active')
          emitLunaSurface({ type: 'SET_TABLE_CHROME', active: true })
        } else {
          emitLunaSurface({ type: 'SET_TABLE_CHROME', active: false })
        }
      }
      document.addEventListener('pointerdown', onPointerDown, true)
      return {
        destroy() {
          document.removeEventListener('pointerdown', onPointerDown, true)
        },
      }
    },
  })
}

function tableDocPosFromView(view: EditorView, contentDOM: HTMLElement): number | null {
  const p = view.posAtDOM(contentDOM, 0, 1)
  if (p == null) return null
  const $p = view.state.doc.resolve(p)
  for (let d = $p.depth; d > 0; d -= 1) {
    if ($p.node(d).type.spec.tableRole === 'table') return $p.before(d)
  }
  return null
}

function resolveTableNavigationRect(state: Editor['state']): {
  map: TableMap
  table: PMNode
  tableStart: number
  cellRect: { left: number; top: number }
} | null {
  if (!isInTable(state)) return null
  const sel = state.selection
  if (!(sel instanceof TextSelection) || !sel.empty) return null
  const rect = selectedRect(state)
  let relPos = sel.$from.pos - rect.tableStart
  for (let d = sel.$from.depth; d > 0; d -= 1) {
    const n = sel.$from.node(d)
    if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') {
      relPos = sel.$from.before(d) - rect.tableStart
      break
    }
  }
  let cell: { left: number; top: number; right: number; bottom: number }
  try {
    cell = rect.map.findCell(relPos)
  } catch {
    return null
  }
  return {
    map: rect.map,
    table: rect.table,
    tableStart: rect.tableStart,
    cellRect: { left: cell.left, top: cell.top },
  }
}

function moveToTableCell(editor: Editor, rect: { map: TableMap; table: PMNode; tableStart: number }, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= rect.map.height || col >= rect.map.width) return false
  const pos = rect.tableStart + rect.map.positionAt(row, col, rect.table) + 1
  const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)).scrollIntoView()
  editor.view.dispatch(tr)
  return true
}

/** Table outer layer: in the same column as `.ProseMirror > *` (do not cover margin:auto); do not set overflow here (chrome with negative `top` will be cropped)*/
function applyWrapperLayout(dom: HTMLElement) {
  dom.style.display = 'block'
  dom.style.width = '100%'
  dom.style.boxSizing = 'border-box'
  dom.style.maxWidth = 'min(var(--editor-column-width), 100%)'
  dom.style.marginTop = '12px'
  dom.style.marginBottom = '12px'
}

function dispatchCellRectAlign(
  editor: Editor,
  tablePos: number,
  tableMap: TableMap,
  rect: { left: number; top: number; right: number; bottom: number },
  align: LunaCellTextAlign,
): void {
  const { state } = editor
  const table = state.doc.nodeAt(tablePos)
  if (!table) return
  /** `TableMap` offsets the starting point of relative table "content", which is consistent with `tableStart` of `selectedRect`. It must use `tablePos + 1 + rel` and cannot be mixed with `before(table)`*/
  const tableContentStart = tablePos + 1
  const cells = tableMap.cellsInRect(rect)
  let tr = state.tr
  for (const rel of cells) {
    const cell = table.nodeAt(rel)
    if (!cell) continue
    if ((cell.attrs as { lunaCellTextAlign?: LunaCellTextAlign | null }).lunaCellTextAlign === align) continue
    tr = tr.setNodeMarkup(tableContentStart + rel, undefined, {
      ...cell.attrs,
      align,
      lunaCellTextAlign: align,
    })
  }
  if (tr.steps.length) editor.view.dispatch(tr.scrollIntoView())
}

/** The starting point of the logical column corresponding to the cell in the current row (0-based, without rowspan compensation, suitable for regular Markdown tables)*/
function logicalColIndexInRow(row: HTMLTableRowElement, cell: HTMLTableCellElement): number {
  let c = 0
  for (let i = 0; i < row.cells.length; i += 1) {
    const x = row.cells[i]
    if (x === cell) return c
    c += x.colSpan || 1
  }
  return 0
}

function findCellCoveringLogicalColumn(row: HTMLTableRowElement, colIdx: number): HTMLTableCellElement | null {
  let c = 0
  for (let i = 0; i < row.cells.length; i += 1) {
    const cell = row.cells[i]
    const span = cell.colSpan || 1
    if (colIdx >= c && colIdx < c + span) return cell
    c += span
  }
  return null
}

function clearRowColHoverClasses(tbody: HTMLTableSectionElement): void {
  tbody.querySelectorAll('tr.pm-luna-tr--hover').forEach((tr) => tr.classList.remove('pm-luna-tr--hover'))
  tbody.querySelectorAll('td.pm-luna-td--col-hover, th.pm-luna-td--col-hover').forEach((el) => {
    el.classList.remove('pm-luna-td--col-hover')
  })
}

/**
 * Editing state: alignment, structured grid, deletion; column width drag and cell selection are completed by pm-tables.
 */
export class LunaTableView extends TableView {
  declare node: PMNode

  private pmView?: EditorView

  private chrome: HTMLDivElement

  private toolbar: HTMLDivElement

  private hoverUnsub?: () => void

  private hoverLastRow = -1

  private hoverLastCol = -1

  constructor(node: PMNode, cellMinWidth: number, view?: EditorView) {
    super(node, cellMinWidth)
    this.pmView = view
    this.dom.classList.add('pm-luna-table-wrap')
    this.dom.style.position = 'relative'

    this.chrome = document.createElement('div')
    this.chrome.className = 'pm-luna-table-chrome'
    this.chrome.setAttribute('data-luna-table-chrome', '')

    this.toolbar = document.createElement('div')
    this.toolbar.className = 'pm-luna-table-toolbar'

    const btn = (label: string, title: string, onClick: (e: MouseEvent) => void, toolbarId?: string) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'pm-luna-table-toolbar-btn'
      b.title = title
      b.setAttribute('aria-label', title)
      if (toolbarId) b.setAttribute('data-luna-table-toolbar', toolbarId)
      b.textContent = label
      b.addEventListener('mousedown', (e) => e.preventDefault())
      b.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick(e)
      })
      return b
    }

    this.toolbar.appendChild(btn('▦', 'Table structure (rows/cols)…', () => this.openStructurePicker(), 'table-grid'))
    this.toolbar.appendChild(
      btn(
        'L',
        'Align current column left (text-align) · ⇧ whole table · ⌥ hover column · ⌥⇧ hover row',
        (e) => this.setAlign('left', e),
        'align-left',
      ),
    )
    this.toolbar.appendChild(
      btn(
        'C',
        'Align current column center (text-align) · ⇧ whole table · ⌥ hover column · ⌥⇧ hover row',
        (e) => this.setAlign('center', e),
        'align-center',
      ),
    )
    this.toolbar.appendChild(
      btn(
        'R',
        'Align current column right (text-align) · ⇧ whole table · ⌥ hover column · ⌥⇧ hover row',
        (e) => this.setAlign('right', e),
        'align-right',
      ),
    )

    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'pm-luna-table-delete'
    del.title = 'Delete table'
    del.setAttribute('aria-label', 'Delete table')
    del.textContent = '🗑'
    del.addEventListener('mousedown', (e) => e.preventDefault())
    del.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.deleteTable()
    })

    this.chrome.appendChild(this.toolbar)
    this.chrome.appendChild(del)

    this.dom.insertBefore(this.chrome, this.table)
    //Horizontal scrolling is only wrapped outside the table; do not overflow on the wrap containing `pm-luna-table-chrome`, otherwise the negative top toolbar will be cropped
    const scroll = document.createElement('div')
    scroll.className = 'pm-luna-table-scroll luna-md-table-card'
    this.dom.insertBefore(scroll, this.table)
    scroll.appendChild(this.table)

    applyWrapperLayout(this.dom)
    this.table.style.margin = '0'
    this.table.classList.add('pm-luna-table')
    this.applyStableTableLayout(node)
    this.hoverUnsub = this.installRowColHover()
  }

  /** Overwrite the total table minWidth / px total width accumulated by Tiptap `updateColumns`, so that the column width is still evenly divided after adding or deleting rows, and the table width follows the edited column width.*/
  private applyStableTableLayout(node: PMNode): void {
    let mapWidth: number
    try {
      mapWidth = TableMap.get(node).width
    } catch {
      return
    }
    if (mapWidth < 1) return

    this.table.style.tableLayout = 'fixed'
    this.table.style.width = '100%'
    this.table.style.minWidth = '0'
    this.table.style.maxWidth = '100%'

    const pct = 100 / mapWidth
    this.colgroup.querySelectorAll('col').forEach((c) => {
      const el = c as HTMLTableColElement
      el.style.width = `${pct}%`
      el.style.minWidth = '0'
    })
  }

  private installRowColHover(): () => void {
    const tbody = this.contentDOM
    const onMove = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      const cell = t?.closest('td, th') as HTMLTableCellElement | null
      if (!cell || !tbody.contains(cell)) {
        if (this.hoverLastRow !== -1 || this.hoverLastCol !== -1) {
          this.hoverLastRow = -1
          this.hoverLastCol = -1
          clearRowColHoverClasses(tbody)
        }
        return
      }
      const tr = cell.closest('tr')
      if (!tr || !tbody.contains(tr)) return
      const rowIdx = Array.prototype.indexOf.call(tbody.rows, tr as HTMLTableRowElement)
      const colIdx = logicalColIndexInRow(tr as HTMLTableRowElement, cell)
      if (rowIdx === this.hoverLastRow && colIdx === this.hoverLastCol) return
      this.hoverLastRow = rowIdx
      this.hoverLastCol = colIdx
      clearRowColHoverClasses(tbody)
      tr.classList.add('pm-luna-tr--hover')
      for (let r = 0; r < tbody.rows.length; r += 1) {
        const hit = findCellCoveringLogicalColumn(tbody.rows[r], colIdx)
        hit?.classList.add('pm-luna-td--col-hover')
      }
    }
    const onLeave = () => {
      this.hoverLastRow = -1
      this.hoverLastCol = -1
      clearRowColHoverClasses(tbody)
    }
    this.table.addEventListener('mousemove', onMove)
    this.table.addEventListener('mouseleave', onLeave)
    return () => {
      this.table.removeEventListener('mousemove', onMove)
      this.table.removeEventListener('mouseleave', onLeave)
      onLeave()
    }
  }

  private getEditor(): Editor | null {
    return this.pmView ? tiptapFromView(this.pmView) : null
  }

  private getTablePos(): number | null {
    if (!this.pmView) return null
    return tableDocPosFromView(this.pmView, this.contentDOM)
  }

  private focusFirstCell(): boolean {
    const ed = this.getEditor()
    const tablePos = this.getTablePos()
    if (!ed || tablePos == null) return false
    const table = ed.state.doc.nodeAt(tablePos)
    if (!table) return false
    const map = TableMap.get(table)
    const inner = tablePos + map.positionAt(0, 0, table) + 1
    return ed.chain().focus().setTextSelection(inner).run()
  }

  private openStructurePicker(): void {
    const ed = this.getEditor()
    const pos = this.getTablePos()
    if (!ed || pos == null) return
    void this.focusFirstCell()
    const map = TableMap.get(this.node)
    const anchorRect = () => {
      const btn = this.toolbar.querySelector('[data-luna-table-toolbar="table-grid"]') as HTMLElement | null
      const r = btn?.getBoundingClientRect()
      if (r && r.width > 0 && r.height > 0) return r
      return this.dom.getBoundingClientRect()
    }
    openLunaTableStructurePicker(ed, pos, map.height, map.width, anchorRect)
  }

  private setAlign(align: LunaCellTextAlign, ev: MouseEvent): void {
    const ed = this.getEditor()
    const tablePos = this.getTablePos()
    if (!ed || tablePos == null || !this.pmView) return

    void ed.chain().focus().run()
    let state = ed.state
    let table = state.doc.nodeAt(tablePos)
    if (!table) return
    let map = TableMap.get(table)

    if (ev.shiftKey && ev.altKey) {
      if (this.hoverLastRow < 0) return
      dispatchCellRectAlign(ed, tablePos, map, {
        left: 0,
        top: this.hoverLastRow,
        right: map.width,
        bottom: this.hoverLastRow + 1,
      }, align)
      return
    }
    if (ev.shiftKey) {
      dispatchCellRectAlign(ed, tablePos, map, { left: 0, top: 0, right: map.width, bottom: map.height }, align)
      return
    }
    if (ev.altKey) {
      if (this.hoverLastCol < 0) return
      dispatchCellRectAlign(
        ed,
        tablePos,
        map,
        { left: this.hoverLastCol, top: 0, right: this.hoverLastCol + 1, bottom: map.height },
        align,
      )
      return
    }

    //Default: Set the lunaCellTextAlign of th/td according to the "logical column" (consistent with the GFM pipeline alignment), and do not adjust the table margin
    if (!isInTable(state)) {
      if (this.hoverLastCol >= 0 && this.hoverLastCol < map.width) {
        dispatchCellRectAlign(
          ed,
          tablePos,
          map,
          { left: this.hoverLastCol, top: 0, right: this.hoverLastCol + 1, bottom: map.height },
          align,
        )
        return
      }
      void this.focusFirstCell()
      state = ed.state
      table = state.doc.nodeAt(tablePos)
      if (!table) return
      map = TableMap.get(table)
      if (!isInTable(state)) return
    }

    const sr = selectedRect(state)
    dispatchCellRectAlign(
      ed,
      tablePos,
      map,
      { left: sr.left, top: 0, right: sr.right, bottom: map.height },
      align,
    )
  }

  private deleteTable(): void {
    const ed = this.getEditor()
    if (!ed) return
    if (!this.focusFirstCell()) return
    ed.chain().focus().deleteTable().run()
  }

  update(node: PMNode): boolean {
    const ok = super.update(node)
    if (ok) {
      applyWrapperLayout(this.dom)
      this.applyStableTableLayout(node)
    }
    return ok
  }

  destroy(): void {
    this.hoverUnsub?.()
    this.hoverUnsub = undefined
  }

  ignoreMutation(record: ViewMutationRecord): boolean {
    const t = record.target as Node
    if (this.chrome.contains(t)) return true
    return super.ignoreMutation(record)
  }
}

export const LunaTable = Table.extend({
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        if (!isInTable(state)) return false
        if (isPosInsideCodeSpecBlock(state.selection.$from)) return false
        if (!state.selection.empty) return false
        return editor.commands.setHardBreak()
      },
      Tab: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        if (isPosInsideCodeSpecBlock(state.selection.$from)) return false
        const rect = resolveTableNavigationRect(state)
        if (!rect) return false

        const row = rect.cellRect.top
        const col = rect.cellRect.left
        let nextRow = row
        let nextCol = col + 1
        if (nextCol >= rect.map.width) {
          nextCol = 0
          nextRow = row + 1
        }
        if (nextRow >= rect.map.height) {
          const added = editor.chain().focus().addRowAfter().run()
          if (!added) return false
          const nextRect = resolveTableNavigationRect(editor.state)
          if (!nextRect) return false
          return moveToTableCell(editor, nextRect, Math.min(row + 1, nextRect.map.height - 1), 0)
        }
        return moveToTableCell(editor, rect, nextRow, nextCol)
      },
      'Shift-Tab': ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        if (isPosInsideCodeSpecBlock(state.selection.$from)) return false
        const rect = resolveTableNavigationRect(state)
        if (!rect) return false

        const row = rect.cellRect.top
        const col = rect.cellRect.left
        if (row === 0 && col === 0) return false
        let prevRow = row
        let prevCol = col - 1
        if (prevCol < 0) {
          prevRow = row - 1
          prevCol = rect.map.width - 1
        }
        return moveToTableCell(editor, rect, prevRow, prevCol)
      },
    }
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), lunaTableChromePlugin()]
  },
})
