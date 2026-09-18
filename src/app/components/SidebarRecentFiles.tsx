import { useEffect, useState } from 'react'
import { Icon } from '../../design-system/icons'
import type { TranslateFn } from '../../i18n'
import { pathBasename, pathParentDir } from '../../lib/recentPathDisplay'
import {
  filterRecentFilesForDisplay,
  isValidRecentWorkspacePath,
} from '../../lib/workspacePathUtils'
import { preventButtonSecondaryMouseDown } from './preventButtonSecondaryMouseDown'

const SIDEBAR_RECENT_COLLAPSED_KEY = 'sidebarRecentCollapsed'

type Props = {
  t: TranslateFn
  recentWorkspaces: readonly string[]
  recentFiles: readonly string[]
  onOpenRecentWorkspace: (path: string) => void
  onOpenRecent: (path: string) => void
  onClearRecent: () => void | Promise<void>
  maxFolders?: number
  maxFiles?: number
  collapsible?: boolean
  defaultCollapsed?: boolean
  collapsedStorageKey?: string
  includeWorkspaces?: boolean
}

export function SidebarRecentFiles({
  t,
  recentWorkspaces,
  recentFiles,
  onOpenRecentWorkspace,
  onOpenRecent,
  onClearRecent,
  maxFolders = 8,
  maxFiles = 8,
  collapsible = false,
  defaultCollapsed = true,
  collapsedStorageKey = SIDEBAR_RECENT_COLLAPSED_KEY,
  includeWorkspaces = true,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try {
      const saved = localStorage.getItem(collapsedStorageKey)
      if (saved === '0') return false
      if (saved === '1') return true
    } catch {
      /* ignore */
    }
    return defaultCollapsed
  })

  useEffect(() => {
    if (!collapsible) return
    try {
      localStorage.setItem(collapsedStorageKey, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed, collapsible, collapsedStorageKey])

  const folders = includeWorkspaces
    ? recentWorkspaces.filter(isValidRecentWorkspacePath).slice(0, maxFolders)
    : []
  const files = filterRecentFilesForDisplay(recentFiles, folders).slice(0, maxFiles)
  if (folders.length === 0 && files.length === 0) return null

  const showDivider = folders.length > 0 && files.length > 0

  const toggleCollapsed = () => {
    setCollapsed((value) => !value)
  }

  const list = (
    <ul className="sidebar-recent-files-list">
      {folders.map((path) => {
        const name = pathBasename(path) || path
        const dir = pathParentDir(path)
        return (
          <li key={`ws:${path}`}>
            <button
              type="button"
              className="sidebar-recent-files-item sidebar-recent-files-item--folder"
              title={path}
              onMouseDown={preventButtonSecondaryMouseDown}
              onClick={() => onOpenRecentWorkspace(path)}
            >
              <span className="sidebar-recent-files-leading" aria-hidden>
                <Icon name="workspace-open" size="sm" tone="muted" />
              </span>
              <span className="sidebar-recent-files-text">
                <span className="sidebar-recent-files-name">{name}</span>
                {dir ? <span className="sidebar-recent-files-dir">{dir}</span> : null}
              </span>
            </button>
          </li>
        )
      })}
      {showDivider ? (
        <li className="sidebar-recent-files-divider" role="separator" aria-hidden />
      ) : null}
      {files.map((path) => {
        const name = pathBasename(path)
        const dir = pathParentDir(path)
        return (
          <li key={`file:${path}`}>
            <button
              type="button"
              className="sidebar-recent-files-item sidebar-recent-files-item--file"
              title={path}
              data-testid="sidebar-recent-file"
              data-recent-path={path}
              onMouseDown={preventButtonSecondaryMouseDown}
              onClick={() => onOpenRecent(path)}
            >
              <span className="sidebar-recent-files-leading" aria-hidden>
                <Icon name="note" size="sm" tone="muted" />
              </span>
              <span className="sidebar-recent-files-text">
                <span className="sidebar-recent-files-name">{name}</span>
                {dir ? <span className="sidebar-recent-files-dir">{dir}</span> : null}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <section
      className={`sidebar-recent-files${collapsible ? ' sidebar-recent-files--collapsible' : ''}${collapsed ? ' is-collapsed' : ''}`}
      aria-label={t('app.sidebar.recent.title')}
      data-testid="sidebar-recent-files"
    >
      <div className="sidebar-recent-files-title">
        {collapsible ? (
          <button
            type="button"
            className="sidebar-recent-files-toggle"
            aria-expanded={!collapsed}
            aria-label={t('app.sidebar.recent.title')}
            data-testid="sidebar-recent-toggle"
            onMouseDown={preventButtonSecondaryMouseDown}
            onClick={toggleCollapsed}
          >
            <Icon
              name="chevron-right"
              size="sm"
              tone="muted"
              className="sidebar-recent-files-chevron"
            />
            <span className="sidebar-recent-files-heading">
              <Icon name="sort-time" size="sm" tone="muted" />
              {t('app.sidebar.recent.title')}
            </span>
          </button>
        ) : (
          <h3 className="sidebar-recent-files-heading">
            <Icon name="sort-time" size="sm" tone="muted" />
            {t('app.sidebar.recent.title')}
          </h3>
        )}
        {!collapsed ? (
          <button
            type="button"
            className="sidebar-recent-files-clear"
            onMouseDown={preventButtonSecondaryMouseDown}
            onClick={() => void onClearRecent()}
            title={t('menu.file.clearRecent')}
            aria-label={t('menu.file.clearRecent')}
          >
            {t('app.sidebar.recent.clear')}
          </button>
        ) : null}
      </div>
      {!collapsed ? list : null}
    </section>
  )
}
