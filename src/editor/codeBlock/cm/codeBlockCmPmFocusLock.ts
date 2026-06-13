import type { Editor } from '@tiptap/core'

import { debugCodeBlockCmFocus, isCodeBlockCmFocusDebug } from './codeBlockCmFocusDebug'
import { disablePmCodeBlockMirrorEditing } from './codeBlockCmPmMirror'

/** Soft lock: mirror off + PM dom suspended. Never toggles editor.setEditable (remounts React NodeViews). */
const pmSoftLock = new WeakMap<Editor, boolean>()
const pmDomSuspended = new WeakMap<HTMLElement, true>()
let pmLockGeneration = 0

export type PmLockDebugSnapshot = {
  pmLockGeneration: number
  hasRestoreEntry: boolean
  restoreValue: boolean | null
  isEditable: boolean
  pmHasFocus: boolean
  editorDestroyed: boolean
  pmDomSuspended: boolean
}

export function describePmLockState(editor: Editor): PmLockDebugSnapshot {
  const softLocked = pmSoftLock.has(editor)
  const pmDom = editor.view?.dom
  return {
    pmLockGeneration,
    hasRestoreEntry: softLocked,
    restoreValue: softLocked ? true : null,
    isEditable: editor.isEditable,
    pmHasFocus: editor.view?.hasFocus?.() ?? false,
    editorDestroyed: editor.isDestroyed,
    pmDomSuspended: pmDom instanceof HTMLElement && pmDomSuspended.has(pmDom),
  }
}

function logPmLock(tag: string, editor: Editor, extra?: Record<string, unknown>): void {
  if (!isCodeBlockCmFocusDebug()) return
  debugCodeBlockCmFocus(tag, { ...describePmLockState(editor), ...extra })
}

/** WebKit: PM root must stay non-editable while CM owns focus (restore only on unlock). */
export function suspendPmDomContentEditable(pmDom: HTMLElement | null | undefined): void {
  if (!(pmDom instanceof HTMLElement)) return
  if (pmDomSuspended.has(pmDom)) return
  if (!pmDom.isContentEditable) return
  pmDomSuspended.set(pmDom, true)
  pmDom.setAttribute('contenteditable', 'false')
}

export function restorePmDomContentEditable(pmDom: HTMLElement | null | undefined): void {
  if (!(pmDom instanceof HTMLElement)) return
  if (!pmDomSuspended.has(pmDom)) return
  pmDomSuspended.delete(pmDom)
  pmDom.setAttribute('contenteditable', 'true')
}

/** Heal legacy sessions where a hard lock left PM non-editable before soft-lock refactor. */
function scheduleHealLegacyPmEditable(editor: Editor, tag: string): void {
  requestAnimationFrame(() => {
    queueMicrotask(() => {
      if (editor.isDestroyed) return
      if (!editor.isEditable) {
        editor.setEditable(true)
        logPmLock(tag, editor)
      }
      restorePmDomContentEditable(editor.view?.dom)
    })
  })
}

/** CM editing: suspend PM dom + disable mirror — do not call setEditable(false). */
export function lockPmForCodeBlockCm(editor: Editor, wrap?: HTMLElement | null): void {
  pmSoftLock.set(editor, true)
  disablePmCodeBlockMirrorEditing(wrap ?? null)
  suspendPmDomContentEditable(editor.view?.dom)
  logPmLock('pm-soft-lock-applied', editor, { generation: pmLockGeneration })
}

export function unlockPmForCodeBlockCm(editor: Editor): void {
  const hadSoftLock = pmSoftLock.has(editor)
  pmSoftLock.delete(editor)
  restorePmDomContentEditable(editor.view?.dom)
  if (hadSoftLock) {
    logPmLock('pm-soft-unlock-applied', editor, { generation: pmLockGeneration })
  }
}

/** Fold / toolbar exit: drop soft lock and heal any legacy hard-lock editable state. */
export function releasePmAfterCodeBlockCmToolbar(editor: Editor): void {
  const before = describePmLockState(editor)
  pmLockGeneration += 1
  pmSoftLock.delete(editor)
  restorePmDomContentEditable(editor.view?.dom)
  if (editor.isDestroyed) {
    logPmLock('pm-release-toolbar-destroyed', editor, { before, nextGeneration: pmLockGeneration })
    return
  }
  if (!editor.isEditable) {
    scheduleHealLegacyPmEditable(editor, 'pm-release-toolbar-heal-legacy-editable')
  }
  logPmLock('pm-release-toolbar-applied', editor, {
    before,
    nextGeneration: pmLockGeneration,
    softLockCleared: true,
  })
}

export function isPmLockedForCodeBlockCm(editor: Editor): boolean {
  return pmSoftLock.has(editor)
}

/** PM root was suspended for embedded CM (contenteditable=false on the whole doc). */
export function isPmDomSuspendedForCodeBlockCm(pmDom: HTMLElement | null | undefined): boolean {
  return pmDom instanceof HTMLElement && pmDomSuspended.has(pmDom)
}

export function ensurePmUnlockedForCodeBlockCmOnBoot(editor: Editor): void {
  releasePmAfterCodeBlockCmToolbar(editor)
}

/** Leaving toolbar / re-entering CM: clear soft lock and heal legacy editable if needed. */
export function ensurePmEditableForCodeBlockInteraction(editor: Editor): void {
  releasePmAfterCodeBlockCmToolbar(editor)
}
