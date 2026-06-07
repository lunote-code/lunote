/**
 * Override @tiptap/extension-code-block-lowlight default plugin:
 * Plain text / plaintext does not use highlightAuto to avoid baseline misalignment caused by Chinese being split into hljs tokens.
 */
import { findChildren } from '@tiptap/core'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import highlight from 'highlight.js/lib/core'

import {
  isPlainCodeBlockLanguage,
  normalizeLanguageForLowlight,
  shouldAvoidHighlightAuto,
} from './lunaCodeLanguages'
import {
  highlightDebounceMsForBlockSize,
  LOWLIGHT_PATCH_BLOCKS_META,
  LOWLIGHT_REFRESH_META,
  shouldDeferCodeBlockHighlightRepaint,
} from './lunaLowlightDefer'

const LARGE_BLOCK_CHARS = 8_000

type LowlightApi = {
  listLanguages: () => string[]
  highlight: (language: string, value: string) => unknown
  highlightAuto: (value: string) => unknown
  registered?: (language: string) => boolean
}

type CodeBlockRef = { pos: number; node: ProsemirrorNode }

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

function codeBlockContentRange(block: CodeBlockRef): { from: number; to: number } {
  return { from: block.pos + 1, to: block.pos + block.node.nodeSize - 1 }
}

function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && aTo > bFrom
}

function isLargeCodeBlock(block: CodeBlockRef): boolean {
  return block.node.textContent.length > LARGE_BLOCK_CHARS
}

function codeBlockRefAt(doc: ProsemirrorNode, blockPos: number, name: string): CodeBlockRef | null {
  const node = doc.nodeAt(blockPos)
  if (!node || node.type.name !== name) return null
  return { pos: blockPos, node }
}

function buildBlockDecorations(
  block: CodeBlockRef,
  lowlight: LowlightApi,
  defaultLanguage: string | null | undefined,
): Decoration[] {
  const rawLang = String(block.node.attrs.language ?? defaultLanguage ?? '').trim()
  if (isPlainCodeBlockLanguage(rawLang)) return []

  const text = block.node.textContent
  let from = block.pos + 1
  const language = normalizeLanguageForLowlight(rawLang)
  const languages = lowlight.listLanguages()
  const canHighlight =
    language &&
    (languages.includes(language) || hljsRegistered(language) || lowlight.registered?.(language))

  if (!canHighlight && shouldAvoidHighlightAuto(text)) return []

  const nodes = canHighlight
    ? getHighlightNodes(lowlight.highlight(language, text) as { value?: unknown; children?: unknown })
    : getHighlightNodes(lowlight.highlightAuto(text) as { value?: unknown; children?: unknown })

  const decorations: Decoration[] = []
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
  return decorations
}

function getDecorations({
  doc,
  name,
  lowlight,
  defaultLanguage,
}: {
  doc: ProsemirrorNode
  name: string
  lowlight: LowlightApi
  defaultLanguage: string | null | undefined
}): DecorationSet {
  const decorations: Decoration[] = []

  findChildren(doc, (node) => node.type.name === name).forEach((block) => {
    decorations.push(...buildBlockDecorations(block, lowlight, defaultLanguage))
  })

  return DecorationSet.create(doc, decorations)
}

function plainCodeBlocksOnly(
  blocks: ReturnType<typeof findChildren>,
  defaultLanguage: string | null | undefined,
): boolean {
  return (
    blocks.length > 0 &&
    blocks.every((block) =>
      isPlainCodeBlockLanguage(String(block.node.attrs.language ?? defaultLanguage ?? '')),
    )
  )
}

function shouldRehighlightCodeBlocks(
  transaction: Transaction,
  oldState: EditorState,
  newState: EditorState,
  name: string,
): boolean {
  if (!transaction.docChanged) return false

  const oldNodeName = oldState.selection.$head.parent.type.name
  const newNodeName = newState.selection.$head.parent.type.name
  const oldNodes = findChildren(oldState.doc, (node) => node.type.name === name)
  const newNodes = findChildren(newState.doc, (node) => node.type.name === name)

  if (
    [oldNodeName, newNodeName].includes(name) ||
    newNodes.length !== oldNodes.length ||
    transaction.steps.some((step) => {
      const s = step as { from?: number; to?: number }
      return (
        s.from !== undefined &&
        s.to !== undefined &&
        oldNodes.some((node) => node.pos >= s.from! && node.pos + node.node.nodeSize <= s.to!)
      )
    })
  ) {
    return true
  }
  return false
}

function hasStructuralCodeBlockChange(
  transaction: Transaction,
  oldNodes: CodeBlockRef[],
  newNodes: CodeBlockRef[],
): boolean {
  if (newNodes.length !== oldNodes.length) return true
  return transaction.steps.some((step) => {
    const s = step as { from?: number; to?: number }
    const from = s.from
    const to = s.to
    if (from === undefined || to === undefined) return false
    return oldNodes.some((node) => {
      const blockEnd = node.pos + node.node.nodeSize
      return from <= node.pos && to >= blockEnd
    })
  })
}

function findContentTouchedCodeBlocks(
  transaction: Transaction,
  doc: ProsemirrorNode,
  name: string,
): CodeBlockRef[] {
  const blocks = findChildren(doc, (node) => node.type.name === name)
  return blocks.filter((block) => {
    const { from: contentFrom, to: contentTo } = codeBlockContentRange(block)
    if (contentTo <= contentFrom) return false
    return transaction.steps.some((step) => {
      const s = step as { from?: number; to?: number }
      return (
        s.from !== undefined &&
        s.to !== undefined &&
        s.from <= contentTo &&
        s.to >= contentFrom
      )
    })
  })
}

/** Repaint touched blocks synchronously; map untouched blocks to avoid ghost carets in edited spans. */
function patchCodeBlockDecorations({
  transaction,
  decorationSet,
  doc,
  affectedBlocks,
  lowlight,
  defaultLanguage,
  deferRepaintBlockPos,
}: {
  transaction: Transaction
  decorationSet: DecorationSet
  doc: ProsemirrorNode
  affectedBlocks: CodeBlockRef[]
  lowlight: LowlightApi
  defaultLanguage: string | null | undefined
  deferRepaintBlockPos?: ReadonlySet<number>
}): DecorationSet {
  if (affectedBlocks.length === 0) {
    return decorationSet.map(transaction.mapping, transaction.doc)
  }

  const mapped = decorationSet.map(transaction.mapping, transaction.doc)
  const repaintBlocks = affectedBlocks.filter((block) => !deferRepaintBlockPos?.has(block.pos))
  const repaintRanges = repaintBlocks.map((block) => codeBlockContentRange(block))
  const kept = mapped.find().filter((decoration) => {
    const overlapsRepaint = repaintRanges.some((range) =>
      rangesOverlap(decoration.from, decoration.to, range.from, range.to),
    )
    return !overlapsRepaint
  })

  const fresh: Decoration[] = []
  for (const block of repaintBlocks) {
    fresh.push(...buildBlockDecorations(block, lowlight, defaultLanguage))
  }

  return DecorationSet.create(doc, kept.concat(fresh))
}

export function LunaLowlightPlugin({
  name,
  lowlight,
  defaultLanguage,
}: {
  name: string
  lowlight: LowlightApi
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
        const patchBlockPos = transaction.getMeta(LOWLIGHT_PATCH_BLOCKS_META) as number[] | undefined
        if (patchBlockPos?.length) {
          const blocks = patchBlockPos
            .map((pos) => codeBlockRefAt(newState.doc, pos, name))
            .filter((block): block is CodeBlockRef => block != null)
          if (blocks.length > 0) {
            return patchCodeBlockDecorations({
              transaction,
              decorationSet,
              doc: newState.doc,
              affectedBlocks: blocks,
              lowlight,
              defaultLanguage,
            })
          }
        }

        if (transaction.getMeta(LOWLIGHT_REFRESH_META) === true) {
          return getDecorations({
            doc: newState.doc,
            name,
            lowlight,
            defaultLanguage,
          })
        }

        if (!shouldRehighlightCodeBlocks(transaction, oldState, newState, name)) {
          return decorationSet.map(transaction.mapping, transaction.doc)
        }

        const oldNodes = findChildren(oldState.doc, (node) => node.type.name === name)
        const newNodes = findChildren(newState.doc, (node) => node.type.name === name)
        if (plainCodeBlocksOnly(newNodes, defaultLanguage) && plainCodeBlocksOnly(oldNodes, defaultLanguage)) {
          return decorationSet.map(transaction.mapping, transaction.doc)
        }

        if (hasStructuralCodeBlockChange(transaction, oldNodes, newNodes)) {
          return getDecorations({
            doc: newState.doc,
            name,
            lowlight,
            defaultLanguage,
          })
        }

        const affectedBlocks = findContentTouchedCodeBlocks(transaction, newState.doc, name)
        const deferRepaintBlockPos = new Set<number>()
        for (const block of affectedBlocks) {
          if (isLargeCodeBlock(block) || shouldDeferCodeBlockHighlightRepaint(transaction)) {
            deferRepaintBlockPos.add(block.pos)
          }
        }
        return patchCodeBlockDecorations({
          transaction,
          decorationSet,
          doc: newState.doc,
          affectedBlocks,
          lowlight,
          defaultLanguage,
          deferRepaintBlockPos: deferRepaintBlockPos.size > 0 ? deferRepaintBlockPos : undefined,
        })
      },
    },
    props: {
      decorations(state) {
        return lowlightKey.getState(state)
      },
    },
    view(view) {
      let debounceId: number | null = null
      const pendingPatchPos = new Set<number>()

      const flushPendingPatches = () => {
        debounceId = null
        if (view.isDestroyed || pendingPatchPos.size === 0) return
        const positions = [...pendingPatchPos]
        pendingPatchPos.clear()
        view.dispatch(view.state.tr.setMeta(LOWLIGHT_PATCH_BLOCKS_META, positions))
      }

      const scheduleBlockPatch = (blockPos: number, delayMs: number) => {
        pendingPatchPos.add(blockPos)
        if (debounceId != null) window.clearTimeout(debounceId)
        debounceId = window.setTimeout(flushPendingPatches, delayMs)
      }

      return {
        update(nextView, prevState) {
          if (nextView.state.doc.eq(prevState.doc)) return
          const { $from } = nextView.state.selection
          if ($from.parent.type.name !== name) return
          if (isPlainCodeBlockLanguage(String($from.parent.attrs.language ?? defaultLanguage ?? ''))) return
          const blockPos = $from.before()
          const delayMs = highlightDebounceMsForBlockSize(
            $from.parent.textContent.length,
            LARGE_BLOCK_CHARS,
          )
          scheduleBlockPatch(blockPos, delayMs)
        },
        destroy() {
          if (debounceId != null) window.clearTimeout(debounceId)
          pendingPatchPos.clear()
        },
      }
    },
  })

  return plugin
}
