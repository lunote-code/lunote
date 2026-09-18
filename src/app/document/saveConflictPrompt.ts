import type { Dispatch, SetStateAction } from 'react'

import type { TranslateFn } from '../../i18n'
import { openSaveConflictDialog, type SaveConflictSourceMode, type SaveConflictState } from './saveConflictState'

export type SaveConflictPromptResult = 'disk' | 'local' | 'cancel'

type PendingPrompt = {
  resolve: (result: SaveConflictPromptResult) => void
}

let pendingPrompt: PendingPrompt | null = null

export function isSaveConflictPromptPending(): boolean {
  return pendingPrompt != null
}

export function resolveSaveConflictPrompt(result: SaveConflictPromptResult): void {
  const pending = pendingPrompt
  if (!pending) return
  pendingPrompt = null
  pending.resolve(result)
}

/** Open the three-way conflict dialog and await the user's choice (disk / local / cancel). */
export async function promptSaveConflict(args: {
  rootDir: string
  path: string
  local: string
  sourceMode?: SaveConflictSourceMode
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setStatus: (msg: string, toneOverride?: import('../hooks/useAppStatus').AppStatusTone) => void
  t: TranslateFn
}): Promise<SaveConflictPromptResult> {
  if (pendingPrompt) return 'cancel'
  const opened = await openSaveConflictDialog(args)
  if (!opened) return 'cancel'
  return new Promise<SaveConflictPromptResult>((resolve) => {
    pendingPrompt = { resolve }
  })
}

export async function promptExternalDriftConflict(args: {
  rootDir: string
  path: string
  local: string
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setStatus: (msg: string, toneOverride?: import('../hooks/useAppStatus').AppStatusTone) => void
  t: TranslateFn
}): Promise<SaveConflictPromptResult> {
  return promptSaveConflict({ ...args, sourceMode: 'external' })
}
