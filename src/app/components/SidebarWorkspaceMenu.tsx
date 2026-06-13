import type { CSSProperties, Dispatch, RefObject, SetStateAction } from 'react'
import { isTauri } from '@tauri-apps/api/core'

import { Icon } from '../../design-system/icons'
import type { TranslateFn } from '../../i18n'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'
import { revealInExplorer } from '../../platform/tauri/platformShellService'
import type { FileSortMode } from '../workspace/types'
import { FileContextMenuItem } from './FileContextMenuItem'

export type SidebarWorkspaceMenuProps = {
  t: TranslateFn
  rootDir: string
  workspaceFolderName: string
  workspaceMenuRef: RefObject<HTMLDivElement | null>
  workspaceMenuPopRef: RefObject<HTMLDivElement | null>
  workspaceMenuOpen: boolean
  setWorkspaceMenuOpen: Dispatch<SetStateAction<boolean>>
  workspaceMenuPopStyle: CSSProperties | null
  fileSortMode: FileSortMode
  setFileSortMode: Dispatch<SetStateAction<FileSortMode>>
  createNewNote: () => void | Promise<void>
  createNewNoteFromTemplate: () => void | Promise<void>
  chooseFolder: () => void | Promise<void>
  refreshFileTree: () => void | Promise<void>
  setStatus: (msg: string) => void
}

export function SidebarWorkspaceMenu({
  t,
  rootDir,
  workspaceFolderName,
  workspaceMenuRef,
  workspaceMenuPopRef,
  workspaceMenuOpen,
  setWorkspaceMenuOpen,
  workspaceMenuPopStyle,
  fileSortMode,
  setFileSortMode,
  createNewNote,
  createNewNoteFromTemplate,
  chooseFolder,
  refreshFileTree,
  setStatus,
}: SidebarWorkspaceMenuProps) {
  const hasWorkspace = Boolean(rootDir.trim())
  const menuTitle = hasWorkspace ? workspaceFolderName : t('app.titleBar.noFolder')

  const closeMenu = () => setWorkspaceMenuOpen(false)

  return (
    <div className="sidebar-workspace-menu-anchor" ref={workspaceMenuRef}>
      <button
        type="button"
        className={`sidebar-chrome-btn sidebar-workspace-menu-trigger${workspaceMenuOpen ? ' sidebar-chrome-btn--active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setWorkspaceMenuOpen((open) => !open)
        }}
        title={menuTitle}
        aria-label={t('app.sidebar.workspaceMenuTrigger')}
        aria-haspopup="menu"
        aria-expanded={workspaceMenuOpen}
        data-testid="sidebar-workspace-menu-toggle"
      >
        <Icon name="chevron-down" size="sm" stroke="strong" />
      </button>
      {workspaceMenuOpen ? (
        <div
          ref={workspaceMenuPopRef}
          className="workspace-menu-pop"
          role="menu"
          aria-label={t('app.sidebar.workspaceMenu')}
          style={
            workspaceMenuPopStyle ?? {
              position: 'fixed',
              visibility: 'hidden',
              left: 0,
              top: 0,
              pointerEvents: 'none',
            }
          }
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="workspace-menu-pop-header">
            <p className="workspace-menu-pop-title">{menuTitle}</p>
            {hasWorkspace ? (
              <p className="workspace-menu-pop-path" title={rootDir}>
                {rootDir}
              </p>
            ) : null}
          </div>
          {hasWorkspace ? (
            <>
              <FileContextMenuItem
                icon="note-new"
                label={t('app.sidebar.workspaceMenu.newFile')}
                onClick={() => {
                  closeMenu()
                  void createNewNote()
                }}
              />
              <FileContextMenuItem
                icon="template"
                label={t('app.sidebar.workspaceMenu.newFromTemplate')}
                onClick={() => {
                  closeMenu()
                  void createNewNoteFromTemplate()
                }}
              />
              <FileContextMenuItem
                icon="reveal"
                label={t('app.sidebar.revealInFolder')}
                onClick={() => {
                  closeMenu()
                  if (!isTauri()) {
                    setStatus(t('app.status.revealFolderDesktopOnly'))
                    return
                  }
                  void revealInExplorer(rootDir, rootDir)
                }}
              />
              <FileContextMenuItem
                icon="workspace-open"
                label={t('app.sidebar.openFolderBtn')}
                onClick={() => {
                  closeMenu()
                  void chooseFolder()
                }}
              />
              <FileContextMenuItem
                icon="refresh"
                label={t('app.sidebar.refreshBtn')}
                onClick={() => {
                  closeMenu()
                  void (async () => {
                    await refreshFileTree()
                    await refreshWorkspaceIndex(rootDir)
                    setStatus(t('app.status.refreshed'))
                  })()
                }}
              />
              <div className="file-ctx-sep" role="separator" />
              <div className="workspace-sort-row" aria-label={t('app.sidebar.sortRow')}>
                <button
                  type="button"
                  className={`workspace-sort-btn${fileSortMode === 'group' ? ' active' : ''}`}
                  title={t('app.sort.groupByFolder')}
                  aria-label={t('app.sort.groupByFolder')}
                  onClick={() => setFileSortMode('group')}
                >
                  <Icon name="workspace-tree" size="md" />
                  <span className="workspace-sort-btn-label">{t('app.sort.groupShort')}</span>
                </button>
                <button
                  type="button"
                  className={`workspace-sort-btn${fileSortMode === 'naturalAsc' ? ' active' : ''}`}
                  title={t('app.sort.naturalAsc')}
                  aria-label={t('app.sort.naturalAsc')}
                  onClick={() => setFileSortMode('naturalAsc')}
                >
                  <Icon name="sort-az" size="md" />
                  <span className="workspace-sort-btn-label">{t('app.sort.naturalAscShort')}</span>
                </button>
                <button
                  type="button"
                  className={`workspace-sort-btn${fileSortMode === 'nameAsc' ? ' active' : ''}`}
                  title={t('app.sort.nameAsc')}
                  aria-label={t('app.sort.nameAsc')}
                  onClick={() => setFileSortMode('nameAsc')}
                >
                  <Icon name="sort-za" size="md" />
                  <span className="workspace-sort-btn-label">{t('app.sort.nameAscShort')}</span>
                </button>
                <button
                  type="button"
                  className={`workspace-sort-btn${fileSortMode === 'modifiedAsc' ? ' active' : ''}`}
                  title={t('app.sort.modifiedAsc')}
                  aria-label={t('app.sort.modifiedAsc')}
                  onClick={() => setFileSortMode('modifiedAsc')}
                >
                  <Icon name="sort-time" size="md" />
                  <span className="workspace-sort-btn-label">{t('app.sort.modifiedAscShort')}</span>
                </button>
                <button
                  type="button"
                  className={`workspace-sort-btn${fileSortMode === 'createdAsc' ? ' active' : ''}`}
                  title={t('app.sort.createdAsc')}
                  aria-label={t('app.sort.createdAsc')}
                  onClick={() => setFileSortMode('createdAsc')}
                >
                  <Icon name="sort-created" size="md" />
                  <span className="workspace-sort-btn-label">{t('app.sort.createdAscShort')}</span>
                </button>
              </div>
            </>
          ) : (
            <FileContextMenuItem
              icon="workspace-open"
              label={t('app.sidebar.openFolderBtn')}
              onClick={() => {
                closeMenu()
                void chooseFolder()
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
