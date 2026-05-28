import type { Editor } from '@tiptap/core'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import type { MermaidFlushReason } from './mermaidSourceBridge'
import { registerMermaidSourceBridge } from './mermaidSourceBridge'
import { isMermaidSourcePortalTarget } from './mermaidSourceClipboard'
import { clearInputFocusToken, getInputFocusToken } from './mermaidSourceInputFocus'
import { CODE_BLOCK_INPUT_CLASS } from '../codeBlockRuntime'
import { useCbrBridge } from '../codeBlockRuntime/bridge/useCbrBridge'
import {
  bindMermaidBlockAnchor,
  clearMermaidSourceStore,
  flushActiveMermaidBlock,
  flushAllMermaidBlocks,
  flushMermaidBlockSession,
  getActiveMermaidBlockId,
  getMermaidSessionSnapshot,
  isMermaidSourceComposing,
  notifyMermaidPmDocChanged,
  registerMermaidBlockSession,
  removeMermaidBlockSession,
  setActiveMermaidBlockId,
  setMermaidBlockDraft,
  setMermaidSourceComposing,
  subscribeMermaidSourceStore,
  updateMermaidBlockPos,
  setMermaidCodeTabOpen,
  setActiveMermaidTab,
  type MermaidBlockSession,
  type MermaidViewTab,
} from './mermaidSourceStore'

/** @deprecated use CODE_BLOCK_INPUT_CLASS*/
export const MERMAID_SOURCE_PORTAL_CLASS = CODE_BLOCK_INPUT_CLASS

export type { MermaidBlockSession, MermaidViewTab }

type MermaidSourceSessionContextValue = {
  activeBlockId: string | null
  activeSession: MermaidBlockSession | undefined
  codeTabSessions: MermaidBlockSession[]
  registerBlock: (blockId: string, pos: number, source: string) => void
  updateBlockPos: (blockId: string, pos: number) => void
  bindAnchor: (blockId: string, anchorEl: HTMLElement) => void
  setCodeTabOpen: (blockId: string, open: boolean) => void
  setActiveTab: (blockId: string, tab: MermaidViewTab) => void
  setActiveBlockId: (blockId: string | null) => void
  setDraft: (blockId: string, draft: string) => void
  flushBlock: (editor: Editor, blockId: string, reason: MermaidFlushReason) => boolean
  removeBlock: (blockId: string) => void
  setComposing: (active: boolean) => void
}

const MermaidSourceSessionContext = createContext<MermaidSourceSessionContextValue | null>(null)

function useStoreSnapshot() {
  return useSyncExternalStore(subscribeMermaidSourceStore, getMermaidSessionSnapshot, getMermaidSessionSnapshot)
}

export function isMermaidSourcePanelFocused(): boolean {
  if (typeof document === 'undefined') return false
  const token = getInputFocusToken()
  if (!token) return false
  const el = document.activeElement
  if (!(el instanceof HTMLTextAreaElement) || !isMermaidSourcePortalTarget(el)) return false
  return (
    el.dataset.mermaidBlockId === token.blockId &&
    Number(el.dataset.mermaidFocusId) === token.focusId
  )
}

export function MermaidSourceSessionProvider({
  children,
  editor,
}: {
  children: ReactNode
  editor: Editor | null
}) {
  const snapshot = useStoreSnapshot()
  useCbrBridge(editor)

  const value = useMemo((): MermaidSourceSessionContextValue => {
    const activeSession = snapshot.activeBlockId
      ? snapshot.sessions.get(snapshot.activeBlockId)
      : undefined
    const codeTabSessions: MermaidBlockSession[] = []
    for (const id of snapshot.codeTabBlockIds) {
      const s = snapshot.sessions.get(id)
      if (s?.anchorEl) codeTabSessions.push(s)
    }
    return {
      activeBlockId: snapshot.activeBlockId,
      activeSession,
      codeTabSessions,
      registerBlock: registerMermaidBlockSession,
      updateBlockPos: updateMermaidBlockPos,
      bindAnchor: bindMermaidBlockAnchor,
      setCodeTabOpen: setMermaidCodeTabOpen,
      setActiveTab: setActiveMermaidTab,
      setActiveBlockId: setActiveMermaidBlockId,
      setDraft: setMermaidBlockDraft,
      flushBlock: flushMermaidBlockSession,
      removeBlock: removeMermaidBlockSession,
      setComposing: setMermaidSourceComposing,
    }
  }, [snapshot])

  useEffect(() => {
    if (!editor) {
      registerMermaidSourceBridge(null, null)
      return
    }

    const api = {
      flushCommit: (ed: Editor, reason: MermaidFlushReason, commitId?: string) => {
        const id = getActiveMermaidBlockId()
        if (!id) return false
        return flushMermaidBlockSession(ed, id, reason, commitId)
      },
      notifyPmDocChanged: notifyMermaidPmDocChanged,
      flushBeforeDocChange: (ed: Editor) => flushActiveMermaidBlock(ed, 'transaction'),
      closeSource: (ed?: Editor | null) => {
        if (ed) flushActiveMermaidBlock(ed, 'tab-switch')
        setActiveMermaidBlockId(null)
      },
      isComposing: isMermaidSourceComposing,
    }
    registerMermaidSourceBridge(api, editor)
    return () => registerMermaidSourceBridge(null, null)
  }, [editor])

  useEffect(() => {
    return () => {
      if (editor) {
        flushAllMermaidBlocks(editor, 'document-switch')
        clearInputFocusToken(editor)
      }
      clearMermaidSourceStore()
    }
  }, [editor])

  return <MermaidSourceSessionContext.Provider value={value}>{children}</MermaidSourceSessionContext.Provider>
}

export function useMermaidSourceSession(): MermaidSourceSessionContextValue {
  const ctx = useContext(MermaidSourceSessionContext)
  if (!ctx) {
    throw new Error('useMermaidSourceSession must be used within MermaidSourceSessionProvider')
  }
  return ctx
}

export function useMermaidBlockSession(blockId: string): MermaidBlockSession | undefined {
  const snapshot = useStoreSnapshot()
  return snapshot.sessions.get(blockId)
}

export function useMermaidBlockTab(blockId: string): MermaidViewTab {
  const snapshot = useStoreSnapshot()
  if (!blockId) return 'preview'
  const session = snapshot.sessions.get(blockId)
  if (session) return session.tab
  const pending = snapshot.pendingTabByBlockId.get(blockId)
  if (pending) return pending
  return 'preview'
}
