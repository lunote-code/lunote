import { Icon } from '../../design-system/icons'
import type { TranslateFn } from '../../i18n'
import { isValidRecentFilePath } from '../../lib/workspacePathUtils'
import { preventButtonSecondaryMouseDown } from './preventButtonSecondaryMouseDown'

type Props = {
  t: TranslateFn
  recentFiles: readonly string[]
  onOpenRecent: (path: string) => void
  onClearRecent: () => void | Promise<void>
  max?: number
}

function basename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i >= 0 ? norm.slice(i + 1) : norm
}

function parentDir(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i >= 0 ? norm.slice(0, i) : ''
}

export function SidebarRecentFiles({ t, recentFiles, onOpenRecent, onClearRecent, max = 8 }: Props) {
  const items = recentFiles.filter(isValidRecentFilePath).slice(0, max)
  if (items.length === 0) return null

  return (
    <section className="sidebar-recent-files" aria-label={t('app.sidebar.recent.title')}>
      <div className="sidebar-recent-files-title">
        <h3 className="sidebar-recent-files-heading">
          <Icon name="sort-time" size="sm" tone="muted" />
          {t('app.sidebar.recent.title')}
        </h3>
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
      </div>
      <ul className="sidebar-recent-files-list">
        {items.map((path) => {
          const name = basename(path)
          const dir = parentDir(path)
          return (
            <li key={path}>
              <button
                type="button"
                className="sidebar-recent-files-item"
                title={path}
                onMouseDown={preventButtonSecondaryMouseDown}
                onClick={() => onOpenRecent(path)}
              >
                <span className="sidebar-recent-files-name">{name}</span>
                {dir ? <span className="sidebar-recent-files-dir">{dir}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
