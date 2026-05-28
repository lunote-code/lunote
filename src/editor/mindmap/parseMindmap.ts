/** Parse Mermaid mindmap source code into tree AST (the editing layer only retains the structure and does not do layout)*/

export type MindmapTreeNode = {
  id: string
  label: string
  level: number
  children: MindmapTreeNode[]
}

let idSeq = 0
function nextId(): string {
  idSeq += 1
  return `n${idSeq}`
}

function stripNodeDecor(text: string): string {
  return text
    .replace(/^\(\(/u, '')
    .replace(/\)\)$/u, '')
    .replace(/^\[/u, '')
    .replace(/\]$/u, '')
    .replace(/^\(/u, '')
    .replace(/\)$/u, '')
    .trim()
}

function leadingSpaces(line: string): number {
  const m = /^(\s*)/.exec(line)
  return m ? m[1]!.length : 0
}

export function isMindmapSource(source: string): boolean {
  return /^\s*mindmap\b/im.test(source.trim())
}

/** Parse `mindmap` block text into root node; returns null on failure*/
export function parseMindmapSource(source: string): MindmapTreeNode | null {
  idSeq = 0
  const rawLines = source.replace(/\r\n/g, '\n').split('\n')
  const lines: { indent: number; text: string }[] = []
  for (const line of rawLines) {
    const t = line.trim()
    if (!t) continue
    if (/^mindmap\b/iu.test(t)) continue
    lines.push({ indent: leadingSpaces(line), text: stripNodeDecor(t) })
  }
  if (lines.length === 0) return null

  const baseIndent = Math.min(...lines.map((l) => l.indent))
  const stack: MindmapTreeNode[] = []
  let root: MindmapTreeNode | null = null

  for (const { indent, text } of lines) {
    const level = Math.max(0, Math.round((indent - baseIndent) / 2))
    const node: MindmapTreeNode = { id: nextId(), label: text, level, children: [] }

    if (!root) {
      root = node
      stack.length = 0
      stack.push(node)
      continue
    }

    while (stack.length > level) stack.pop()
    const parent = stack[stack.length - 1]
    if (!parent) {
      root = node
      stack.length = 0
      stack.push(node)
      continue
    }
    parent.children.push(node)
    stack.push(node)
  }

  return root
}
