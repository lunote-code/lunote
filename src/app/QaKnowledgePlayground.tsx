import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { I18nProvider } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import {
  absolutePathToDocKeyOs,
  initKnowledgeOS,
  onKnowledgeOSWorkspaceOpened,
  openNoteInWorkspace,
  setBacklinkPanelDocKey,
} from '../editor/knowledgeOS/index'
import { KnowledgeRightRail } from '../editor/knowledgeOS/ui/KnowledgeRightRail'
import { KnowledgeSearchModal } from '../editor/knowledgeOS/ui/KnowledgeSearchModal'
import { registerKnowledgeInteractionHost } from '../editor/knowledgeOS/ui/knowledgeInteractionHost'
import {
  bootstrapWorkspaceLinkGraphIndex,
  openVault,
  resetKnowledgeRuntime,
  waitForLinkIndexReady,
} from '../editor/knowledgeRuntime'
import type { AbsoluteDocPath } from '../editor/knowledgeRuntime/types'

export const QA_KNOWLEDGE_ROOT = '/qa-vault'

export const QA_KNOWLEDGE_FIXTURES: Record<string, string> = {
  'note-a.md': '# Note A\n\nSee [[note-b]] for details.\n',
  'note-b.md': '# Note B\n\nReferenced from [[note-a]]. #project\n',
}

export type QaKnowledgeNoteId = 'note-a' | 'note-b'

declare global {
  interface Window {
    __QA_KNOWLEDGE__?: {
      activeDocKey: () => string | null
      setActiveNote: (note: QaKnowledgeNoteId) => void
      openSearch: () => void
      closeSearch: () => void
      countInRail: (selector: string) => number
      backlinkSourceTitles: () => string[]
    }
  }
}

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

function notePath(note: QaKnowledgeNoteId): AbsoluteDocPath {
  return `${QA_KNOWLEDGE_ROOT}/${note}.md`
}

function QaKnowledgeInner() {
  const [status, setStatus] = useState('booting')
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null)
  const [railVisible, setRailVisible] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const activeDocKeyRef = useRef<string | null>(null)

  const activateNote = useCallback((note: QaKnowledgeNoteId) => {
    const path = notePath(note)
    const docKey = absolutePathToDocKeyOs(path, QA_KNOWLEDGE_ROOT)
    openNoteInWorkspace(path, docKey)
    setBacklinkPanelDocKey(docKey)
    activeDocKeyRef.current = docKey
    setActiveDocKey(docKey)
  }, [])

  useEffect(() => {
    window.__QA_KNOWLEDGE__ = {
      activeDocKey: () => activeDocKeyRef.current,
      setActiveNote: activateNote,
      openSearch: () => setSearchOpen(true),
      closeSearch: () => setSearchOpen(false),
      countInRail: (selector) => document.querySelectorAll(`.qa-knowledge-rail ${selector}`).length,
      backlinkSourceTitles: () =>
        Array.from(document.querySelectorAll('.qa-knowledge-rail .kos-backlink-source')).map(
          (el) => el.textContent?.trim() ?? '',
        ),
    }
    return () => {
      delete window.__QA_KNOWLEDGE__
    }
  }, [activateNote])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      resetKnowledgeRuntime()
      openVault(QA_KNOWLEDGE_ROOT)
      initKnowledgeOS()
      onKnowledgeOSWorkspaceOpened(QA_KNOWLEDGE_ROOT)

      registerKnowledgeInteractionHost({
        getRootDir: () => QA_KNOWLEDGE_ROOT,
        openAbsolutePath: (absolutePath) => {
          const docKey = absolutePathToDocKeyOs(absolutePath, QA_KNOWLEDGE_ROOT)
          openNoteInWorkspace(absolutePath, docKey)
          setBacklinkPanelDocKey(docKey)
          activeDocKeyRef.current = docKey
          setActiveDocKey(docKey)
        },
        clearEditorSelection: () => {},
        focusEditor: () => {},
        onHoverIdChange: () => {},
        openSearchModal: () => setSearchOpen(true),
        revealNavigationAnchor: () => {},
        updateDocumentFrontmatter: async () => false,
      })

      const paths = Object.keys(QA_KNOWLEDGE_FIXTURES).map(
        (file) => `${QA_KNOWLEDGE_ROOT}/${file}` as AbsoluteDocPath,
      )
      await bootstrapWorkspaceLinkGraphIndex(QA_KNOWLEDGE_ROOT, paths, async (path) => {
        const rel = path.replace(`${QA_KNOWLEDGE_ROOT}/`, '')
        return QA_KNOWLEDGE_FIXTURES[rel] ?? ''
      })

      const indexReady = await waitForLinkIndexReady(15_000)
      if (cancelled) return
      if (!indexReady) {
        setStatus('error:index-timeout')
        return
      }

      activateNote('note-b')
      setStatus('ready')
    })()

    return () => {
      cancelled = true
      registerKnowledgeInteractionHost(null)
    }
  }, [activateNote])

  const shellClass = useMemo(
    () => ['preview-pane', 'markdown-visual-editor', 'qa-knowledge-shell'].filter(Boolean).join(' '),
    [],
  )

  return (
    <div style={{ padding: 24, background: '#0f1115', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Knowledge QA</h1>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-active-doc" style={{ color: '#94a3b8' }}>
        active={activeDocKey ?? 'none'}
      </p>
      <div className={shellClass} style={{ display: 'flex', maxWidth: 980, minHeight: 520 }}>
        <div style={{ flex: 1, padding: 16, color: '#cbd5e1' }} data-testid="qa-editor-stub">
          Editor stub — knowledge rail on the right.
        </div>
        <div className="qa-knowledge-rail" style={{ width: 360, minWidth: 280 }}>
          <KnowledgeRightRail
            activeDocKey={activeDocKey}
            visible={railVisible}
            onOpenSearch={() => setSearchOpen(true)}
            onClose={() => setRailVisible(false)}
          />
        </div>
      </div>
      <KnowledgeSearchModal
        open={searchOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  )
}

export function QaKnowledgePlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaKnowledgeInner />
    </I18nProvider>
  )
}
