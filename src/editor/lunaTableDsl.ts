import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'

/** Column semantic type (used for header data attributes and subsequent formatting expansion)*/
export type LunaTableColumnSemantic = 'text' | 'number' | 'date' | 'currency' | 'status'

export type LunaTableColumnSpec = { name: string; semantic: LunaTableColumnSemantic }

export type LunaTableDslResult = {
  columns: LunaTableColumnSpec[]
  /** No header is included; the length of each row is consistent with columns (if any is missing, fill in the blanks)*/
  bodyRows: string[][]
}

const SEMANTICS = new Set<LunaTableColumnSemantic>(['text', 'number', 'date', 'currency', 'status'])

function normalizeSemantic(raw: string): LunaTableColumnSemantic {
  const s = raw.trim().toLowerCase()
  return SEMANTICS.has(s as LunaTableColumnSemantic) ? (s as LunaTableColumnSemantic) : 'text'
}

/** `name:text price:currency` or multiple `name:type` in a single line*/
export function parseColumnSpecTokens(segment: string): LunaTableColumnSpec[] {
  const out: LunaTableColumnSpec[] = []
  const re = /([\p{L}\p{N}_\s·.+-]+):(\w+)/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(segment)) !== null) {
    const name = m[1].trim()
    const semantic = normalizeSemantic(m[2])
    if (name) out.push({ name, semantic })
  }
  return out
}

function splitPipeRow(line: string): string[] {
  if (!line.includes('|')) return []
  const p = line.split('|').map((c) => c.trim())
  if (p.length && p[0] === '') p.shift()
  if (p.length && p[p.length - 1] === '') p.pop()
  return p
}

function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) return false
  return cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s+/g, '')))
}

/**
 * Parse `/table` DSL (does not rely on ProseMirror).
 * - Writing method 1: `/table name: text price: currency`
 * - Writing method 2: Multiple lines, /table The next line starts with `name:type` until `|` behavioral data appears
 * - Writing method 3: `/table` + pipe line (the first line is the header, the type is text)
 * Returns null on failure (default table inserted by caller).
 */
export function parseTableDSL(raw: string): LunaTableDslResult | null {
  const lines = raw
    .trim()
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return null
  if (!/^\/?table\b/iu.test(lines[0])) return null

  const restOfFirst = lines[0].replace(/^\s*\/?table\b\s*/iu, '').trim()

  /** Only one line: /table can be followed by column definitions or pipes*/
  if (lines.length === 1) {
    if (restOfFirst.includes('|')) {
      const cells = splitPipeRow(restOfFirst)
      if (cells.length < 2) return null
      const columns = cells.map((name) => ({ name, semantic: 'text' as const }))
      return { columns, bodyRows: [] }
    }
    if (!restOfFirst) return { columns: [], bodyRows: [] }
    const columns = parseColumnSpecTokens(restOfFirst)
    if (columns.length === 0) return null
    return { columns, bodyRows: [] }
  }

  /** Multiple lines: The same paragraph after /table in the first line can continue to write column definitions; subsequent lines without | are merged into column definitions*/
  const hasPipeOnFirst = restOfFirst.includes('|')
  let columns: LunaTableColumnSpec[] = []
  if (!hasPipeOnFirst && restOfFirst) {
    columns = parseColumnSpecTokens(restOfFirst)
  }

  let i = 1
  while (i < lines.length && !lines[i].includes('|')) {
    columns = columns.concat(parseColumnSpecTokens(lines[i]))
    i++
  }

  const dataLines: string[] = []
  if (hasPipeOnFirst) dataLines.push(restOfFirst)
  dataLines.push(...lines.slice(i).filter((l) => l.includes('|')))
  if (dataLines.length === 0) {
    if (columns.length > 0) return { columns, bodyRows: [] }
    return null
  }

  let rows = dataLines.map(splitPipeRow).filter((r) => r.length > 0)
  if (rows.length >= 2 && isSeparatorRow(rows[1])) {
    rows = [rows[0], ...rows.slice(2)]
  }

  if (columns.length === 0) {
    const headerCells = rows[0] ?? []
    if (headerCells.length < 2) return null
    columns = headerCells.map((name) => ({ name, semantic: 'text' as const }))
    rows = rows.slice(1)
  }

  const colCount = columns.length
  const bodyRows = rows.map((r) => {
    const copy = [...r]
    while (copy.length < colCount) copy.push('')
    if (copy.length > colCount) return copy.slice(0, colCount)
    return copy
  })

  return { columns, bodyRows }
}

function makeParagraph(schema: Schema, text: string): PMNode {
  const p = schema.nodes.paragraph
  if (!p) throw new Error('paragraph missing')
  const t = text.trim()
  const inner = t ? Fragment.from(schema.text(t)) : Fragment.empty
  return p.create(null, inner)
}

function makeHeaderCell(schema: Schema, spec: LunaTableColumnSpec): PMNode {
  const th = schema.nodes.tableHeader
  if (!th) throw new Error('tableHeader missing')
  const para = makeParagraph(schema, spec.name)
  return th.create({ lunaColSemantic: spec.semantic }, Fragment.from(para))
}

function makeBodyCell(schema: Schema, text: string): PMNode {
  const tc = schema.nodes.tableCell
  if (!tc) throw new Error('tableCell missing')
  const para = makeParagraph(schema, text)
  return tc.create(null, Fragment.from(para))
}

function makeRow(schema: Schema, cells: PMNode[]): PMNode {
  const tr = schema.nodes.tableRow
  if (!tr) throw new Error('tableRow missing')
  return tr.create(null, Fragment.fromArray(cells))
}

const FALLBACK_RC = { rows: 3, cols: 3 }

/** Default empty table (including header row)*/
export function createFallbackTableNode(schema: Schema): PMNode {
  const cols = FALLBACK_RC.cols
  const rows = FALLBACK_RC.rows
  const headerSpecs: LunaTableColumnSpec[] = Array.from({ length: cols }, (_, i) => ({
    name: `Col ${i + 1}`,
    semantic: 'text' as const,
  }))
  const body = Array.from({ length: Math.max(0, rows - 1) }, () => Array.from({ length: cols }, () => ''))
  return createTableNodeFromDsl(schema, { columns: headerSpecs, bodyRows: body })
}

/** Build the `table` node from the DSL results (the first line is tableHeader)*/
export function createTableNodeFromDsl(schema: Schema, dsl: LunaTableDslResult): PMNode {
  const tbl = schema.nodes.table
  if (!tbl) throw new Error('table missing')

  const { columns, bodyRows } = dsl
  if (columns.length === 0) {
    return createFallbackTableNode(schema)
  }

  const rows =
    bodyRows.length === 0 ? [columns.map(() => '')] : bodyRows

  const headerCells = columns.map((c) => makeHeaderCell(schema, c))
  const headerRow = makeRow(schema, headerCells)

  const bodyRowNodes = rows.map((cells) =>
    makeRow(
      schema,
      columns.map((_, j) => makeBodyCell(schema, cells[j] ?? '')),
    ),
  )

  return tbl.create(null, Fragment.fromArray([headerRow, ...bodyRowNodes]))
}
