/**
 * Regression harness for hybrid menu bar (macOS native + Win/Linux in-app).
 * Run via: node scripts/run-hybrid-menu-regression.mjs
 */
import { APP_MENU_SCHEMA } from '../menu/menu.schema'
import { compileMenuFromSchema } from '../menu/menu.compiledSchema'
import { toTauriAccelerator } from '../menu/menu.shortcuts'
import { isLeaf, isSeparator, isSubmenu } from '../menu/menu.builder'
import type { MenuNode } from '../menu/menu.types'

export type HybridMenuRegressionCase = {
  name: string
  ok: boolean
  detail?: string
}

function countMenuNodes(nodes: readonly MenuNode[]): { items: number; submenus: number; separators: number } {
  let items = 0
  let submenus = 0
  let separators = 0
  for (const n of nodes) {
    if (isSeparator(n)) {
      separators++
      continue
    }
    if (isSubmenu(n)) {
      submenus++
      const nested = countMenuNodes(n.children)
      items += nested.items
      submenus += nested.submenus
      separators += nested.separators
      continue
    }
    if (isLeaf(n)) items++
  }
  return { items, submenus, separators }
}

export function assertHybridMenuRegressionSuite(): { results: HybridMenuRegressionCase[] } {
  const results: HybridMenuRegressionCase[] = []

  const push = (name: string, ok: boolean, detail?: string) => {
    results.push({ name, ok, detail })
  }

  const barIds = APP_MENU_SCHEMA.bar.map((g) => g.id)
  push(
    'APP_MENU_SCHEMA top bar groups',
    barIds.join(',') === 'bar-file,bar-edit,bar-paragraph,bar-format,bar-view,bar-window,bar-help',
    barIds.join(', '),
  )

  const compiled = compileMenuFromSchema()
  push('compileMenuFromSchema non-empty', compiled.length > 100, `count=${compiled.length}`)

  const shellMapped = compiled.filter((r) => r.shellKey != null).length
  push('compileMenuFromSchema shell keys present', shellMapped > 80, `shellMapped=${shellMapped}`)

  const totals = APP_MENU_SCHEMA.bar.reduce(
    (acc, group) => {
      const c = countMenuNodes(group.children)
      return {
        items: acc.items + c.items,
        submenus: acc.submenus + c.submenus,
        separators: acc.separators + c.separators,
      }
    },
    { items: 0, submenus: 0, separators: 0 },
  )
  push('menu tree has substantive content', totals.items > 150, JSON.stringify(totals))

  push('toTauriAccelerator Mod+S', toTauriAccelerator('Mod+S') === 'CmdOrCtrl+KeyS')
  push('toTauriAccelerator Mod+,', toTauriAccelerator('Mod+,') === 'CmdOrCtrl+Comma')
  push('toTauriAccelerator F8', toTauriAccelerator('F8') === 'F8')

  const viewGroup = APP_MENU_SCHEMA.bar.find((g) => g.id === 'bar-view')
  const hasFullscreen = viewGroup?.children.some((n) => isLeaf(n) && n.id === 'view-fullscreen') ?? false
  push('view-fullscreen leaf exists for native checkbox', hasFullscreen)

  const fileGroup = APP_MENU_SCHEMA.bar.find((g) => g.id === 'bar-file')
  const hasRecentPlaceholder =
    fileGroup?.children.some((n) => isLeaf(n) && n.id === 'file-recent-placeholder') ?? false
  push('file-recent-placeholder exists for dynamic recent menu', hasRecentPlaceholder)

  return { results }
}

export function formatHybridMenuRegressionSummary(results: HybridMenuRegressionCase[]): string {
  const failed = results.filter((r) => !r.ok)
  const lines = results.map((r) => `${r.ok ? 'OK' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  lines.push('')
  lines.push(failed.length === 0 ? 'All hybrid menu regression checks passed.' : `${failed.length} check(s) failed.`)
  return lines.join('\n')
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  const { results } = assertHybridMenuRegressionSuite()
  console.log(formatHybridMenuRegressionSummary(results))
  if (results.some((r) => !r.ok)) process.exit(1)
}
