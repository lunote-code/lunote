import type { Node as PMNode } from '@tiptap/pm/model'
import GithubSlugger from 'github-slugger'

export type PmTocHeading = { level: number; title: string; id: string }

/**
 * The slug of the last heading in document order before (and including) the selection anchor.
 * Uses the same GitHub slug sequence as `parseHeadingsFromPmDoc` (repeating headers are -1, -2…).
 */
export function activeHeadingSlugBeforePos(doc: PMNode, pos: number): string {
  const slugger = new GithubSlugger()
  let active = ''
  doc.descendants((node, nodePos) => {
    if (nodePos > pos) return false
    if (node.type.name === 'heading') {
      const title = node.textContent.trim()
      if (title) active = slugger.slug(title)
    }
    return true
  })
  return active
}

/** Same order as `activeHeadingSlugBeforePos` / GitHub-style slugs (duplicate titles will get -1, -2 suffixes)*/
export function parseHeadingsFromPmDoc(doc: PMNode): PmTocHeading[] {
  const items: PmTocHeading[] = []
  const slugger = new GithubSlugger()
  doc.descendants((node) => {
    if (node.type.name !== 'heading') return
    const title = node.textContent.trim()
    if (!title) return
    const level = Number(node.attrs.level) || 1
    items.push({ level, title, id: slugger.slug(title) })
  })
  return items
}

export function findHeadingPositionInDoc(doc: PMNode, id: string): number | null {
  const slugger = new GithubSlugger()
  let found: number | null = null
  doc.descendants((node, pos) => {
    if (found != null) return false
    if (node.type.name !== 'heading') return true
    const title = node.textContent.trim()
    if (title && slugger.slug(title) === id) {
      found = pos
      return false
    }
    return true
  })
  return found
}
