import type { Editor } from '@tiptap/core'
import { resizeTableToDimensions } from './lunaTableResize'
import { isCodeEditGuardActive } from './lunaCodeContext'

const PICKER_CLASS = 'luna-table-insert-picker'
const GR = 8
const GC = 8

let activeCleanup: (() => void) | null = null

function removePicker() {
  activeCleanup?.()
  activeCleanup = null
}

function scrollHost(view: { dom: HTMLElement; scrollDOM?: HTMLElement }): HTMLElement {
  return view.scrollDOM ?? view.dom
}

type GridPickerOptions = {
  editor: Editor
  title: string
  hint: string
  initialRows: number
  initialCols: number
  /** Fixed anchor point (such as current table wrap); if not passed, center above the cursor*/
  getAnchorRect?: () => DOMRect | null
  onCommit: (rows: number, cols: number) => void
}

/**
 * 8×8 structure selector: hover highlight + size copy, click once to submit (insert or change table size).
 */
function mountLunaTableGridPicker(opts: GridPickerOptions): void {
  removePicker()

  const { editor, title, hint, initialRows, initialCols, getAnchorRect, onCommit } = opts
  const view = editor.view

  const shell = document.createElement('div')
  shell.className = PICKER_CLASS
  shell.setAttribute('role', 'dialog')
  shell.setAttribute('aria-label', title)

  const panel = document.createElement('div')
  panel.className = `${PICKER_CLASS}__panel`

  const titleEl = document.createElement('div')
  titleEl.className = `${PICKER_CLASS}__title`
  titleEl.textContent = title

  const dim = document.createElement('div')
  dim.className = `${PICKER_CLASS}__dim`
  dim.textContent = '3 × 3'

  const grid = document.createElement('div')
  grid.className = `${PICKER_CLASS}__grid`

  let hoverR = Math.min(GR, Math.max(1, initialRows))
  let hoverC = Math.min(GC, Math.max(1, initialCols))
  /** The cell where the current pointer is located (0-based), used for single cell hover highlighting*/
  let hoverCellR = hoverR - 1
  let hoverCellC = hoverC - 1
  const cells: HTMLButtonElement[][] = []

  const paint = () => {
    dim.textContent = `${hoverR} × ${hoverC}`
    for (let r = 0; r < GR; r += 1) {
      for (let c = 0; c < GC; c += 1) {
        cells[r][c].classList.toggle(`${PICKER_CLASS}__cell--in`, r < hoverR && c < hoverC)
        cells[r][c].classList.toggle(`${PICKER_CLASS}__cell--hover`, r === hoverCellR && c === hoverCellC)
      }
    }
  }

  for (let r = 0; r < GR; r += 1) {
    const row: HTMLButtonElement[] = []
    for (let c = 0; c < GC; c += 1) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `${PICKER_CLASS}__cell`
      b.dataset.lunaTableGridCell = `${r + 1},${c + 1}`
      b.title = `${r + 1} rows × ${c + 1} cols`
      b.addEventListener('mouseenter', () => {
        hoverR = r + 1
        hoverC = c + 1
        hoverCellR = r
        hoverCellC = c
        paint()
      })
      b.addEventListener('mousedown', (e) => e.preventDefault())
      b.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const rows = r + 1
        const cols = c + 1
        removePicker()
        onCommit(rows, cols)
      })
      grid.appendChild(b)
      row.push(b)
    }
    cells.push(row)
  }

  const hintEl = document.createElement('div')
  hintEl.className = `${PICKER_CLASS}__hint`
  hintEl.textContent = hint

  panel.appendChild(titleEl)
  panel.appendChild(dim)
  panel.appendChild(grid)
  panel.appendChild(hintEl)
  shell.appendChild(panel)
  document.body.appendChild(shell)

  const place = () => {
    const margin = 8
    const fixed = getAnchorRect?.()
    const edDom = view.dom as HTMLElement
    const edRect = edDom.getBoundingClientRect()

    let cx = edRect.left + edRect.width / 2
    let top = edRect.top + 80

    if (fixed && fixed.width > 0 && fixed.height > 0) {
      cx = fixed.left + fixed.width / 2
      top = fixed.bottom + margin
    } else {
      try {
        const pos = editor.state.selection.from
        const coords = view.coordsAtPos(pos)
        cx = (coords.left + coords.right) / 2
        top = coords.bottom + margin
      } catch {
        /*rollback*/
      }
    }

    shell.style.position = 'fixed'
    shell.style.zIndex = '10050'
    shell.style.left = `${Math.round(cx)}px`
    shell.style.top = `${Math.round(Math.max(8, top))}px`
    /** Center anchor point horizontally; defaults to below anchor point (toolbar button/cursor)*/
    shell.style.transform = 'translate(-50%, 0)'

    requestAnimationFrame(() => {
      const r = shell.getBoundingClientRect()
      let leftPx = Math.round(cx)
      if (r.right > window.innerWidth - 6) {
        leftPx -= r.right - (window.innerWidth - 6)
      }
      if (r.left < 6) {
        leftPx += 6 - r.left
      }
      shell.style.left = `${leftPx}px`
      if (r.bottom > window.innerHeight - 8 && fixed && fixed.height > 0) {
        const flipTop = fixed.top - margin - r.height
        shell.style.top = `${Math.round(Math.max(8, flipTop))}px`
      }
    })
  }
  place()

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') removePicker()
  }

  const onDocPointer = (e: PointerEvent) => {
    const t = e.target as Node
    if (!shell.contains(t)) removePicker()
  }

  const onScroll = () => place()

  const scrollEl = scrollHost(view)

  const cleanup = () => {
    document.removeEventListener('pointerdown', onDocPointer, true)
    document.removeEventListener('keydown', onKey, true)
    scrollEl.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onScroll)
    shell.remove()
    if (activeCleanup === cleanup) activeCleanup = null
  }

  activeCleanup = cleanup

  requestAnimationFrame(() => {
    document.addEventListener('pointerdown', onDocPointer, true)
    document.addEventListener('keydown', onKey, true)
    scrollEl.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
  })

  paint()
}

/**
 * Insert only: consistent with the menu "Insert Table", `withHeaderRow: true`.
 */
export function openLunaTableInsertPicker(editor: Editor): void {
  if (isCodeEditGuardActive(editor.state)) return
  mountLunaTableGridPicker({
    editor,
    title: 'Insert table',
    hint: 'Hover to preview, click to insert',
    initialRows: 3,
    initialCols: 3,
    onCommit(rows, cols) {
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
    },
  })
}

/**
 * Editing state: Open from the floating toolbar, reselect rows and columns and apply to the **current** table (not inserting a new table).
 */
export function openLunaTableStructurePicker(
  editor: Editor,
  tablePos: number,
  initialRows: number,
  initialCols: number,
  getAnchorRect: () => DOMRect,
): void {
  mountLunaTableGridPicker({
    editor,
    title: 'Table structure',
    hint: 'Hover to preview, click to apply size',
    initialRows,
    initialCols,
    getAnchorRect,
    onCommit(rows, cols) {
      resizeTableToDimensions(editor, tablePos, rows, cols)
      void editor.chain().focus().run()
    },
  })
}
