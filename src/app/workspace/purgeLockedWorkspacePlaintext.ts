import { isTauri } from '@tauri-apps/api/core'

import {
  getActiveVaultSession,
  openVault,
  resetKnowledgeRuntime,
} from '../../editor/knowledgeRuntime'
import { purgeOpenDocumentPlaintext, dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { clearWorkspaceClientMemory, type ClearWorkspaceClientMemoryOptions } from './clearWorkspaceClientMemory'
import { cancelBackgroundWorkspaceIndexing, refreshWorkspaceIndex } from './workspaceIndexCoordinator'
import { isBufferTabId } from './constants'

/** Drop plaintext working copies after the workspace key is locked. Keep tabs/root for reload. */
export function purgeLockedWorkspacePlaintext(options: ClearWorkspaceClientMemoryOptions = {}): void {
  cancelBackgroundWorkspaceIndexing()
  const vaultRoot = getActiveVaultSession()?.rootDir?.trim() || options.previousRoot?.trim()
  purgeOpenDocumentPlaintext()
  resetKnowledgeRuntime()
  if (vaultRoot) openVault(vaultRoot)
  clearWorkspaceClientMemory({
    ...options,
    preserveTabEditorSessions: options.preserveTabEditorSessions !== false,
  })
}

/** Re-read the active document and native search index after unlock. */
export async function reloadLockedWorkspaceSession(root: string, activePath: string): Promise<void> {
  const trimmed = root.trim()
  if (!trimmed) return
  if (activePath && !isBufferTabId(activePath)) {
    await dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT',
      root: trimmed,
      path: activePath,
      source: 'idle-unlock-reload',
    })
  }
  if (isTauri()) {
    await refreshWorkspaceIndex(trimmed)
  }
}
