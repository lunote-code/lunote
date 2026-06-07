#!/usr/bin/env node
/**
 * Local pre-push check mirroring locale-pipeline with validation + git cleanliness.
 * Run: npm run verify:locale-pipeline
 */
import { runLocalePipelineFull } from './lib/locale_pipeline_steps.mjs'

console.log('verify:locale-pipeline — mirror of locale-pipeline (run-validation + check-git-clean)')
runLocalePipelineFull()
console.log('\nverify:locale-pipeline: all checks passed.')
