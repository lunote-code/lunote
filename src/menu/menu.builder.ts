import { formatTyporaMenuTitle } from './menu.display'
import type {
  ElectronCompatibleMenuItem,
  MenuBarGroup,
  MenuLeaf,
  MenuNode,
  MenuPathSegment,
  MenuSeparator,
  MenuSubmenu,
  ResolveMenuItemState,
} from './menu.types'

export const sep = (id?: string): MenuSeparator => ({ kind: 'separator', id })

export function isSeparator(n: MenuNode): n is MenuSeparator {
  return n.kind === 'separator'
}

export function isSubmenu(n: MenuNode): n is MenuSubmenu {
  return n.kind === 'submenu'
}

export function isLeaf(n: MenuNode): n is MenuLeaf {
  return n.kind === 'item'
}

export type CollapseSeparatorsOptions = {
  /**
   * true (default): Remove excess dividing lines at the beginning and end (suitable for first-level grouping in the top column).
   * false: Retain the first and last dividing lines (to avoid accidentally deleting group dividing lines in nested submenu).
   */
  trimEnds?: boolean
}

/** Merge continuous dividing lines; optionally remove the first and last dividing lines*/
export function collapseSeparators<T extends { kind: string }>(
  nodes: T[],
  options?: CollapseSeparatorsOptions,
): T[] {
  const trimEnds = options?.trimEnds !== false
  const out: T[] = []
  let lastWasSep = true
  for (const n of nodes) {
    const isSep = n.kind === 'separator'
    if (isSep) {
      if (lastWasSep) continue
      out.push(n)
      lastWasSep = true
    } else {
      out.push(n)
      lastWasSep = false
    }
  }
  if (trimEnds) {
    while (out.length && out[0]!.kind === 'separator') out.shift()
    while (out.length && out[out.length - 1]!.kind === 'separator') out.pop()
  }
  return out
}

function recurseChildren(
  nodes: MenuNode[],
  t: (k: string) => string,
  resolve: ResolveMenuItemState | undefined,
  pathPrefix: readonly string[],
  out: ElectronCompatibleMenuItem[],
): void {
  /** The nesting layer no longer trims the beginning and end to prevent separators in deep submenu from being accidentally deleted.*/
  const flat = collapseSeparators(nodes, { trimEnds: false })
  for (const n of flat) {
    if (n.kind === 'separator') {
      out.push({ type: 'separator' })
      continue
    }
    if (n.kind === 'submenu') {
      const sub = toElectronCompatibleMenu(n.children, t, resolve, [...pathPrefix, n.id])
      if (sub.length === 0) continue
      const subLabel = t(n.labelKey)
      if (!subLabel) continue
      out.push({
        type: 'submenu',
        id: n.id,
        label: subLabel,
        submenu: sub,
      })
      continue
    }
    const rawLabel = t(n.labelKey)
    if (!rawLabel) continue
    const label = formatTyporaMenuTitle(rawLabel, n.menuIcon)
    const st = resolve?.(n, { path: pathPrefix }) ?? {}
    out.push({
      type: n.itemType ?? 'normal',
      id: n.id,
      label,
      accelerator: n.accelerator,
      enabled: st.enabled,
      checked: st.checked,
    })
  }
}

/**
 * Generates a pure data structure (no runtime binding) compatible with the `Menu.buildFromTemplate` input shape.
 * @param pathPrefix The submenu id chain above the current level of `nodes` (excluding leaves)
 */
export function toElectronCompatibleMenu(
  nodes: MenuNode[],
  translate: (key: string) => string,
  resolve?: ResolveMenuItemState,
  pathPrefix: readonly string[] = [],
): ElectronCompatibleMenuItem[] {
  const out: ElectronCompatibleMenuItem[] = []
  recurseChildren(nodes, translate, resolve, pathPrefix, out)
  return out
}

export function walkMenuBar(
  bar: MenuBarGroup[],
  visit: (group: MenuBarGroup, path: string[]) => void,
  path: string[] = [],
): void {
  for (const g of bar) {
    visit(g, [...path, g.id])
  }
}

/**
 * Iterate over all leaf menu items (at any depth) under the top bar and provide for each leaf the `labelKey` path from the top bar group to its parent submenu (for command panels, etc.).
 */
export function eachMenuBarLeaf(
  bar: MenuBarGroup[],
  visit: (leaf: MenuLeaf, path: MenuPathSegment[]) => void,
): void {
  for (const g of bar) {
    const base: MenuPathSegment[] = [{ id: g.id, labelKey: g.labelKey }]
    walkMenuNodesForLeaves(g.children, base, visit)
  }
}

function walkMenuNodesForLeaves(
  nodes: MenuNode[],
  path: MenuPathSegment[],
  visit: (leaf: MenuLeaf, path: MenuPathSegment[]) => void,
): void {
  for (const n of nodes) {
    if (n.kind === 'separator') continue
    if (n.kind === 'item') {
      visit(n, path)
      continue
    }
    walkMenuNodesForLeaves(n.children, [...path, { id: n.id, labelKey: n.labelKey }], visit)
  }
}

export function flattenBarLeaves(bar: MenuBarGroup[]): MenuLeaf[] {
  const out: MenuLeaf[] = []
  eachMenuBarLeaf(bar, (leaf) => out.push(leaf))
  return out
}
