/**
 * Markdown normalization entry shared by editing (markdown-it → PM) and exporting (unified remark).
 */
import {
  preprocessLunaMarkdownAdmonitions,
  stripLeadingYamlFrontmatter,
} from '../editor/lunaMarkdownExtensionsPreprocess'

export type NormalizeMarkdownOptions = {
  /** Editing and parsing strips YAML frontmatter by default; exported remark links are processed by remarkStripFrontmatter*/
  stripFrontmatter?: boolean
}

/** Fence admonition, frontmatter, etc. preprocessing with disk/export alignment*/
export function normalizeMarkdownPipeline(
  markdown: string,
  options?: NormalizeMarkdownOptions,
): string {
  const strip = options?.stripFrontmatter !== false
  const body = strip ? stripLeadingYamlFrontmatter(markdown).body : markdown
  return preprocessLunaMarkdownAdmonitions(body)
}
