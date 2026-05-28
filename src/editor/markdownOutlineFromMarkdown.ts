import { getSchema } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import { createLunaMarkdownEditorExtensions } from './lunaMarkdownEditorExtensions'
import { parseHeadingsFromPmDoc, type PmTocHeading } from './pmHeadingNav'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'

let cachedOutlineSchema: Schema | null = null

/** Same Markdown→PM schema as text editor (no workspace path, only for structure parsing/schema switching freeze)*/
export function getOutlineParseSchema(): Schema {
  if (!cachedOutlineSchema) {
    const extensions = createLunaMarkdownEditorExtensions({
      resolveMediaSrc: (src) => src,
      getNoteAssetContext: () => null,
    })
    cachedOutlineSchema = getSchema(extensions)
  }
  return cachedOutlineSchema
}

/**
 * Parse outline titles from Markdown source code (markdown-it → PM doc → heading node),
 * Consistent with the WYSIWYG mode, avoid scanning `parseDocumentHeadings` to misjudge fences/tables, etc., resulting in the loss of the second half of the article.
 */
export function parseOutlineHeadingsFromMarkdown(markdown: string): PmTocHeading[] {
  const schema = getOutlineParseSchema()
  const doc = canonicalMarkdownSemantics.parse(markdown, schema)
  return parseHeadingsFromPmDoc(doc)
}
