import { useCallback, useMemo, useState } from 'react'

import type { TranslateFn } from '../../i18n'

const LEGACY_STORAGE_KEY = 'luna:sidebar-onboarding-dismissed'
const NO_WORKSPACE_STORAGE_KEY = 'luna:sidebar-onboarding-dismissed:no-workspace'
const WORKSPACE_STORAGE_KEY = 'luna:sidebar-onboarding-dismissed:workspace'

type Props = {
  t: TranslateFn
  workspaceReady?: boolean
  mainPaneMode?: 'visual' | 'source'
  knowledgeRailVisible?: boolean
  onOpenKnowledgePanel?: () => void
  onToggleMainPaneMode?: () => void
}

export function SidebarWorkspaceOnboarding({
  t,
  workspaceReady = false,
  mainPaneMode = 'visual',
  knowledgeRailVisible = false,
  onOpenKnowledgePanel,
  onToggleMainPaneMode,
}: Props) {
  const storageKey = workspaceReady ? WORKSPACE_STORAGE_KEY : NO_WORKSPACE_STORAGE_KEY
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1' || localStorage.getItem(LEGACY_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(storageKey, '1')
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true)
  }, [storageKey])

  const detailItems = useMemo(
    () =>
      workspaceReady
        ? [
            t('app.sidebar.onboarding.workspacePoint1'),
            t('app.sidebar.onboarding.workspacePoint2'),
            t('app.sidebar.onboarding.workspacePoint3'),
            t('app.sidebar.onboarding.workspacePoint4'),
          ]
        : [
            t('app.sidebar.onboarding.noWorkspacePoint1'),
            t('app.sidebar.onboarding.noWorkspacePoint2'),
            t('app.sidebar.onboarding.noWorkspacePoint3'),
          ],
    [t, workspaceReady],
  )

  const modeToggleLabel =
    mainPaneMode === 'source' ? t('app.toolbar.modeToVisualShort') : t('app.toolbar.modeToSourceShort')

  if (dismissed) return null

  return (
    <div
      className={`sidebar-workspace-onboarding ${workspaceReady ? 'sidebar-workspace-onboarding--workspace' : 'sidebar-workspace-onboarding--no-workspace'}`}
      data-testid="sidebar-workspace-onboarding"
    >
      <p className="sidebar-workspace-onboarding-label">{t('app.sidebar.onboarding.label')}</p>
      <p className="sidebar-workspace-onboarding-title">
        {workspaceReady
          ? t('app.sidebar.onboarding.workspaceTitle')
          : t('app.sidebar.onboarding.noWorkspaceTitle')}
      </p>
      <ul className="sidebar-workspace-onboarding-steps">
        {detailItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {workspaceReady && (onOpenKnowledgePanel || onToggleMainPaneMode) ? (
        <div className="sidebar-workspace-onboarding-actions">
          {onOpenKnowledgePanel ? (
            <button
              type="button"
              className="luna-empty-state-btn-secondary"
              onClick={onOpenKnowledgePanel}
              data-testid="sidebar-workspace-onboarding-open-knowledge"
              aria-pressed={knowledgeRailVisible}
            >
              {t('app.knowledge.showPanel')}
            </button>
          ) : null}
          {onToggleMainPaneMode ? (
            <button
              type="button"
              className="luna-empty-state-btn-secondary"
              onClick={onToggleMainPaneMode}
              data-testid="sidebar-workspace-onboarding-toggle-mode"
            >
              {modeToggleLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="sidebar-workspace-onboarding-dismiss"
        onClick={dismiss}
        data-testid="sidebar-workspace-onboarding-dismiss"
      >
        {t('app.sidebar.onboarding.dismiss')}
      </button>
    </div>
  )
}
