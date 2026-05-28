/**
 * Public Markdown compiler surface.
 * This module is the only serializer-facing bridge that should reach into
 * `markdownDocument`; app/editor callers should stay on this boundary or on the
 * canonical adapters above it.
 */
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import type {
  ProductionMarkdown,
  RenderMode,
  SerializeDocToMarkdownResult,
} from './markdownCompilerTypes'
import {
  serializeBlockNodeToMarkdown,
  serializeDocToMarkdown,
  serializeDocToMarkdownForModeBridge,
  serializeDocToMarkdownStrict,
  serializeDocToMarkdownWithMode,
  serializePmRangeToMarkdown,
  trySerializeDocToMarkdown,
} from '../markdownDocument'

export type { ProductionMarkdown, RenderMode, SerializeDocToMarkdownResult }

export function compileMarkdownStrict(doc: ProseMirrorNode, schema: Schema): ProductionMarkdown {
  return serializeDocToMarkdownStrict(doc, schema)
}

export function compileMarkdown(doc: ProseMirrorNode, schema: Schema): string {
  return serializeDocToMarkdown(doc, schema)
}

export function compileMarkdownWithMode(doc: ProseMirrorNode, schema: Schema, mode: RenderMode): string {
  return serializeDocToMarkdownWithMode(doc, schema, mode)
}

export function compileMarkdownForModeBridge(doc: ProseMirrorNode, schema: Schema): string {
  return serializeDocToMarkdownForModeBridge(doc, schema)
}

export function tryCompileMarkdown(doc: ProseMirrorNode, schema: Schema): SerializeDocToMarkdownResult {
  return trySerializeDocToMarkdown(doc, schema)
}

export function compileBlockMarkdown(node: ProseMirrorNode, schema: Schema): string {
  return serializeBlockNodeToMarkdown(node, schema)
}

export function compileRangeMarkdown(doc: ProseMirrorNode, schema: Schema, from: number, to: number): string {
  return serializePmRangeToMarkdown(doc, schema, from, to)
}

