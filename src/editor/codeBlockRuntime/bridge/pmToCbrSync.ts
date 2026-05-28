import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'

import { isMermaidSourceComposing } from '../../mermaid/mermaidSourceStore'
import { getBlock, removeBlock as removeCbrBlock } from '../codeBlockRuntimeStore'
import {
  createBlockPatch,
  inferPmPatchSource,
  redoRuntimeSnapshot,
  restoreRuntimeSnapshot,
  runBlockTransaction,
  undoRuntimeSnapshot,
} from '../kernel'
import { commitPmDerived, publishCanonicalSnapshot } from '../../documentRuntime/sourceOfTruth'
import {
  clearCommitTracking,
  getCbrCommitMeta,
  shouldSkipPmToCbr,
  transactionsIncludeCbrOrigin,
} from './syncGuard'
import {
  getPmMetaForBlock,
  listPmMetaBlockIds,
  removePmMeta,
  updatePmMetaPos,
} from './pmBlockRegistry'
import { scanPmCodeBlocks } from './pmBlockScan'

let syncScheduled = false

function syncPmDocToCbrInternal(editor: Editor, transactions?: readonly Transaction[]): void {
  const patchSource = inferPmPatchSource(transactions)

  if (patchSource === 'undo') {
    const snap = undoRuntimeSnapshot()
    if (snap) {
      restoreRuntimeSnapshot(snap, 'undo')
      publishCanonicalSnapshot()
      return
    }
  }

  if (patchSource === 'redo') {
    const snap = redoRuntimeSnapshot()
    if (snap) {
      restoreRuntimeSnapshot(snap, 'redo')
      publishCanonicalSnapshot()
      return
    }
  }

  const scanned = scanPmCodeBlocks(editor)
  const seen = new Set<string>()
  const pendingPatches: ReturnType<typeof createBlockPatch>[] = []

  for (const entry of scanned) {
    seen.add(entry.blockId)
    const meta = getPmMetaForBlock(entry.blockId)
    if (!meta) continue

    if (meta.pos !== entry.pos) {
      updatePmMetaPos(entry.blockId, entry.pos)
    }

    const runtime = getBlock(entry.blockId)
    if (!runtime) continue

    if (
      shouldSkipPmToCbr({
        blockId: entry.blockId,
        pmSource: entry.source,
        cbrDraft: runtime.state.draft,
        incomingCommitId: meta.commitId,
        isComposing: isMermaidSourceComposing(),
      })
    ) {
      continue
    }

    pendingPatches.push(
      createBlockPatch(
        entry.blockId,
        { draft: entry.source },
        patchSource,
        meta.commitId,
      ),
    )
  }

  const removedIds: string[] = []
  for (const blockId of listPmMetaBlockIds()) {
    if (!seen.has(blockId)) {
      removedIds.push(blockId)
    }
  }

  const patchSourceFinal =
    pendingPatches.length > 1 && patchSource === 'pm' ? 'paste' : patchSource

  runBlockTransaction(
    () => {
      if (pendingPatches.length > 0) {
        commitPmDerived(
          pendingPatches.map((p) => ({ ...p, source: patchSourceFinal })),
          { label: `pm-sync:${patchSourceFinal}`, editor },
        )
      }
      for (const blockId of removedIds) {
        removePmMeta(blockId)
        removeCbrBlock(blockId)
        clearCommitTracking(blockId)
      }
    },
    {
      label: `pm-sync:${patchSourceFinal}`,
      recordHistory: patchSource !== 'undo' && patchSource !== 'redo',
      pmTransactions: transactions,
    },
  )
}

/** PM → CBR: post-transaction synchronization draft / pos (with guard, no loop triggered)*/
export function syncPmDocToCbr(editor: Editor, transactions?: readonly Transaction[]): void {
  if (transactions?.length && transactionsIncludeCbrOrigin(transactions)) return

  for (const tr of transactions ?? []) {
    const meta = getCbrCommitMeta(tr)
    if (meta) return
  }

  syncPmDocToCbrInternal(editor, transactions)
}

/** Merge multiple transaction notifications within the same tick*/
export function scheduleSyncPmDocToCbr(editor: Editor, transactions?: readonly Transaction[]): void {
  if (syncScheduled) return
  syncScheduled = true
  queueMicrotask(() => {
    syncScheduled = false
    syncPmDocToCbr(editor, transactions)
  })
}

export function notifyPmDocChangedForBridge(editor: Editor, transactions?: readonly Transaction[]): void {
  scheduleSyncPmDocToCbr(editor, transactions)
}
