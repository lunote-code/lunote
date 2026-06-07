import { EmptyState } from '../../design-system/EmptyState'
import type { TranslateFn } from '../../i18n'

type Props = {
  t: TranslateFn
  onOpenFolder: () => void | Promise<void>
  onScratchNote: () => void | Promise<void>
}

export function SidebarWorkspaceEmpty({ t, onOpenFolder, onScratchNote }: Props) {
  return (
    <EmptyState
      variant="sidebar"
      icon="workspace-open"
      title={t('app.sidebar.empty.title')}
      actions={
        <>
          <button type="button" className="focus-exit-btn" onClick={() => void onOpenFolder()}>
            {t('app.sidebar.empty.openFolderCta')}
          </button>
          <button type="button" className="luna-empty-state-btn-secondary" onClick={() => void onScratchNote()}>
            {t('app.sidebar.empty.scratchCta')}
          </button>
        </>
      }
    />
  )
}
