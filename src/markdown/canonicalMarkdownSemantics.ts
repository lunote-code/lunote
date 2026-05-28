import type { Fragment, Node as ProseMirrorNode, Schema } from 'prosemirror-model'

import {
  parseFirstMarkdownBlock,
  parseMarkdownToDoc,
  parseMarkdownToInlineFragment,
} from '../editor/markdownDocument'
import {
  compileBlockMarkdown,
  compileRangeMarkdown,
  compileMarkdown,
  compileMarkdownForModeBridge,
  compileMarkdownStrict,
  compileMarkdownWithMode,
  type ProductionMarkdown,
  type RenderMode,
  type SerializeDocToMarkdownResult,
  tryCompileMarkdown,
} from '../editor/compiler/markdownCompiler'

/**
 * Shared adapter entry for Markdown semantics.
 * The goal is not to replace existing pipelines immediately, but to give editor,
 * export, and future adapters a single import path for the canonical rules.
 * Direct imports from `markdownDocument` are intentionally contained here so
 * feature modules do not couple themselves to editor-internal parse helpers.
 */
export const canonicalMarkdownSemantics = {
  parse: parseMarkdownToDoc,
  parseFirstBlock(markdown: string, schema: Schema): ProseMirrorNode | null {
    return parseFirstMarkdownBlock(markdown, schema)
  },
  parseInlineFragment(markdown: string, schema: Schema): Fragment | null {
    return parseMarkdownToInlineFragment(markdown, schema)
  },
  serializeBlock(node: ProseMirrorNode, schema: Schema): string {
    return compileBlockMarkdown(node, schema)
  },
  serialize(doc: ProseMirrorNode, schema: Schema): string {
    return compileMarkdown(doc, schema)
  },
  serializeStrict(doc: ProseMirrorNode, schema: Schema): ProductionMarkdown {
    return compileMarkdownStrict(doc, schema)
  },
  serializeForModeBridge(doc: ProseMirrorNode, schema: Schema): string {
    return compileMarkdownForModeBridge(doc, schema)
  },
  serializeWithMode(doc: ProseMirrorNode, schema: Schema, mode: RenderMode): string {
    return compileMarkdownWithMode(doc, schema, mode)
  },
  trySerialize(doc: ProseMirrorNode, schema: Schema): SerializeDocToMarkdownResult {
    return tryCompileMarkdown(doc, schema)
  },
  serializeRange(doc: ProseMirrorNode, schema: Schema, from: number, to: number): string {
    return compileRangeMarkdown(doc, schema, from, to)
  },
}
