import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import { getEnMessagesSnapshot } from '../i18n/localeRegistry'
import { Icon } from '../design-system/icons'
import { EditorTabBar } from './components/EditorTabBar'
import { EditorRightRailContainer, type EditorRightRailView } from './components/EditorRightRailContainer'
import { AppToastHost } from './components/AppToastHost'
import { pushAppToast } from './toast/appToastStore'
import type { AppStatusTone } from './hooks/useAppStatus'

const QA_BOOTSTRAP = {
  mergedMessages: getEnMessagesSnapshot(),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getEnMessagesSnapshot(),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const QA_TABS = ['/qa-vault/welcome.md', '/qa-vault/notes.md'] as const

declare global {
  interface Window {
    __QA_APP_UX_P1__?: {
      pushToast: (message: string, tone?: AppStatusTone) => void
      getToastMessages: () => string[]
      getToastTones: () => AppStatusTone[]
      dismissFirstToast: () => void
      toggleKnowledge: () => void
      toggleAi: () => void
      isKnowledgeOpen: () => boolean
      isAiOpen: () => boolean
      getActiveRightRailView: () => EditorRightRailView
      setActiveRightRailView: (view: EditorRightRailView) => void
      areBothPanelsOpen: () => boolean
      isRightRailTabsVisible: () => boolean
    }
  }
}

function QaAppUxP1Inner() {
  const { t } = useI18n()
  const [status, setStatus] = useState('ready')
  const [openedTabs] = useState<string[]>([...QA_TABS])
  const [activePath] = useState<string>(QA_TABS[0])
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [activeView, setActiveView] = useState<EditorRightRailView>('knowledge')

  const knowledgeOpenRef = useRef(knowledgeOpen)
  const aiOpenRef = useRef(aiOpen)
  const activeViewRef = useRef(activeView)

  knowledgeOpenRef.current = knowledgeOpen
  aiOpenRef.current = aiOpen
  activeViewRef.current = activeView

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const toggleKnowledge = useCallback(() => {
    setKnowledgeOpen((visible) => {
      const next = !visible
      if (next) setActiveView('knowledge')
      return next
    })
    setStatus('knowledge:toggle')
  }, [])

  const toggleAi = useCallback(() => {
    setAiOpen((visible) => {
      const next = !visible
      if (next) setActiveView('ai')
      return next
    })
    setStatus('ai:toggle')
  }, [])

  useEffect(() => {
    window.__QA_APP_UX_P1__ = {
      pushToast: (message, tone = 'success') => {
        pushAppToast(message, tone)
        setStatus(`toast:${tone}`)
      },
      getToastMessages: () =>
        [...document.querySelectorAll('.app-toast-message')].map((node) => node.textContent ?? ''),
      getToastTones: () =>
        [...document.querySelectorAll('[data-testid="app-toast"]')].map(
          (node) => (node.getAttribute('data-tone') as AppStatusTone | null) ?? 'neutral',
        ),
      dismissFirstToast: () => {
        const dismiss = document.querySelector('.app-toast-dismiss') as HTMLButtonElement | null
        dismiss?.click()
      },
      toggleKnowledge: () => toggleKnowledge(),
      toggleAi: () => toggleAi(),
      isKnowledgeOpen: () => knowledgeOpenRef.current,
      isAiOpen: () => aiOpenRef.current,
      getActiveRightRailView: () => activeViewRef.current,
      setActiveRightRailView: (view) => {
        setActiveView(view)
        setStatus(`rail-view:${view}`)
      },
      areBothPanelsOpen: () => knowledgeOpenRef.current && aiOpenRef.current,
      isRightRailTabsVisible: () =>
        Boolean(document.querySelector('[data-testid="editor-right-rail-tab-knowledge"]')),
    }
    return () => {
      delete window.__QA_APP_UX_P1__
    }
  }, [toggleAi, toggleKnowledge])

  const trailingActions = useMemo(
    () => (
      <>
        <button
          type="button"
          className={`luna-chrome-icon-btn editor-chrome-action-btn${knowledgeOpen ? ' luna-chrome-icon-btn--active' : ''}`}
          data-testid="editor-knowledge-toggle"
          aria-pressed={knowledgeOpen}
          aria-label={knowledgeOpen ? t('app.knowledge.hidePanel') : t('app.knowledge.showPanel')}
          onClick={toggleKnowledge}
        >
          <Icon name="graph" size="sm" stroke="strong" />
        </button>
        <button
          type="button"
          className={`luna-chrome-icon-btn editor-chrome-action-btn${aiOpen ? ' luna-chrome-icon-btn--active' : ''}`}
          data-testid="editor-ai-toggle"
          aria-pressed={aiOpen}
          aria-label={aiOpen ? t('app.ai.hidePanel') : t('app.ai.showPanel')}
          onClick={toggleAi}
        >
          <Icon name="ai" size="sm" stroke="strong" />
        </button>
      </>
    ),
    [aiOpen, knowledgeOpen, t, toggleAi, toggleKnowledge],
  )

  return (
    <div className="qa-app-ux-p1-shell" style={{ padding: 24, minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">App UX P1 QA</h1>
      <p data-testid="qa-status">{status}</p>

      <div
        data-testid="qa-app-ux-p1-layout"
        className="layout workspace-split mod-root"
        style={{ display: 'flex', minHeight: 360, border: '1px solid var(--border-subtle)' }}
      >
        <main
          className="main main-with-rail workspace-leaf mod-active"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
        >
          <EditorTabBar
            t={t}
            openedTabs={openedTabs}
            activePath={activePath}
            externalDiskChangedPaths={new Set()}
            tabLabel={tabLabel}
            onActivate={() => undefined}
            onClose={() => undefined}
            onReorder={() => undefined}
            onContextMenu={() => undefined}
            trailingActions={trailingActions}
          />
          <div data-testid="qa-app-ux-p1-editor-pane" style={{ flex: 1, padding: 12 }}>
            Editor pane
          </div>
        </main>

        {knowledgeOpen || aiOpen ? (
          <aside
            data-testid="qa-app-ux-p1-right-rail"
            className="editor-right-rail"
            style={{ width: 280, borderLeft: '1px solid var(--border-subtle)' }}
          >
            <EditorRightRailContainer
              t={t}
              knowledgeOpen={knowledgeOpen}
              aiOpen={aiOpen}
              activeView={activeView}
              onActiveViewChange={setActiveView}
              knowledgePanel={
                <div data-testid="qa-knowledge-rail-panel" className="qa-knowledge-rail-panel">
                  Knowledge panel
                </div>
              }
              aiPanel={
                <div data-testid="qa-ai-rail-panel" className="qa-ai-rail-panel">
                  AI panel
                </div>
              }
            />
          </aside>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          data-testid="qa-push-success-toast"
          onClick={() => {
            pushAppToast('Operation complete', 'success')
            setStatus('toast:success')
          }}
        >
          Push success toast
        </button>
        <button
          type="button"
          data-testid="qa-push-error-toast"
          onClick={() => {
            pushAppToast('Save failed', 'error')
            setStatus('toast:error')
          }}
        >
          Push error toast
        </button>
      </div>
    </div>
  )
}

export function QaAppUxP1Playground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <AppToastHost />
      <QaAppUxP1Inner />
    </I18nProvider>
  )
}
