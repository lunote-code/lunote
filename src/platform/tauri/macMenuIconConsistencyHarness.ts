/**
 * Validates macOS menu icon mapping stays aligned across:
 * - iconRegistry.ts (in-app Lucide components)
 * - macMenuIconLucide.ts (PNG export stems)
 * - public/mac-menu-icons/*.png (committed assets)
 *
 * Run via: node scripts/run-mac-menu-icon-consistency.mjs
 */
import {
  listMacMenuSemanticIconNames,
  MAC_MENU_SEMANTIC_LUCIDE_STEM,
} from './macMenuIconLucide'

export type MacMenuIconConsistencyCase = {
  readonly name: string
  readonly ok: boolean
  readonly detail?: string
}

export type MacMenuIconConsistencyInput = {
  /** Raw source of src/design-system/icons/iconRegistry.ts */
  readonly iconRegistrySource: string
  /** Raw source of node_modules/lucide-react/dist/lucide-react.d.ts */
  readonly lucideDtsSource: string
  /** Basenames of PNG files in public/mac-menu-icons/ (e.g. "settings.png") */
  readonly macMenuPngBasenames: readonly string[]
  /** Raw source of scripts/export_mac_menu_icons.mjs */
  readonly exportScriptSource: string
  /** Lucide icon file stems present on disk under dist/esm/icons/ */
  readonly lucideIconStems: ReadonlySet<string>
}

/** PascalCase Lucide import → kebab-case icon file stem (legacy export names). */
export function pascalCaseToKebabStem(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

/** @component @name blocks + export aliases in lucide-react.d.ts → component import name → icon file stem */
export function parseLucideComponentStems(dtsContent: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const block of dtsContent.split('@component @name ')) {
    const nameMatch = block.match(/^(\w+)/)
    if (!nameMatch) continue
    const componentName = nameMatch[1]
    const stemMatch = block.match(/https:\/\/lucide\.dev\/icons\/([^\s\n]+)/)
    if (stemMatch) {
      map.set(componentName, stemMatch[1])
    }
  }

  const exportMatch = dtsContent.match(/^export \{([\s\S]+?)\};/m)
  if (exportMatch) {
    for (const segment of exportMatch[1].split(',')) {
      const trimmed = segment.trim()
      const aliasMatch = trimmed.match(/^(\w+) as (\w+)$/)
      if (!aliasMatch) continue
      const stem = map.get(aliasMatch[1])
      if (stem) {
        map.set(aliasMatch[2], stem)
      }
    }
  }

  return map
}

function registryStemForComponent(
  component: string,
  lucideComponentStems: Map<string, string>,
  lucideIconStems: ReadonlySet<string>,
): string | undefined {
  const candidates = [
    lucideComponentStems.get(component),
    pascalCaseToKebabStem(component),
  ].filter((stem): stem is string => !!stem && lucideIconStems.has(stem))
  return candidates[0]
}

function stemsEquivalent(
  registryStem: string,
  menuStem: string,
  component: string,
  lucideIconStems: ReadonlySet<string>,
): boolean {
  if (registryStem === menuStem) return true
  const legacyStem = pascalCaseToKebabStem(component)
  return legacyStem === menuStem && lucideIconStems.has(legacyStem)
}

/** iconRegistry object entries → semantic name → Lucide component import name */
export function parseIconRegistryComponentNames(registrySource: string): Map<string, string> {
  const semanticToComponent = new Map<string, string>()
  const registryStart = registrySource.indexOf('export const iconRegistry')
  if (registryStart < 0) return semanticToComponent

  const body = registrySource.slice(registryStart)
  const re = /'([^']+)':\s*(\w+)\s*,|(?:^|\s)(\w+):\s*(\w+)\s*,/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    const semantic = match[1] ?? match[3]
    const component = match[2] ?? match[4]
    if (!semantic || semantic === 'iconRegistry' || semantic === 'Record') continue
    semanticToComponent.set(semantic, component)
  }
  return semanticToComponent
}

export function assertMacMenuIconConsistencySuite(
  input: MacMenuIconConsistencyInput,
): { results: MacMenuIconConsistencyCase[] } {
  const results: MacMenuIconConsistencyCase[] = []
  const push = (name: string, ok: boolean, detail?: string) => {
    results.push({ name, ok, detail })
  }

  const macMenuSemantics = listMacMenuSemanticIconNames()
  push('mac menu semantic count', macMenuSemantics.length > 0, `count=${macMenuSemantics.length}`)

  push(
    'export script uses macMenuIconLucide single source',
    input.exportScriptSource.includes('macMenuIconLucide.ts') &&
      input.exportScriptSource.includes('MAC_MENU_SEMANTIC_LUCIDE_STEM') &&
      !input.exportScriptSource.includes('const SEMANTIC_STEMS'),
    'export_mac_menu_icons.mjs must load stems from macMenuIconLucide.ts',
  )

  const lucideStems = parseLucideComponentStems(input.lucideDtsSource)
  const registryComponents = parseIconRegistryComponentNames(input.iconRegistrySource)

  const registryStemMismatches: string[] = []
  const registryMissing: string[] = []
  const lucideStemMissing: string[] = []

  for (const semantic of macMenuSemantics) {
    const menuStem = MAC_MENU_SEMANTIC_LUCIDE_STEM[semantic]
    if (!menuStem) {
      registryMissing.push(`${semantic}: missing MAC_MENU stem`)
      continue
    }

    if (!input.lucideIconStems.has(menuStem)) {
      lucideStemMissing.push(`${semantic}: stem file missing (${menuStem})`)
    }

    const component = registryComponents.get(semantic)
    if (!component) {
      registryMissing.push(`${semantic}: missing iconRegistry entry`)
      continue
    }

    const registryStem = registryStemForComponent(component, lucideStems, input.lucideIconStems)
    if (!registryStem) {
      registryMissing.push(`${semantic}: unknown Lucide component ${component}`)
      continue
    }

    if (!stemsEquivalent(registryStem, menuStem, component, input.lucideIconStems)) {
      registryStemMismatches.push(`${semantic}: registry=${registryStem} macMenu=${menuStem}`)
    }
  }

  push(
    'iconRegistry Lucide stems match macMenuIconLucide',
    registryStemMismatches.length === 0,
    registryStemMismatches.length ? registryStemMismatches.join('; ') : undefined,
  )
  push(
    'mac menu semantics exist in iconRegistry',
    registryMissing.length === 0,
    registryMissing.length ? registryMissing.join('; ') : undefined,
  )
  push(
    'mac menu lucide stems exist on disk',
    lucideStemMissing.length === 0,
    lucideStemMissing.length ? lucideStemMissing.join('; ') : undefined,
  )

  const pngSet = new Set(input.macMenuPngBasenames.map((name) => name.replace(/\.png$/, '')))
  const missingPngs = macMenuSemantics.filter((semantic) => !pngSet.has(semantic))
  push(
    'PNG assets cover all mac menu semantics',
    missingPngs.length === 0,
    missingPngs.length ? `missing: ${missingPngs.join(', ')}` : undefined,
  )
  push(
    'app-mark.png present',
    pngSet.has('app-mark'),
    pngSet.has('app-mark') ? undefined : 'run: npm run export:mac-menu-icons',
  )

  const expectedPngCount = macMenuSemantics.length + 1
  const extraPngs = [...pngSet].filter(
    (name) => name !== 'app-mark' && !macMenuSemantics.includes(name as (typeof macMenuSemantics)[number]),
  )
  push(
    'PNG asset count matches mac menu mapping',
    pngSet.size === expectedPngCount,
    `expected=${expectedPngCount} actual=${pngSet.size}${
      extraPngs.length ? ` extra=${extraPngs.join(', ')}` : ''
    }`,
  )

  return { results }
}

export function formatMacMenuIconConsistencySummary(
  results: readonly MacMenuIconConsistencyCase[],
): string {
  const lines = results.map((r) => {
    const status = r.ok ? 'OK  ' : 'FAIL'
    const detail = r.detail ? ` — ${r.detail}` : ''
    return `${status}  ${r.name}${detail}`
  })
  const failed = results.filter((r) => !r.ok).length
  lines.push('')
  lines.push(
    failed === 0
      ? `mac menu icon consistency: ${results.length}/${results.length} passed`
      : `mac menu icon consistency: ${results.length - failed}/${results.length} passed (${failed} failed)`,
  )
  return lines.join('\n')
}
