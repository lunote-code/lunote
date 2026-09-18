import { ChangeSet, Text } from '@codemirror/state'

import { EditorOpenReason, shouldPreserveUndoLogOnVisualCreate } from '../editor/editorOpenReason'
import { projectStepLogMarkdownForPane } from './modeSwitchUndoBridge'
import {
  freezeStepLogBodiesForModeSwitch,
  getUndoDepth,
  peekForUndo,
  pushStepEntry,
  resetStepLog,
  type CMChangeEntry,
  type MarkdownBodyEntry,
  type PMStepEntry,
} from './vmStepLog'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

function pmEntry(bodyBefore: string, bodyAfter: string): PMStepEntry {
  return {
    kind: 'pm-steps',
    invertedSteps: [],
    forwardSteps: [],
    selectionBefore: { from: 1, to: 1 },
    selectionAfter: { from: 2, to: 2 },
    bodyBefore,
    bodyAfter,
  }
}

function cmEntry(before: string, after: string): CMChangeEntry {
  const start = Text.of(before.split('\n'))
  const changes = ChangeSet.of({ from: before.length, insert: after.slice(before.length) }, before.length)
  return {
    kind: 'cm-change',
    inverseChanges: changes.invert(start),
    forwardChanges: changes,
    selectionBefore: { from: before.length, to: before.length },
    selectionAfter: { from: after.length, to: after.length },
    bodyBefore: before,
    bodyAfter: after,
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'visual typing freeze becomes markdown-body so source undo can restore it',
    run: () => {
      const docId = 'qa:mode-switch-undo-visual'
      resetStepLog(docId)
      pushStepEntry(docId, pmEntry('Hello', 'Hello extra'))
      freezeStepLogBodiesForModeSwitch(docId)
      assertEqual(getUndoDepth(docId), 1, 'depth')
      const top = peekForUndo(docId)
      assertEqual(top?.kind, 'markdown-body', 'kind')
      const body = top as MarkdownBodyEntry
      assertEqual(body.before, 'Hello', 'before')
      assertEqual(body.after, 'Hello extra', 'after')
      assertEqual(body.surface, 'visual', 'surface')
      resetStepLog(docId)
    },
  },
  {
    name: 'source typing freeze becomes markdown-body so visual undo can restore it',
    run: () => {
      const docId = 'qa:mode-switch-undo-source'
      resetStepLog(docId)
      pushStepEntry(docId, cmEntry('alpha', 'alpha beta'))
      freezeStepLogBodiesForModeSwitch(docId)
      const top = peekForUndo(docId)
      assertEqual(top?.kind, 'markdown-body', 'kind')
      const body = top as MarkdownBodyEntry
      assertEqual(body.before, 'alpha', 'before')
      assertEqual(body.after, 'alpha beta', 'after')
      assertEqual(body.surface, 'source', 'surface')
      resetStepLog(docId)
    },
  },
  {
    name: 'visual body is merged with YAML when undoing in source',
    run: () => {
      const projected = projectStepLogMarkdownForPane({
        markdown: 'body only',
        surface: 'visual',
        pane: 'source',
        docId: 'note.md',
      })
      assertEqual(projected.includes('body only'), true, 'keeps body')
    },
  },
  {
    name: 'source YAML is stripped when undoing in visual',
    run: () => {
      const projected = projectStepLogMarkdownForPane({
        markdown: '---\ntitle: x\n---\nHello\n',
        surface: 'source',
        pane: 'visual',
        docId: 'note.md',
      })
      assertEqual(projected, 'Hello\n', 'body only')
    },
  },
  {
    name: 'unstamped native steps are dropped on freeze so remount cannot replay them',
    run: () => {
      const docId = 'qa:mode-switch-undo-drop'
      resetStepLog(docId)
      pushStepEntry(docId, {
        kind: 'pm-steps',
        invertedSteps: [],
        forwardSteps: [],
        selectionBefore: { from: 1, to: 1 },
        selectionAfter: { from: 1, to: 1 },
      })
      freezeStepLogBodiesForModeSwitch(docId)
      assertEqual(getUndoDepth(docId), 0, 'dropped')
      resetStepLog(docId)
    },
  },
  {
    name: 'visual create preserves undo only for mode-switch restore',
    run: () => {
      assertEqual(
        shouldPreserveUndoLogOnVisualCreate(EditorOpenReason.ModeSwitchRestore),
        true,
        'restore',
      )
      assertEqual(shouldPreserveUndoLogOnVisualCreate(EditorOpenReason.ColdOpen), false, 'cold')
    },
  },
])

export async function assertModeSwitchUndoSuite(): Promise<{ passed: number; failed: number }> {
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
