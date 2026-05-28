/**
 * The common remark→rehype pipeline for export/preview (ensuring that editing and exporting have the same origin as HTML/PDF/Word).
 */
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGemoji from 'remark-gemoji'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkSupersub from 'remark-supersub'
import { defaultHandlers } from 'mdast-util-to-hast'
import { unified } from 'unified'
import remarkEqualHighlight from '../remarkEqualHighlight'
import remarkDefinitionList, { defListHastHandlers } from 'remark-definition-list'
import { normalizeMarkdownPipeline } from './normalizeMarkdownPipeline'
import { remarkStripFrontmatter, remarkTyporaCallouts } from '../export/markdownPipelinePlugins'

export function createUnifiedExportProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkStripFrontmatter)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkDefinitionList)
    .use(remarkSupersub)
    .use(remarkGemoji)
    .use(remarkEqualHighlight)
    .use(remarkTyporaCallouts)
    .use(remarkMath, { singleDollarTextMath: true })
    .use(remarkRehype, {
      allowDangerousHtml: false,
      handlers: { ...defaultHandlers, ...defListHastHandlers },
    } as Parameters<typeof remarkRehype>[1])
    .use(rehypeSlug)
    .use(rehypeKatex, { strict: false, errorColor: 'cc0000' })
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeStringify)
}

export function normalizeMarkdownForExport(md: string): string {
  return normalizeMarkdownPipeline(md, { stripFrontmatter: false })
}
