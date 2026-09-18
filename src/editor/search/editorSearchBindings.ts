import { keymap, type KeyBinding } from '@codemirror/view'
import { openSearchPanel, search, searchKeymap } from '@codemirror/search'
import type { Extension } from '@codemirror/state'
import type { Editor } from '@tiptap/core'
import type { TranslateFn } from '../../i18n'
import { createCodeMirrorSearchPhraseExtension } from './codemirrorSearchPhrases'
import {
  editorSearchPluginKey,
  getEditorSearchState,
  scrollToSearchMatch,
  type EditorSearchMeta,
} from './editorSearchRuntime'
import { pickBestSearchResultCandidateIndex } from './searchResultReveal'

const openCodeMirrorSearchBinding: KeyBinding = {
  key: 'Mod-f',
  run(view) {
    return openSearchPanel(view)
  },
}

export function createCodeMirrorSearchExtensions(t: TranslateFn): Extension[] {
  return [
    createCodeMirrorSearchPhraseExtension(t),
    search({ top: true }),
    keymap.of([openCodeMirrorSearchBinding, ...searchKeymap]),
  ]
}

function dispatchSearchMeta(editor: Editor, meta: EditorSearchMeta): void {
  const tr = editor.state.tr.setMeta(editorSearchPluginKey, meta)
  editor.view.dispatch(tr)
}

export function setTiptapSearchQuery(editor: Editor, query: string): void {
  dispatchSearchMeta(editor, { type: 'setQuery', query })
}

export function revealTiptapSearchQuery(editor: Editor, query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  setTiptapSearchQuery(editor, trimmed)
  const nextState = getEditorSearchState(editor.state)
  const firstMatch = nextState.matches[0]
  if (!firstMatch) return true
  const tr = scrollToSearchMatch(editor.state, editor.state.tr, firstMatch)
  editor.view.dispatch(tr)
  return true
}

export function revealTiptapSearchResult(editor: Editor, query: string, snippetHtml?: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  setTiptapSearchQuery(editor, trimmed)
  const nextState = getEditorSearchState(editor.state)
  if (nextState.matches.length === 0) return true
  if (!snippetHtml?.trim()) {
    const firstMatch = nextState.matches[0]
    if (!firstMatch) return true
    editor.view.dispatch(scrollToSearchMatch(editor.state, editor.state.tr, firstMatch))
    return true
  }

  const doc = editor.state.doc
  const candidateIndex = pickBestSearchResultCandidateIndex(
    snippetHtml,
    trimmed,
    nextState.matches.map((match) => ({
      before: doc.textBetween(Math.max(0, match.from - 120), match.from, '\n', '\n'),
      match: doc.textBetween(match.from, match.to, '\n', '\n'),
      after: doc.textBetween(match.to, Math.min(doc.content.size, match.to + 120), '\n', '\n'),
    })),
  )
  const bestMatch = nextState.matches[candidateIndex] ?? nextState.matches[0]
  if (!bestMatch) return true
  const tr = scrollToSearchMatch(
    editor.state,
    editor.state.tr.setMeta(
      editorSearchPluginKey,
      { type: 'setActiveIndex', activeIndex: candidateIndex } satisfies EditorSearchMeta,
    ),
    bestMatch,
  )
  editor.view.dispatch(tr)
  return true
}

export function clearTiptapSearch(editor: Editor): void {
  dispatchSearchMeta(editor, { type: 'clear' })
}

export function moveTiptapSearch(editor: Editor, direction: 1 | -1): void {
  const state = getEditorSearchState(editor.state)
  if (state.matches.length === 0) return
  const nextIndex = (state.activeIndex + direction + state.matches.length) % state.matches.length
  const match = state.matches[nextIndex]
  if (!match) return
  const tr = scrollToSearchMatch(
    editor.state,
    editor.state.tr.setMeta(editorSearchPluginKey, { type: 'setActiveIndex', activeIndex: nextIndex } satisfies EditorSearchMeta),
    match,
  )
  editor.view.dispatch(tr)
}

export function getTiptapSearchSnapshot(editor: Editor | null) {
  if (!editor) return { query: '', activeIndex: 0, matches: [] }
  return getEditorSearchState(editor.state)
}

export function replaceCurrentTiptapMatch(editor: Editor, replacement: string): boolean {
  const state = getEditorSearchState(editor.state)
  const match = state.matches[state.activeIndex]
  if (!match || !state.query) return false
  const tr = editor.state.tr
    .insertText(replacement, match.from, match.to)
    .setMeta(editorSearchPluginKey, { type: 'setQuery', query: state.query } satisfies EditorSearchMeta)
    .scrollIntoView()
  editor.view.dispatch(tr)
  return true
}

export function replaceAllTiptapMatches(editor: Editor, replacement: string): number {
  const state = getEditorSearchState(editor.state)
  if (!state.matches.length || !state.query) return 0
  let tr = editor.state.tr
  for (let i = state.matches.length - 1; i >= 0; i--) {
    const match = state.matches[i]
    if (!match) continue
    tr = tr.insertText(replacement, match.from, match.to)
  }
  tr = tr.setMeta(editorSearchPluginKey, { type: 'setQuery', query: state.query } satisfies EditorSearchMeta)
  editor.view.dispatch(tr)
  return state.matches.length
}

export function replaceNextTiptapMatch(editor: Editor, replacement: string): boolean {
  if (!replaceCurrentTiptapMatch(editor, replacement)) return false
  moveTiptapSearch(editor, 1)
  return true
}
