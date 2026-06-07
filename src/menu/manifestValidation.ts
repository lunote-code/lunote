import { COMMAND_MANIFEST } from './commandManifest.entries'
import { listManifestWithAccelerator } from './commandManifest.build'
import { MENU_BAR_STRUCTURE } from './commandManifest.structure'
import type { CommandManifestEntry } from './commandManifest.types'
import { buildAppMenuSchema } from './commandManifest.build'
import { eachMenuBarLeaf } from './menu.builder'
import { parseAccelerator } from './menu.shortcuts'
import { COMMAND_RESOLUTION_REGISTRY, hasCommandResolver } from './commandResolution.rules'
import { getManifestDefaultAccelerator } from './shortcutPlatformDefaults'

export type ManifestValidationIssue =
  | 'unknown_command'
  | 'missing_runtime_binding'
  | 'duplicate_accelerator'
  | 'invalid_accelerator'
  | 'tree_command_missing_manifest'
  | 'manifest_menu_not_in_tree'
  | 'unreachable_web_binding'
  | 'ui_label_duplication'
  | 'menu_command_without_resolver'
  | 'resolver_without_manifest'

export type ManifestValidationResult = {
  ok: boolean
  issues: Array<{ code: ManifestValidationIssue; message: string }>
}

const WEB_RUNTIMES = new Set<CommandManifestEntry['runtime']>([
  'menu',
  'noop',
  'app-save',
  'app-save-as',
  'app-close-tab',
  'app-quit',
  'app-close-window',
  'app-preferences',
  'app-focus-mode',
  'app-mode-toggle',
])

function collectTreeCommandIds(): Set<string> {
  const ids = new Set<string>()
  function walk(nodes: typeof MENU_BAR_STRUCTURE[0]['children']): void {
    for (const n of nodes) {
      if (n.kind === 'command') ids.add(n.id)
      else if (n.kind === 'submenu') walk(n.children)
    }
  }
  for (const g of MENU_BAR_STRUCTURE) walk(g.children)
  return ids
}

/** Verify Command Manifest integrity (menu tree / shortcut keys / runtime)*/
export function validateCommandManifest(): ManifestValidationResult {
  const issues: ManifestValidationResult['issues'] = []
  const treeIds = collectTreeCommandIds()
  const byAccel = new Map<string, string[]>()

  for (const entry of Object.values(COMMAND_MANIFEST)) {
    if (!treeIds.has(entry.id) && entry.ui.menu !== false) {
      if (entry.ui.menu) {
        issues.push({
          code: 'manifest_menu_not_in_tree',
          message: `Manifest command "${entry.id}" has ui.menu but is not in MENU_BAR_STRUCTURE`,
        })
      }
    }

    if (entry.accelerator) {
      try {
        parseAccelerator(entry.accelerator)
      } catch {
        issues.push({
          code: 'invalid_accelerator',
          message: `Invalid accelerator for "${entry.id}": ${entry.accelerator}`,
        })
      }
      if (entry.accelerator && !WEB_RUNTIMES.has(entry.runtime)) {
        issues.push({
          code: 'unreachable_web_binding',
          message: `Accelerator on non-web command "${entry.id}"`,
        })
      }
      const list = byAccel.get(entry.accelerator) ?? []
      list.push(entry.id)
      byAccel.set(entry.accelerator, list)
    }

    if (!WEB_RUNTIMES.has(entry.runtime) && entry.runtime !== 'shell-only' && entry.runtime !== 'noop') {
      issues.push({
        code: 'missing_runtime_binding',
        message: `Unknown runtime for "${entry.id}": ${entry.runtime}`,
      })
    }

    // BUILD GATE: every runtime:'menu' command must have a resolver OR be runtime:'noop'
    if (entry.runtime === 'menu' && !hasCommandResolver(entry.id)) {
      issues.push({
        code: 'menu_command_without_resolver',
        message: `"${entry.id}" has runtime:'menu' but no entry in COMMAND_RESOLUTION_REGISTRY and is not marked runtime:'noop'. Add a resolver or change runtime to 'noop'.`,
      })
    }
  }

  for (const id of treeIds) {
    const entry = COMMAND_MANIFEST[id]
    if (!entry) {
      issues.push({
        code: 'tree_command_missing_manifest',
        message: `MENU_BAR_STRUCTURE references unknown command "${id}"`,
      })
      continue
    }
    if (!hasCommandResolver(id)) {
      issues.push({
        code: 'menu_command_without_resolver',
        message: `"${id}" is in MENU_BAR_STRUCTURE (runtime:'${entry.runtime}') but has no COMMAND_RESOLUTION_REGISTRY entry. Menu bar clicks will fail; add a resolver (e.g. delegateApp).`,
      })
    }
  }

  for (const [accel, ids] of byAccel) {
    if (ids.length > 1) {
      issues.push({
        code: 'duplicate_accelerator',
        message: `Duplicate accelerator ${accel}: ${ids.join(', ')}`,
      })
    }
  }

  const schema = buildAppMenuSchema()
  eachMenuBarLeaf(schema.bar, (leaf) => {
    const m = COMMAND_MANIFEST[leaf.id]
    if (!m) return
    const expectedAccelerator = getManifestDefaultAccelerator(m.id) ?? m.accelerator
    if (m.labelKey !== leaf.labelKey) {
      issues.push({
        code: 'ui_label_duplication',
        message: `Menu leaf labelKey mismatch for "${leaf.id}"`,
      })
    }
    if (expectedAccelerator !== leaf.accelerator || m.icon !== leaf.menuIcon) {
      issues.push({
        code: 'ui_label_duplication',
        message: `Menu leaf UI fields must come only from manifest for "${leaf.id}"`,
      })
    }
  })

  for (const id of Object.keys(COMMAND_RESOLUTION_REGISTRY)) {
    if (!COMMAND_MANIFEST[id]) {
      issues.push({
        code: 'resolver_without_manifest',
        message: `COMMAND_RESOLUTION_REGISTRY entry "${id}" has no COMMAND_MANIFEST definition.`,
      })
    }
  }

  for (const def of listManifestWithAccelerator()) {
    if (def.nativeAcceleratorExcluded) continue
    if (def.runtime === 'menu' && def.ui.menu !== false && !treeIds.has(def.id)) {
      issues.push({
        code: 'manifest_menu_not_in_tree',
        message: `Menu runtime command "${def.id}" has accelerator but is not in menu tree`,
      })
    }
  }

  return { ok: issues.length === 0, issues }
}

export function assertCommandManifestValid(): void {
  const result = validateCommandManifest()
  if (result.ok) return
  const detail = result.issues.map((i) => i.message).join('\n')
  throw new Error(`[manifestValidation] ${result.issues.length} issue(s):\n${detail}`)
}

/** @deprecated using validateCommandManifest*/
export const validateShortcutSystem = validateCommandManifest
export const assertShortcutSystemValid = assertCommandManifestValid
