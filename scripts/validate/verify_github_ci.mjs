#!/usr/bin/env node
/**
 * Local mirror of .github/workflows/ci.yml.
 *
 * Usage:
 *   npm run verify:ci          # Linux build job (default, matches GitHub CI)
 *   npm run verify:ci:locale   # locale-check job (matches GitHub CI)
 *   npm run verify:ci:checks   # optional local validation suite (not run on GitHub)
 *   npm run verify:ci:all      # build + locale + optional checks
 *
 * Options:
 *   --job build | locale | checks | all
 */
import {
  npmRun,
  runCargo,
  runNpmCi,
  runStep,
} from './lib/ci_job_runner.mjs'
import { runLocalePipelineFull } from './lib/locale_pipeline_steps.mjs'

const args = process.argv.slice(2)
const jobArgIdx = args.indexOf('--job')
const job = jobArgIdx >= 0 ? args[jobArgIdx + 1] : 'build'

function assertCargoAvailable() {
  runStep('cargo --version', 'cargo', ['--version'])
}

function runBuildJob() {
  console.log('\n=== CI job: build (.github/workflows/ci.yml) ===')

  runNpmCi()
  assertCargoAvailable()
  npmRun('build')
  runCargo(['build', '--manifest-path', 'src-tauri/Cargo.toml'])

  console.log('\nverify:ci — build job passed.')
}

function runLocaleCheckJob() {
  console.log('\n=== CI job: locale-check (.github/workflows/ci.yml) ===')

  runNpmCi()
  runLocalePipelineFull()

  console.log('\nverify:ci — locale-check job passed.')
}

function runChecksJob() {
  console.log('\n=== Optional local checks (not run on GitHub CI) ===')

  npmRun('version:check')
  runLocalePipelineFull()
  npmRun('validate:platform-ci-contract')
  npmRun('validate:qa-parity')
  npmRun('validate:tauri-ipc-contract')
  npmRun('validate:emoji-picker-i18n')
  npmRun('validate:ui-locale-parity')
  npmRun('validate:shortcut-hint-locale')
  npmRun('validate:git-publish-paths')
  npmRun('validate:mac-menu-assets')
  npmRun('validate:app-icons')
  npmRun('validate:release-config')
  npmRun('lint', ['--max-warnings', '100'])

  console.log('\nverify:ci — optional checks passed.')
}

switch (job) {
  case 'build':
    runBuildJob()
    break
  case 'locale':
    runLocaleCheckJob()
    break
  case 'checks':
    runChecksJob()
    break
  case 'all':
    runBuildJob()
    runLocaleCheckJob()
    runChecksJob()
    console.log('\nverify:ci — build + locale + optional checks passed.')
    break
  default:
    console.error(`Unknown --job "${job}". Use build, locale, checks, or all.`)
    process.exit(2)
}
