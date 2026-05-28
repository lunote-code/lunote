import { eachMenuBarLeaf } from './menu.builder'
import { compileMenuFromSchema, SHELL_ONLY_COMPILED } from './menu.compiledSchema'
import { APP_MENU_SCHEMA } from './menu.schema'
import { uiLabelKeyToShellKey } from './menu.shellKey'

const SHELL_TO_MANIFEST_ACTION = new Map<string, string>()
const MANIFEST_TO_SHELL_ACTION = new Map<string, string>()

for (const item of compileMenuFromSchema()) {
  if (!item.shellKey) continue

  const existingAction = SHELL_TO_MANIFEST_ACTION.get(item.shellKey)
  if (existingAction && existingAction !== item.actionId) {
    throw new Error(
      `[menuActionMapping] duplicate shell key "${item.shellKey}" maps to both "${existingAction}" and "${item.actionId}"`,
    )
  }
  SHELL_TO_MANIFEST_ACTION.set(item.shellKey, item.actionId)

  const existingShell = MANIFEST_TO_SHELL_ACTION.get(item.actionId)
  if (existingShell && existingShell !== item.shellKey) {
    throw new Error(
      `[menuActionMapping] action "${item.actionId}" maps to both "${existingShell}" and "${item.shellKey}"`,
    )
  }
  MANIFEST_TO_SHELL_ACTION.set(item.actionId, item.shellKey)
}

export type MenuActionMappingIssue = {
  shellAction: string
  expectedManifestAction: string
  actualManifestAction: string
  expectedShellAction: string | null
  actualShellAction: string | null
}

function collectExpectedMappings(): Array<{ shellAction: string; manifestAction: string }> {
  const out: Array<{ shellAction: string; manifestAction: string }> = []
  eachMenuBarLeaf(APP_MENU_SCHEMA.bar, (leaf) => {
    const shellAction = uiLabelKeyToShellKey(leaf.labelKey)
    if (!shellAction) return
    out.push({ shellAction, manifestAction: leaf.action ?? leaf.id })
  })
  for (const item of SHELL_ONLY_COMPILED) {
    if (!item.shellKey) continue
    out.push({ shellAction: item.shellKey, manifestAction: item.actionId })
  }
  return out
}

export function validateMenuActionMapping(): MenuActionMappingIssue[] {
  const issues: MenuActionMappingIssue[] = []
  for (const expected of collectExpectedMappings()) {
    const actualManifestAction = resolveManifestActionFromMenuAction(expected.shellAction)
    const actualShellAction = resolveShellMenuActionFromManifestAction(expected.manifestAction)
    if (
      actualManifestAction !== expected.manifestAction ||
      actualShellAction !== expected.shellAction
    ) {
      issues.push({
        shellAction: expected.shellAction,
        expectedManifestAction: expected.manifestAction,
        actualManifestAction,
        expectedShellAction: expected.shellAction,
        actualShellAction,
      })
    }
  }
  return issues
}

export function assertMenuActionMappingValid(): void {
  const issues = validateMenuActionMapping()
  if (issues.length === 0) return
  const detail = issues
    .map(
      (issue) =>
        `shell "${issue.shellAction}" -> expected "${issue.expectedManifestAction}", got "${issue.actualManifestAction}"; reverse expected "${issue.expectedShellAction}", got "${issue.actualShellAction}"`,
    )
    .join('\n')
  throw new Error(`[menuActionMapping] ${issues.length} issue(s):\n${detail}`)
}

/**
 * Tauri emits shell menu ids such as `file_preferences`.
 * The app runtime consumes logical manifest actions such as `preferences`.
 */
export function resolveManifestActionFromMenuAction(action: string): string {
  return SHELL_TO_MANIFEST_ACTION.get(action) ?? action
}

/**
 * Resolve a logical manifest action back to its shell menu id when one exists.
 */
export function resolveShellMenuActionFromManifestAction(action: string): string | null {
  return MANIFEST_TO_SHELL_ACTION.get(action) ?? null
}

