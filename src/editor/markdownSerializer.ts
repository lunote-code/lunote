/**
 * Markdown compiler boundary exports (single render truth).
 * Business layer should consume this module instead of touching markdownDocument serializers directly.
 */
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'

import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import type { ProductionMarkdown, RenderMode, SerializeDocToMarkdownResult } from './compiler/markdownCompiler'
export type { ProductionMarkdown, RenderMode, SerializeDocToMarkdownResult } from './compiler/markdownCompiler'

export function compileBlockMarkdown(node: ProseMirrorNode, schema: Schema): string {
  return canonicalMarkdownSemantics.serializeBlock(node, schema)
}

export function compileMarkdown(doc: ProseMirrorNode, schema: Schema): string {
  return canonicalMarkdownSemantics.serialize(doc, schema)
}

export function compileMarkdownStrict(doc: ProseMirrorNode, schema: Schema): ProductionMarkdown {
  return canonicalMarkdownSemantics.serializeStrict(doc, schema)
}

export function compileMarkdownForModeBridge(doc: ProseMirrorNode, schema: Schema): string {
  return canonicalMarkdownSemantics.serializeForModeBridge(doc, schema)
}

export function compileMarkdownWithMode(doc: ProseMirrorNode, schema: Schema, mode: RenderMode): string {
  return canonicalMarkdownSemantics.serializeWithMode(doc, schema, mode)
}

export function tryCompileMarkdown(doc: ProseMirrorNode, schema: Schema): SerializeDocToMarkdownResult {
  return canonicalMarkdownSemantics.trySerialize(doc, schema)
}

export function compileRangeMarkdown(doc: ProseMirrorNode, schema: Schema, from: number, to: number): string {
  return canonicalMarkdownSemantics.serializeRange(doc, schema, from, to)
}
