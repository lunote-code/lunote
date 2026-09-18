import GithubSlugger from 'github-slugger'

import { stripLeadingYamlFrontmatter } from './lunaMarkdownExtensionsPreprocess'

function slugHeading(text: string): string {
  return new GithubSlugger().slug(text.trim())
}

/** Extract embed body from note markdown, optionally scoped by heading or block id. */
export function sliceEmbedMarkdownBody(
  markdown: string,
  opts?: { heading?: string; blockId?: string },
): string {
  const { body } = stripLeadingYamlFrontmatter(markdown)
  const heading = opts?.heading?.trim()
  const blockId = opts?.blockId?.trim()

  if (blockId) {
    const idNeedle = blockId.toLowerCase()
    const lines = body.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!
      if (line.includes(`id="${blockId}"`) || line.includes(`id='${blockId}'`)) {
        return lines.slice(i).join('\n').trim()
      }
      if (line.includes(`^${blockId}`) || line.toLowerCase().includes(idNeedle)) {
        return lines.slice(i).join('\n').trim()
      }
    }
  }

  if (heading) {
    const targetSlug = slugHeading(heading)
    const lines = body.split('\n')
    let start = -1
    let startLevel = 0
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!
      const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
      if (!m) continue
      const level = m[1]!.length
      const title = m[2]!.replace(/\s*\{#.+\}\s*$/u, '').trim()
      if (slugHeading(title) === targetSlug || title.toLowerCase() === heading.toLowerCase()) {
        start = i
        startLevel = level
        break
      }
    }
    if (start >= 0) {
      const out: string[] = [lines[start]!]
      for (let i = start + 1; i < lines.length; i += 1) {
        const m = /^(#{1,6})\s+/u.exec(lines[i]!)
        if (m && m[1]!.length <= startLevel) break
        out.push(lines[i]!)
      }
      return out.join('\n').trim()
    }
  }

  return body.trim()
}
