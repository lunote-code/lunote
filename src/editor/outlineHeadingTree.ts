import type { PmTocHeading } from './pmHeadingNav'

export type HeadingOutlineTreeNode = PmTocHeading & { children: HeadingOutlineTreeNode[] }

/** Shared with sidebar `DocumentOutlineBlock` / text `[toc]`: Create tree by heading level*/
export function buildHeadingOutlineTree(headings: PmTocHeading[]): HeadingOutlineTreeNode[] {
  const root: HeadingOutlineTreeNode[] = []
  const stack: HeadingOutlineTreeNode[] = []
  for (const h of headings) {
    const node: HeadingOutlineTreeNode = { ...h, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop()
    }
    if (stack.length === 0) root.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  return root
}
