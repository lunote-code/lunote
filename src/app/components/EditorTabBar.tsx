import type { KeyboardEvent, MouseEvent } from 'react'

import { Icon } from '../../design-system/icons/Icon'
import type { TranslateFn } from '../../i18n'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { isPathDirty } from '../../lib/documentDirty'
import { preventButtonSecondaryMouseDown } from './preventButtonSecondaryMouseDown'

type Props = {
  t: TranslateFn
  openedTabs: string[]
  activePath: string
  externalDiskChangedPaths: ReadonlySet<string>
  tabLabel: (path: string) => string
  onActivate: (path: string) => void
  onClose: (path: string) => void
  onContextMenu: (e: MouseEvent, path: string, index: number) => void
}

function hasExternalDiskDrift(path: string, externalDiskChangedPaths: ReadonlySet<string>): boolean {
  for (const p of externalDiskChangedPaths) {
    if (pathsEqual(p, path)) return true
  }
  return false
}

export function EditorTabBar({
  t,
  openedTabs,
  activePath,
  externalDiskChangedPaths,
  tabLabel,
  onActivate,
  onClose,
  onContextMenu,
}: Props) {
  return (
    <div className="editor-tabs-strip" data-testid="editor-tabs-strip">
      <div className="editor-tabs" role="tablist" aria-label={t('app.tabs.aria')} data-testid="editor-tabs">
      {openedTabs.map((path, index) => {
        const dirty = isPathDirty(path)
        const external = hasExternalDiskDrift(path, externalDiskChangedPaths)
        const isActive = pathsEqual(activePath, path)
        const badges: string[] = []
        if (dirty) badges.push('dirty')
        if (external) badges.push('external')
        const badgeClass = badges.length > 0 ? ` editor-tab-row--${badges.join('-')}` : ''
        const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onActivate(path)
          }
        }
        return (
          <div
            key={path}
            className={`editor-tab-row${isActive ? ' active' : ''}${badgeClass}`}
          >
            <button
              type="button"
              role="tab"
              id={`editor-tab-${index}`}
              data-testid={`editor-tab:${path.replace(/\\/g, '/').split('/').pop() ?? path}`}
              aria-selected={isActive}
              className={`editor-tab${isActive ? ' active' : ''}`}
              onMouseDown={preventButtonSecondaryMouseDown}
              onContextMenu={(e) => onContextMenu(e, path, index)}
              onClick={() => onActivate(path)}
              onKeyDown={onTabKeyDown}
              title={external ? t('app.tabs.externalDiskHint') : path}
            >
              <span className="editor-tab-label">{tabLabel(path)}</span>
              {(dirty || external) && (
                <span className="editor-tab-badges" aria-hidden="true">
                  {dirty && <span className="editor-tab-badge editor-tab-badge--dirty" />}
                  {external && <span className="editor-tab-badge editor-tab-badge--external" />}
                </span>
              )}
            </button>
            <button
              type="button"
              className="editor-tab-close"
              aria-label={t('app.tabs.closeTab')}
              onMouseDown={preventButtonSecondaryMouseDown}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose(path)
              }}
            >
              <Icon name="close" size="xs" tone="muted" stroke="strong" />
            </button>
          </div>
        )
      })}
      </div>
    </div>
  )
}
