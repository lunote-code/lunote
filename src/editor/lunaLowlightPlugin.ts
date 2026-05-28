/**
 * Override @tiptap/extension-code-block-lowlight default plugin:
 * Plain text / plaintext does not use highlightAuto to avoid baseline misalignment caused by Chinese being split into hljs tokens.
 */
import { findChildren } from '@tiptap/core'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import highlight from 'highlight.js/lib/core'

import { isPlainCodeBlockLanguage, normalizeLanguageForLowlight } from './lunaCodeLanguages'

function hljsRegistered(aliasOrLanguage: string): boolean {
  return Boolean(highlight.getLanguage(aliasOrLanguage))
}

function parseNodes(nodes: unknown[], className: string[] = []): { text: string; classes: string[] }[] {
  return nodes.flatMap((node) => {
    const n = node as { properties?: { className?: string[] }; children?: unknown[]; value?: string }
    const classes = [...className, ...(n.properties?.className ?? [])]
    if (n.children) return parseNodes(n.children, classes)
    return { text: n.value ?? '', classes }
  })
}

function getHighlightNodes(result: { value?: unknown; children?: unknown }): unknown[] {
  return (result.value ?? result.children ?? []) as unknown[]
}

function isFn(param: unknown): param is (...args: unknown[]) => unknown {
  return typeof param === 'function'
}

function getDecorations({
  doc,
  name,
  lowlight,
  defaultLanguage,
}: {
  doc: ProsemirrorNode
  name: string
  lowlight: {
    listLanguages: () => string[]
    highlight: (language: string, value: string) => unknown
    highlightAuto: (value: string) => unknown
    registered?: (language: string) => boolean
  }
  defaultLanguage: string | null | undefined
}): DecorationSet {
  const decorations: Decoration[] = []

  findChildren(doc, (node) => node.type.name === name).forEach((block) => {
    const rawLang = String(block.node.attrs.language ?? defaultLanguage ?? '').trim()
    if (isPlainCodeBlockLanguage(rawLang)) return

    let from = block.pos + 1
    const language = normalizeLanguageForLowlight(rawLang)
    const languages = lowlight.listLanguages()
    const canHighlight =
      language &&
      (languages.includes(language) || hljsRegistered(language) || lowlight.registered?.(language))

    const nodes = canHighlight
      ? getHighlightNodes(lowlight.highlight(language, block.node.textContent) as { value?: unknown; children?: unknown })
      : getHighlightNodes(lowlight.highlightAuto(block.node.textContent) as { value?: unknown; children?: unknown })

    parseNodes(nodes).forEach((node) => {
      const to = from + node.text.length
      if (node.classes.length) {
        decorations.push(
          Decoration.inline(from, to, {
            class: node.classes.join(' '),
          }),
        )
      }
      from = to
    })
  })

  return DecorationSet.create(doc, decorations)
}

export function LunaLowlightPlugin({
  name,
  lowlight,
  defaultLanguage,
}: {
  name: string
  lowlight: Parameters<typeof getDecorations>[0]['lowlight']
  defaultLanguage: string | null | undefined
}): Plugin {
  if (!['highlight', 'highlightAuto', 'listLanguages'].every((api) => isFn((lowlight as Record<string, unknown>)[api]))) {
    throw new Error('LunaLowlightPlugin requires a lowlight instance')
  }

  const lowlightKey = new PluginKey('lowlight')
  const plugin = new Plugin({
    key: lowlightKey,
    state: {
      init: (_, { doc }) => getDecorations({ doc, name, lowlight, defaultLanguage }),
      apply: (transaction, decorationSet, oldState, newState) => {
        const oldNodeName = oldState.selection.$head.parent.type.name
        const newNodeName = newState.selection.$head.parent.type.name
        const oldNodes = findChildren(oldState.doc, (node) => node.type.name === name)
        const newNodes = findChildren(newState.doc, (node) => node.type.name === name)

        if (
          transaction.docChanged &&
          ([oldNodeName, newNodeName].includes(name) ||
            newNodes.length !== oldNodes.length ||
            transaction.steps.some((step) => {
              const s = step as { from?: number; to?: number }
              return (
                s.from !== undefined &&
                s.to !== undefined &&
                oldNodes.some((node) => node.pos >= s.from! && node.pos + node.node.nodeSize <= s.to!)
              )
            }))
        ) {
          return getDecorations({
            doc: transaction.doc,
            name,
            lowlight,
            defaultLanguage,
          })
        }
        return decorationSet.map(transaction.mapping, transaction.doc)
      },
    },
    props: {
      decorations(state) {
        return lowlightKey.getState(state)
      },
    },
  })

  return plugin
}
