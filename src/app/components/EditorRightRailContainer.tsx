import type { KeyboardEvent, ReactNode } from 'react'
import { useCallback, useRef } from 'react'
import type { TranslateFn } from '../../i18n'
import { preserveBridgeEditorScrollDuring } from '../../editor/editorMutationBridge'
import '../styles/editor-right-rail-tabs.css'

export type EditorRightRailView = 'knowledge' | 'ai'

type Props = {
  t: TranslateFn
  knowledgeOpen: boolean
  aiOpen: boolean
  activeView: EditorRightRailView
  onActiveViewChange: (view: EditorRightRailView) => void
  knowledgePanel: ReactNode
  aiPanel: ReactNode
}

export function EditorRightRailContainer({
  t,
  knowledgeOpen,
  aiOpen,
  activeView,
  onActiveViewChange,
  knowledgePanel,
  aiPanel,
}: Props) {
  const showTabs = knowledgeOpen && aiOpen
  const resolvedView: EditorRightRailView =
    showTabs ? activeView : knowledgeOpen ? 'knowledge' : 'ai'

  const knowledgeTabRef = useRef<HTMLButtonElement>(null)
  const aiTabRef = useRef<HTMLButtonElement>(null)

  const handleActiveViewChange = useCallback(
    (view: EditorRightRailView) => {
      preserveBridgeEditorScrollDuring(() => {
        onActiveViewChange(view)
      })
    },
    [onActiveViewChange],
  )

  const focusTab = useCallback((view: EditorRightRailView) => {
    if (view === 'knowledge') {
      knowledgeTabRef.current?.focus()
      return
    }
    aiTabRef.current?.focus()
  }, [])

  const onTabKeyDown = useCallback(
    (view: EditorRightRailView, event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleActiveViewChange(view)
        return
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const next: EditorRightRailView = view === 'knowledge' ? 'ai' : 'knowledge'
        handleActiveViewChange(next)
        focusTab(next)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        handleActiveViewChange('knowledge')
        focusTab('knowledge')
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        handleActiveViewChange('ai')
        focusTab('ai')
      }
    },
    [focusTab, handleActiveViewChange],
  )

  const knowledgeActive = resolvedView === 'knowledge'
  const aiActive = resolvedView === 'ai'

  return (
    <div className="editor-right-rail-container" data-testid="editor-right-rail-container">
      {showTabs ? (
        <div
          className="editor-right-rail-tabs"
          role="tablist"
          aria-label={t('app.rightRail.tabsAria')}
        >
          <button
            ref={knowledgeTabRef}
            type="button"
            role="tab"
            id="editor-right-rail-tab-knowledge"
            aria-selected={knowledgeActive}
            aria-controls="editor-right-rail-panel-knowledge"
            tabIndex={knowledgeActive ? 0 : -1}
            className={`editor-right-rail-tab${knowledgeActive ? ' editor-right-rail-tab--active' : ''}`}
            onClick={() => handleActiveViewChange('knowledge')}
            onKeyDown={(event) => onTabKeyDown('knowledge', event)}
            data-testid="editor-right-rail-tab-knowledge"
          >
            {t('app.rightRail.tab.knowledge')}
          </button>
          <button
            ref={aiTabRef}
            type="button"
            role="tab"
            id="editor-right-rail-tab-ai"
            aria-selected={aiActive}
            aria-controls="editor-right-rail-panel-ai"
            tabIndex={aiActive ? 0 : -1}
            className={`editor-right-rail-tab${aiActive ? ' editor-right-rail-tab--active' : ''}`}
            onClick={() => handleActiveViewChange('ai')}
            onKeyDown={(event) => onTabKeyDown('ai', event)}
            data-testid="editor-right-rail-tab-ai"
          >
            {t('app.rightRail.tab.ai')}
          </button>
        </div>
      ) : null}
      <div className="editor-right-rail-panels">
        {knowledgeOpen ? (
          <div
            id="editor-right-rail-panel-knowledge"
            role="tabpanel"
            aria-labelledby="editor-right-rail-tab-knowledge"
            className={`editor-right-rail-panel${knowledgeActive ? '' : ' editor-right-rail-panel--inactive'}`}
            aria-hidden={!knowledgeActive}
            {...(!knowledgeActive ? { inert: true } : {})}
          >
            {knowledgePanel}
          </div>
        ) : null}
        {aiOpen ? (
          <div
            id="editor-right-rail-panel-ai"
            role="tabpanel"
            aria-labelledby="editor-right-rail-tab-ai"
            className={`editor-right-rail-panel${aiActive ? '' : ' editor-right-rail-panel--inactive'}`}
            aria-hidden={!aiActive}
            {...(!aiActive ? { inert: true } : {})}
          >
            {aiPanel}
          </div>
        ) : null}
      </div>
    </div>
  )
}
