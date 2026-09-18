import {
  isHardBlockTypeForClickBelow,
  resolveHardBlockGapInsertPos,
} from './codeBlockClickBelow'
import { shouldCancelMathPreviewQuickEdit } from '../../mathPreviewQuickEdit'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'click-below applies to mermaid/math/html as well as fenced code',
    run: () => {
      assert(isHardBlockTypeForClickBelow('codeBlock'), 'codeBlock')
      assert(isHardBlockTypeForClickBelow('mermaidBlock'), 'mermaidBlock')
      assert(isHardBlockTypeForClickBelow('blockMath'), 'blockMath')
      assert(isHardBlockTypeForClickBelow('rawBlock'), 'rawBlock')
      assert(isHardBlockTypeForClickBelow('drawingBlock'), 'drawingBlock')
      assert(!isHardBlockTypeForClickBelow('paragraph'), 'paragraph is not a hard block')
      assert(!isHardBlockTypeForClickBelow('heading'), 'heading is not a hard block')
    },
  },
  {
    name: 'pointer in the seam between adjacent hard blocks inserts between them',
    run: () => {
      const insertPos = resolveHardBlockGapInsertPos(
        [
          { type: 'mermaidBlock', top: 10, bottom: 80, posAfter: 12, containsTarget: false },
          { type: 'codeBlock', top: 88, bottom: 160, posAfter: 40, containsTarget: false },
        ],
        84,
      )
      assert(insertPos === 12, 'seam click must insert after the first hard block')
    },
  },
  {
    name: 'pointer inside either adjacent hard block does not insert a seam paragraph',
    run: () => {
      const insertPos = resolveHardBlockGapInsertPos(
        [
          { type: 'mermaidBlock', top: 10, bottom: 80, posAfter: 12, containsTarget: true },
          { type: 'codeBlock', top: 88, bottom: 160, posAfter: 40, containsTarget: false },
        ],
        84,
      )
      assert(insertPos == null, 'clicking mermaid itself must not insert a seam paragraph')
    },
  },
  {
    name: 'math preview quick-edit cancels when the pointer leaves the formula host',
    run: () => {
      assert(!shouldCancelMathPreviewQuickEdit(true), 'inside pointer must keep the timer')
      assert(shouldCancelMathPreviewQuickEdit(false), 'outside pointer must cancel')
      assert(shouldCancelMathPreviewQuickEdit(null), 'missing host must cancel')
    },
  },
])

export async function assertHardBlockPointerCaretSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { passed, failed }
}
