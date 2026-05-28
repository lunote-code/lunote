import { EditorSelection, StateEffect, StateField, type Extension } from '@codemirror/state'
import { EditorView, keymap, ViewPlugin, type ViewUpdate } from '@codemirror/view'

import {
  buildWikiLinkInsertText,
  computeSuggestMenuPosition,
  isWikiSuggestItemSelectable,
  matchWikiLinkSuggestInText,
  searchWikiLinkSuggestCandidates,
  type WikiLinkSuggestItem,
  type WikiLinkSuggestMatch,
} from './lunaWikiLinkSuggest'

export type WikiLinkSuggestSession = {
  match: WikiLinkSuggestMatch
  items: WikiLinkSuggestItem[]
  activeIndex: number
  left: number
  top: number
  placement: 'above' | 'below'
  maxHeight?: number
}

const setWikiSuggestSession = StateEffect.define<WikiLinkSuggestSession | null>()

const wikiSuggestField = StateField.define<WikiLinkSuggestSession | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setWikiSuggestSession)) return effect.value
    }
    if (tr.docChanged || tr.selection) return null
    return value
  },
})

function detectWikiSuggestSession(view: EditorView): WikiLinkSuggestSession | null {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  const textBefore = line.text.slice(0, head - line.from)
  const match = matchWikiLinkSuggestInText(textBefore, line.from)
  if (!match) return null
  const items = searchWikiLinkSuggestCandidates(match.query, { limit: 8 })
  const caretRect = view.coordsAtPos(head)
  if (!caretRect) return null
  const shell = view.dom.closest('.editor-pane') as HTMLElement | null
  const shellRect = shell?.getBoundingClientRect() ?? view.dom.getBoundingClientRect()
  const { left, top, placement, maxHeight } = computeSuggestMenuPosition(caretRect, shellRect, items.length)
  return { match, items, activeIndex: 0, left, top, placement, maxHeight }
}

function applyWikiLinkSuggest(view: EditorView, session: WikiLinkSuggestSession, index: number): boolean {
  const item = session.items[index]
  if (!item || !isWikiSuggestItemSelectable(item)) return false
  const insert = buildWikiLinkInsertText(session.match.embed, item.insertTarget)
  view.dispatch({
    changes: { from: session.match.replaceFrom, to: session.match.replaceTo, insert },
    selection: EditorSelection.cursor(session.match.replaceFrom + insert.length),
    effects: setWikiSuggestSession.of(null),
  })
  view.focus()
  return true
}

function renderSuggestMenu(host: HTMLDivElement, session: WikiLinkSuggestSession | null, view: EditorView) {
  if (!session) {
    host.style.display = 'none'
    host.replaceChildren()
    return
  }
  host.style.display = 'block'
  host.style.position = 'absolute'
  host.style.left = `${session.left}px`
  host.style.top = `${session.top}px`
  host.style.zIndex = '12'
  host.style.maxHeight = session.maxHeight ? `${session.maxHeight}px` : ''
  host.style.overflowY = session.maxHeight ? 'auto' : ''
  host.className = `luna-wiki-suggest-menu-host pm-slash-menu luna-wiki-suggest-menu${
    session.placement === 'above' ? ' pm-slash-menu--above' : ''
  }`
  host.setAttribute('role', 'listbox')
  host.replaceChildren()
  session.items.forEach((item, idx) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `pm-slash-item luna-wiki-suggest-item${idx === session.activeIndex ? ' active' : ''}${
      !isWikiSuggestItemSelectable(item) ? ' luna-wiki-suggest-item--disabled' : ''
    }`
    btn.setAttribute('role', 'option')
    btn.setAttribute('aria-selected', idx === session.activeIndex ? 'true' : 'false')
    btn.disabled = !isWikiSuggestItemSelectable(item)
    const title = document.createElement('span')
    title.className = 'luna-wiki-suggest-item__title'
    title.textContent = item.title
    const hint = document.createElement('span')
    hint.className = 'luna-wiki-suggest-item__hint'
    hint.textContent = item.hint
    btn.appendChild(title)
    btn.appendChild(hint)
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        if (!isWikiSuggestItemSelectable(item)) return
        applyWikiLinkSuggest(view, session, idx)
      })
    host.appendChild(btn)
  })
}

const wikiSuggestViewPlugin = ViewPlugin.fromClass(
  class {
    host: HTMLDivElement
    view: EditorView
    private destroyed = false

    constructor(view: EditorView) {
      this.view = view
      this.host = document.createElement('div')
      const shell = view.dom.closest('.editor-pane') as HTMLElement | null
      ;(shell ?? view.dom.parentElement)?.appendChild(this.host)
      this.sync()
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged || update.transactions.some((tr) => tr.effects.some((e) => e.is(setWikiSuggestSession)))) {
        this.sync()
      }
    }

    sync() {
      const stored = this.view.state.field(wikiSuggestField)
      if (stored == null) {
        const detected = detectWikiSuggestSession(this.view)
        renderSuggestMenu(this.host, detected, this.view)
        if (detected) {
          const session = detected
          queueMicrotask(() => {
            if (this.destroyed) return
            if (this.view.state.field(wikiSuggestField) != null) return
            this.view.dispatch({ effects: setWikiSuggestSession.of(session) })
          })
        }
        return
      }
      renderSuggestMenu(this.host, stored, this.view)
    }

    destroy() {
      this.destroyed = true
      this.host.remove()
    }
  },
)

export function createCmWikiLinkSuggestExtension(): Extension {
  return [
    wikiSuggestField,
    wikiSuggestViewPlugin,
    keymap.of([
      {
        key: 'ArrowDown',
        run(view) {
          const session = view.state.field(wikiSuggestField)
          if (!session) return false
          view.dispatch({
            effects: setWikiSuggestSession.of({
              ...session,
              activeIndex: (session.activeIndex + 1) % session.items.length,
            }),
          })
          return true
        },
      },
      {
        key: 'ArrowUp',
        run(view) {
          const session = view.state.field(wikiSuggestField)
          if (!session) return false
          view.dispatch({
            effects: setWikiSuggestSession.of({
              ...session,
              activeIndex: (session.activeIndex - 1 + session.items.length) % session.items.length,
            }),
          })
          return true
        },
      },
      {
        key: 'Enter',
        run(view) {
          const session = view.state.field(wikiSuggestField)
          if (!session) return false
          const item = session.items[session.activeIndex]
          if (!item || !isWikiSuggestItemSelectable(item)) return true
          return applyWikiLinkSuggest(view, session, session.activeIndex)
        },
      },
      {
        key: 'Tab',
        run(view) {
          const session = view.state.field(wikiSuggestField)
          if (!session) return false
          const item = session.items[session.activeIndex]
          if (!item || !isWikiSuggestItemSelectable(item)) return true
          return applyWikiLinkSuggest(view, session, session.activeIndex)
        },
      },
      {
        key: 'Escape',
        run(view) {
          const session = view.state.field(wikiSuggestField)
          if (!session) return false
          view.dispatch({ effects: setWikiSuggestSession.of(null) })
          return true
        },
      },
    ]),
  ]
}
