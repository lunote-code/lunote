import type { TranslateFn } from '../../i18n'
import { Icon } from '../../design-system/icons/Icon'

type ListModeSegmentedProps = {
  t: TranslateFn
  mode: 'files' | 'outline'
  onSelectFiles: () => void
  onSelectOutline: () => void
}

type FileViewToggleProps = {
  t: TranslateFn
  sidebarFileView: 'tree' | 'list'
  disabled: boolean
  onToggle: () => void
}

export function SidebarListModeSegmented({
  t,
  mode,
  onSelectFiles,
  onSelectOutline,
}: ListModeSegmentedProps) {
  return (
    <div
      className="sidebar-list-mode-row"
      role="group"
      aria-label={t('app.sidebar.listModeGroupAria')}
      data-testid="sidebar-list-mode-segmented"
    >
      <button
        type="button"
        className={`sidebar-chrome-btn${mode === 'files' ? ' sidebar-chrome-btn--active' : ''}`}
        onClick={onSelectFiles}
        aria-pressed={mode === 'files'}
        aria-label={t('app.sidebar.filesToggleAria')}
        title={t('app.sidebar.filesToggle')}
        data-testid="sidebar-files-toggle"
      >
        <Icon name="files" size="sm" stroke="strong" />
      </button>
      <button
        type="button"
        className={`sidebar-chrome-btn${mode === 'outline' ? ' sidebar-chrome-btn--active' : ''}`}
        onClick={onSelectOutline}
        aria-pressed={mode === 'outline'}
        aria-label={t('app.sidebar.toggleOutlineAria')}
        title={t('app.sidebar.toggleOutlineOnly')}
        data-testid="sidebar-outline-toggle"
      >
        <Icon name="outline" size="sm" stroke="strong" />
      </button>
    </div>
  )
}

export function SidebarFileViewToggleButton({
  t,
  sidebarFileView,
  disabled,
  onToggle,
}: FileViewToggleProps) {
  const title =
    sidebarFileView === 'tree' ? t('app.sidebar.viewList') : t('app.sidebar.viewTree')

  return (
    <button
      type="button"
      className={`sidebar-chrome-btn sidebar-file-view-toggle${sidebarFileView === 'list' ? ' sidebar-chrome-btn--active' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={sidebarFileView === 'list'}
      data-testid="sidebar-file-view-toggle"
    >
      {sidebarFileView === 'tree' ? (
        <Icon name="workspace-tree" size="sm" stroke="strong" />
      ) : (
        <Icon name="list" size="sm" stroke="strong" />
      )}
    </button>
  )
}
