import { Extension } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { EDITOR_SEARCH_CLASS } from './editorSearchTheme'

export type EditorSearchMatch = {
  from: number
  to: number
}

export type EditorSearchPluginState = {
  query: string
  activeIndex: number
  matches: readonly EditorSearchMatch[]
  decorations: DecorationSet
}

export type EditorSearchMeta =
  | { type: 'setQuery'; query: string }
  | { type: 'setActiveIndex'; activeIndex: number }
  | { type: 'clear' }

export const editorSearchPluginKey = new PluginKey<EditorSearchPluginState>('luna-editor-local-search')

function normalizeQuery(query: string): string {
  return query.trim()
}

function collectMatches(doc: PmNode, query: string): EditorSearchMatch[] {
  const needle = normalizeQuery(query).toLocaleLowerCase()
  if (!needle) return []

  const matches: EditorSearchMatch[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const haystack = node.text.toLocaleLowerCase()
    let index = haystack.indexOf(needle)
    while (index >= 0) {
      matches.push({ from: pos + index, to: pos + index + needle.length })
      index = haystack.indexOf(needle, index + Math.max(needle.length, 1))
    }
  })
  return matches
}

function clampActiveIndex(activeIndex: number, matches: readonly EditorSearchMatch[]): number {
  if (matches.length === 0) return 0
  return Math.max(0, Math.min(activeIndex, matches.length - 1))
}

function buildDecorations(doc: PmNode, matches: readonly EditorSearchMatch[], activeIndex: number): DecorationSet {
  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === activeIndex
        ? `${EDITOR_SEARCH_CLASS.match} ${EDITOR_SEARCH_CLASS.activeMatch}`
        : EDITOR_SEARCH_CLASS.match,
    }),
  )
  return DecorationSet.create(doc, decorations)
}

function buildSearchState(doc: PmNode, query: string, activeIndex: number): EditorSearchPluginState {
  const normalizedQuery = normalizeQuery(query)
  const matches = collectMatches(doc, normalizedQuery)
  const safeActiveIndex = clampActiveIndex(activeIndex, matches)
  return {
    query: normalizedQuery,
    activeIndex: safeActiveIndex,
    matches,
    decorations: buildDecorations(doc, matches, safeActiveIndex),
  }
}

function applySearchMeta(
  tr: Transaction,
  previous: EditorSearchPluginState,
  nextDoc: PmNode,
): EditorSearchPluginState {
  const meta = tr.getMeta(editorSearchPluginKey) as EditorSearchMeta | undefined
  if (meta?.type === 'clear') return buildSearchState(nextDoc, '', 0)
  if (meta?.type === 'setQuery') return buildSearchState(nextDoc, meta.query, 0)
  if (meta?.type === 'setActiveIndex') return buildSearchState(nextDoc, previous.query, meta.activeIndex)
  if (tr.docChanged && previous.query) return buildSearchState(nextDoc, previous.query, previous.activeIndex)
  return previous
}

export function getEditorSearchState(state: EditorState): EditorSearchPluginState {
  return editorSearchPluginKey.getState(state) ?? buildSearchState(state.doc, '', 0)
}

export function createEditorSearchPlugin(): Plugin<EditorSearchPluginState> {
  return new Plugin<EditorSearchPluginState>({
    key: editorSearchPluginKey,
    state: {
      init: (_, state) => buildSearchState(state.doc, '', 0),
      apply: (tr, previous) => applySearchMeta(tr, previous, tr.doc),
    },
    props: {
      decorations(state) {
        return getEditorSearchState(state).decorations
      },
    },
  })
}

export const EditorLocalSearchExtension = Extension.create({
  name: 'lunaEditorLocalSearch',
  addProseMirrorPlugins() {
    return [createEditorSearchPlugin()]
  },
})

export function scrollToSearchMatch(state: EditorState, tr: Transaction, match: EditorSearchMatch): Transaction {
  return tr
    .setSelection(TextSelection.create(state.doc, match.from, match.to))
    .scrollIntoView()
}
