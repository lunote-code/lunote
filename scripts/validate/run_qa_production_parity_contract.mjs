/**
 * CI guard: QA Playwright routes must reuse production components/selectors.
 * Playwright runs Vite dev (not Tauri); this keeps browser E2E aligned with AppRoot.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function testParityManifestExported() {
  const manifest = read('src/app/qa/qaProductionParityManifest.ts')
  assert(manifest.includes('QA_PRODUCTION_PARITY_RULES'), 'qaProductionParityManifest must export rules')
  assert(manifest.includes('PRODUCTION_IMPORT_GUARD_GLOBS'), 'qaProductionParityManifest must export import guards')
}

function testQaRoutesUseProductionHooks() {
  const manifestSource = read('src/app/qa/qaProductionParityManifest.ts')
  const ruleBlocks = [...manifestSource.matchAll(/playgroundFile:\s*'([^']+)'[\s\S]*?requiredInPlayground:\s*\[([\s\S]*?)\]/g)]
  assert(ruleBlocks.length >= 4, `expected 4+ parity rules, got ${ruleBlocks.length}`)

  for (const [, playgroundFile, requiredBlock] of ruleBlocks) {
    const playground = read(playgroundFile)
    const required = [...requiredBlock.matchAll(/'([^']+)'/g)].map((m) => m[1])
    for (const token of required) {
      assert(
        playground.includes(token),
        `${playgroundFile} must include production hook "${token}" for Playwright parity`,
      )
    }
  }
}

function testMainQaRoutesRegistered() {
  const main = read('src/main.tsx')
  for (const route of [
    'workspace-sidebar-selection',
    'first-run',
    'knowledge',
    'document-editor',
    'startup',
  ]) {
    assert(main.includes(`${route}:`) || main.includes(`'${route}'`), `main.tsx must register qa route ${route}`)
  }
}

function walkTsFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'experimental') continue
      out.push(...walkTsFiles(full))
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function testProductionDoesNotImportExperimental() {
  const guards = ['src/app/', 'src/editor/knowledgeOS/', 'src/platform/tauri/']
  for (const dir of guards) {
    const abs = path.join(root, dir)
    for (const file of walkTsFiles(abs)) {
      const rel = path.relative(root, file)
      const source = fs.readFileSync(file, 'utf8')
      assert(
        !source.match(/from ['"].*\/experimental\//),
        `${rel} must not import src/experimental modules`,
      )
    }
  }
}

function testCollaborationRuntimeIsolated() {
  assert(
    fs.existsSync(path.join(root, 'src/experimental/knowledgeCollaborationRuntime/index.ts')),
    'knowledgeCollaborationRuntime must live under src/experimental/',
  )
  assert(
    !fs.existsSync(path.join(root, 'src/editor/knowledgeCollaborationRuntime')),
    'knowledgeCollaborationRuntime must not remain under src/editor/',
  )
}

const tests = [
  ['parity manifest exported', testParityManifestExported],
  ['QA routes use production hooks', testQaRoutesUseProductionHooks],
  ['main qa routes registered', testMainQaRoutesRegistered],
  ['production import guard', testProductionDoesNotImportExperimental],
  ['collaboration runtime isolated', testCollaborationRuntimeIsolated],
]

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`fail ${name}: ${error instanceof Error ? error.message : error}`)
  }
}

if (failed > 0) {
  process.exitCode = 1
  console.error(`\n${failed} QA production parity contract test(s) failed`)
} else {
  console.log(`\n${tests.length} QA production parity contract test(s) passed`)
}
