#!/usr/bin/env node
/**
 * Local mirror of .github/workflows/ci.yml for regression before push.
 *
 * Usage:
 *   npm run verify:ci                 # locale-and-scripts job (default)
 *   npm run verify:ci:smoke           # build-smoke job (needs Rust; Linux GTK on CI only)
 *   npm run verify:ci:all             # both jobs sequentially
 *
 * Options:
 *   --job locale-and-scripts | build-smoke | all
 */
import {
  npmRun,
  runCargo,
  runStep,
} from './lib/ci_job_runner.mjs'
import {
  runLocalePipelineBuildInputs,
  runLocalePipelineFull,
} from './lib/locale_pipeline_steps.mjs'

const args = process.argv.slice(2)
const jobArgIdx = args.indexOf('--job')
const job = jobArgIdx >= 0 ? args[jobArgIdx + 1] : 'locale-and-scripts'

function assertCargoAvailable() {
  runStep('cargo --version', 'cargo', ['--version'])
}

function runLocaleAndScriptsJob() {
  console.log('\n=== CI job: locale-and-scripts (.github/workflows/ci.yml) ===')

  npmRun('version:check')
  runLocalePipelineFull()
  npmRun('validate:platform-ci-contract')
  npmRun('validate:git-publish-paths')
  npmRun('validate:mac-menu-assets')
  npmRun('validate:app-icons')
  npmRun('validate:release-config')
  npmRun('lint', ['--max-warnings', '100'])

  console.log('\nverify:ci — locale-and-scripts job passed.')
}

function runBuildSmokeJob() {
  console.log('\n=== CI job: build-smoke (.github/workflows/ci.yml) ===')

  assertCargoAvailable()
  runLocalePipelineBuildInputs()
  npmRun('build')
  runCargo(['build', '--manifest-path', 'src-tauri/Cargo.toml'])
  runCargo([
    'test',
    '-p',
    'app',
    'workspace_watch::tests',
    '--manifest-path',
    'src-tauri/Cargo.toml',
    '--',
    '--nocapture',
  ])

  console.log('\nverify:ci — build-smoke job passed.')
}

switch (job) {
  case 'locale-and-scripts':
    runLocaleAndScriptsJob()
    break
  case 'build-smoke':
    runBuildSmokeJob()
    break
  case 'all':
    runLocaleAndScriptsJob()
    runBuildSmokeJob()
    console.log('\nverify:ci — all mirrored CI jobs passed.')
    break
  default:
    console.error(`Unknown --job "${job}". Use locale-and-scripts, build-smoke, or all.`)
    process.exit(2)
}
