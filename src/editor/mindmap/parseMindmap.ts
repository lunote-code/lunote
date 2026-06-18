/** Parse Mermaid mindmap source code into tree AST (the editing layer only retains the structure and does not do layout)*/

export type MindmapNodeShape = 'default' | 'circle' | 'rounded' | 'rect'

export type MindmapTreeNode = {
  id: string
  label: string
  shape: MindmapNodeShape
  level: number
  children: MindmapTreeNode[]
}

export type ParsedMindmapLine = {
  label: string
  shape: MindmapNodeShape
}

let idSeq = 0
function nextId(): string {
  idSeq += 1
  return `n${idSeq}`
}

/** Parse one mindmap node line (Mermaid shape syntax + optional node id prefix). */
export function parseMindmapNodeLine(text: string): ParsedMindmapLine {
  const line = text.trim()
  if (!line) return { label: '', shape: 'default' }

  const circleOnly = /^\(\((.+)\)\)\s*$/u.exec(line)
  if (circleOnly) return { label: circleOnly[1]!.trim(), shape: 'circle' }

  const circleWithId = /^(.+)\(\((.+)\)\)\s*$/u.exec(line)
  if (circleWithId) return { label: circleWithId[2]!.trim(), shape: 'circle' }

  const rectOnly = /^\[(.+)\]\s*$/u.exec(line)
  if (rectOnly) return { label: rectOnly[1]!.trim(), shape: 'rect' }

  const rectWithId = /^(.+)\[(.+)\]\s*$/u.exec(line)
  if (rectWithId) return { label: rectWithId[2]!.trim(), shape: 'rect' }

  const roundedOnly = /^\((.+)\)\s*$/u.exec(line)
  if (roundedOnly) return { label: roundedOnly[1]!.trim(), shape: 'rounded' }

  const roundedWithId = /^(.+)\((.+)\)\s*$/u.exec(line)
  if (roundedWithId) return { label: roundedWithId[2]!.trim(), shape: 'rounded' }

  return { label: line, shape: 'default' }
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
  const lines: { indent: number; parsed: ParsedMindmapLine }[] = []
  for (const line of rawLines) {
    const t = line.trim()
    if (!t) continue
    if (/^mindmap\b/iu.test(t)) continue
    lines.push({ indent: leadingSpaces(line), parsed: parseMindmapNodeLine(t) })
  }
  if (lines.length === 0) return null

  const baseIndent = Math.min(...lines.map((l) => l.indent))
  const stack: MindmapTreeNode[] = []
  let root: MindmapTreeNode | null = null

  for (const { indent, parsed } of lines) {
    const level = Math.max(0, Math.round((indent - baseIndent) / 2))
    const node: MindmapTreeNode = {
      id: nextId(),
      label: parsed.label,
      shape: parsed.shape,
      level,
      children: [],
    }

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
