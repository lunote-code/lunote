import type { EditorView } from '@codemirror/view'
import type { Editor } from '@tiptap/core'
import { EditorSelection } from '@codemirror/state'
import { gemoji } from 'gemoji'

import { isCodeEditGuardActive } from './lunaCodeContext'
import { readEmojiPanelHint } from '../platform/emojiPanelHint'
import { readEmojiPickerCopy } from '../platform/emojiPickerI18n'

const PICKER_CLASS = 'luna-emoji-picker'

const CATEGORY_ORDER = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
] as const

type EmojiPick = { glyph: string; shortcode: string; description: string }

type Anchor = { cx: number; top: number; scrollEl?: HTMLElement }

let activeCleanup: (() => void) | null = null

function removePicker() {
  activeCleanup?.()
  activeCleanup = null
}

function emojiEntriesFor(category: string, query: string): EmojiPick[] {
  const q = query.trim().toLowerCase()
  const out: EmojiPick[] = []
  for (const g of gemoji) {
    if (category && g.category !== category) continue
    const shortcode = g.names[0] ?? ''
    if (!shortcode) continue
    if (q) {
      const hay = `${shortcode} ${g.description} ${g.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) continue
    }
    out.push({ glyph: g.emoji, shortcode, description: g.description })
    if (out.length >= 240) break
  }
  return out
}

function mountEmojiPicker(opts: {
  getAnchor: () => Anchor | null
  onPick: (pick: EmojiPick) => void
}): void {
  removePicker()

  const copy = readEmojiPickerCopy()

  const shell = document.createElement('div')
  shell.className = PICKER_CLASS
  shell.setAttribute('role', 'dialog')
  shell.setAttribute('aria-label', copy.title)

  const panel = document.createElement('div')
  panel.className = `${PICKER_CLASS}__panel`

  const titleEl = document.createElement('div')
  titleEl.className = `${PICKER_CLASS}__title`
  titleEl.textContent = copy.title

  const search = document.createElement('input')
  search.type = 'search'
  search.className = `${PICKER_CLASS}__search`
  search.placeholder = copy.searchPlaceholder
  search.autocomplete = 'off'
  search.spellcheck = false

  const tabs = document.createElement('div')
  tabs.className = `${PICKER_CLASS}__tabs`

  const grid = document.createElement('div')
  grid.className = `${PICKER_CLASS}__grid`
  grid.setAttribute('role', 'listbox')

  let activeCategory: string = CATEGORY_ORDER[0]!
  let query = ''

  const renderTabs = () => {
    tabs.replaceChildren()
    for (const cat of CATEGORY_ORDER) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `${PICKER_CLASS}__tab`
      b.textContent = cat.split(' ')[0] ?? cat
      b.title = cat
      b.setAttribute('aria-pressed', cat === activeCategory ? 'true' : 'false')
      if (cat === activeCategory) b.classList.add(`${PICKER_CLASS}__tab--active`)
      b.addEventListener('mousedown', (e) => e.preventDefault())
      b.addEventListener('click', (e) => {
        e.preventDefault()
        activeCategory = cat
        renderTabs()
        renderGrid()
      })
      tabs.appendChild(b)
    }
  }

  const renderGrid = () => {
    grid.replaceChildren()
    const items = emojiEntriesFor(activeCategory, query)
    if (!items.length) {
      const empty = document.createElement('div')
      empty.className = `${PICKER_CLASS}__empty`
      empty.textContent = copy.noMatches
      grid.appendChild(empty)
      return
    }
    for (const item of items) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `${PICKER_CLASS}__item`
      b.textContent = item.glyph
      b.title = `${item.description} (:${item.shortcode}:)`
      b.setAttribute('role', 'option')
      b.addEventListener('mousedown', (e) => e.preventDefault())
      b.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        removePicker()
        opts.onPick(item)
      })
      grid.appendChild(b)
    }
  }

  search.addEventListener('input', () => {
    query = search.value
    renderGrid()
  })

  panel.appendChild(titleEl)
  panel.appendChild(search)
  panel.appendChild(tabs)
  panel.appendChild(grid)

  const systemHint = readEmojiPanelHint()
  if (systemHint.trim()) {
    const hintEl = document.createElement('div')
    hintEl.className = `${PICKER_CLASS}__hint`
    hintEl.textContent = systemHint
    panel.appendChild(hintEl)
  }

  shell.appendChild(panel)
  document.body.appendChild(shell)

  const place = () => {
    const anchor = opts.getAnchor()
    const margin = 8
    const cx = anchor?.cx ?? window.innerWidth / 2
    const top = anchor?.top ?? 120
    shell.style.position = 'fixed'
    shell.style.zIndex = '10050'
    shell.style.left = `${Math.round(cx)}px`
    shell.style.top = `${Math.round(Math.max(margin, top))}px`
    shell.style.transform = 'translate(-50%, 0)'
    requestAnimationFrame(() => {
      const r = shell.getBoundingClientRect()
      let leftPx = Math.round(cx)
      if (r.right > window.innerWidth - margin) leftPx -= r.right - (window.innerWidth - margin)
      if (r.left < margin) leftPx += margin - r.left
      shell.style.left = `${leftPx}px`
      if (r.bottom > window.innerHeight - margin && anchor) {
        shell.style.top = `${Math.round(Math.max(margin, anchor.top - r.height - margin))}px`
      }
    })
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') removePicker()
  }
  const onDocPointer = (e: PointerEvent) => {
    if (!shell.contains(e.target as Node)) removePicker()
  }
  const onScroll = () => place()
  const scrollEl = opts.getAnchor()?.scrollEl

  const cleanup = () => {
    document.removeEventListener('pointerdown', onDocPointer, true)
    document.removeEventListener('keydown', onKey, true)
    scrollEl?.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onScroll)
    shell.remove()
    if (activeCleanup === cleanup) activeCleanup = null
  }
  activeCleanup = cleanup

  requestAnimationFrame(() => {
    document.addEventListener('pointerdown', onDocPointer, true)
    document.addEventListener('keydown', onKey, true)
    scrollEl?.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    place()
    search.focus()
  })

  renderTabs()
  renderGrid()
}

function anchorFromEditor(editor: Editor): Anchor | null {
  const view = editor.view
  const scrollEl = view.dom.parentElement ?? view.dom
  try {
    const coords = view.coordsAtPos(editor.state.selection.from)
    return {
      cx: (coords.left + coords.right) / 2,
      top: coords.bottom + 8,
      scrollEl,
    }
  } catch {
    const r = view.dom.getBoundingClientRect()
    return { cx: r.left + r.width / 2, top: r.top + 80, scrollEl }
  }
}

function anchorFromSourceView(view: EditorView): Anchor | null {
  const scrollEl = view.scrollDOM
  const head = view.state.selection.main.head
  const rect = view.coordsAtPos(head)
  if (!rect) {
    const r = view.dom.getBoundingClientRect()
    return { cx: r.left + r.width / 2, top: r.top + 80, scrollEl }
  }
  return { cx: (rect.left + rect.right) / 2, top: rect.bottom + 8, scrollEl }
}

function insertEmojiInEditor(editor: Editor, pick: EmojiPick) {
  const emojiType = editor.schema.nodes.emoji
  if (emojiType) {
    editor.chain().focus().insertContent({ type: 'emoji', attrs: { value: pick.shortcode } }).run()
    return
  }
  editor.chain().focus().insertContent(pick.glyph).run()
}

function insertEmojiInSourceView(view: EditorView, pick: EmojiPick) {
  const pos = view.state.selection.main.from
  const insert = `:${pick.shortcode}:`
  view.dispatch({
    changes: { from: pos, insert },
    selection: EditorSelection.cursor(pos + insert.length),
  })
  view.focus()
}

export function openLunaEmojiPicker(editor: Editor): void {
  if (isCodeEditGuardActive(editor.state)) return
  mountEmojiPicker({
    getAnchor: () => anchorFromEditor(editor),
    onPick: (pick) => insertEmojiInEditor(editor, pick),
  })
}

export function openLunaEmojiPickerFromSourceView(view: EditorView): void {
  mountEmojiPicker({
    getAnchor: () => anchorFromSourceView(view),
    onPick: (pick) => insertEmojiInSourceView(view, pick),
  })
}
