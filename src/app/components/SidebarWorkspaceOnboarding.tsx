import { useCallback, useEffect, useMemo, useState } from 'react'

import type { TranslateFn } from '../../i18n'
import {
  LEGACY_SIDEBAR_ONBOARDING_KEY,
  NO_WORKSPACE_SIDEBAR_ONBOARDING_KEY,
  SIDEBAR_ONBOARDING_RESET_EVENT,
  WORKSPACE_SIDEBAR_ONBOARDING_KEY,
} from '../sidebarOnboardingStorage'

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
  const storageKey = workspaceReady ? WORKSPACE_SIDEBAR_ONBOARDING_KEY : NO_WORKSPACE_SIDEBAR_ONBOARDING_KEY
  const [dismissed, setDismissed] = useState(() => {
    try {
      return (
        localStorage.getItem(storageKey) === '1' || localStorage.getItem(LEGACY_SIDEBAR_ONBOARDING_KEY) === '1'
      )
    } catch {
      return false
    }
  })

  useEffect(() => {
    const onReset = () => setDismissed(false)
    window.addEventListener(SIDEBAR_ONBOARDING_RESET_EVENT, onReset)
    return () => window.removeEventListener(SIDEBAR_ONBOARDING_RESET_EVENT, onReset)
  }, [])

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
