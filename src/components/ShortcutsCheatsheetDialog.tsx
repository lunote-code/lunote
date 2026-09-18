import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { SettingsButton } from './settings'
import { resolveOverlayPortalRoot } from '../lib/overlayPortalRoot'
import type { TranslateFn } from '../i18n'
import { buildShortcutCheatsheetSections } from '../menu/shortcutCheatsheetSections'
import { openPreferencesDialog } from '../preferences/preferencesDialogStore'
import { getAppSettingsSnapshot, subscribeAppSettings } from '../settings/appSettingsStore'
import { useFocusTrap } from '../lib/useFocusTrap'
import {
  closeShortcutsCheatsheetDialog,
  isShortcutsCheatsheetDialogOpen,
  subscribeShortcutsCheatsheetDialog,
} from './shortcutsCheatsheetStore'

type Props = {
  t: TranslateFn
}

export function ShortcutsCheatsheetDialogHost({ t }: Props) {
  const open = useSyncExternalStore(
    subscribeShortcutsCheatsheetDialog,
    isShortcutsCheatsheetDialogOpen,
    () => false,
  )

  const settingsRevision = useSyncExternalStore(
    subscribeAppSettings,
    () => JSON.stringify(getAppSettingsSnapshot().shortcutOverrides ?? {}),
    () => '{}',
  )

  const sections = useMemo(
    () => {
      void settingsRevision
      return buildShortcutCheatsheetSections(t, getAppSettingsSnapshot())
    },
    [t, settingsRevision],
  )

  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useFocusTrap(open, dialogRef.current, {
    initialFocus: closeButtonRef.current,
    onEscape: closeShortcutsCheatsheetDialog,
  })

  const onPrint = useCallback(() => {
    window.print()
  }, [])

  if (!open) return null

  const shell = (
    <div className="shortcuts-cheatsheet-backdrop" onMouseDown={closeShortcutsCheatsheetDialog}>
      <div
        ref={dialogRef}
        className="shortcuts-cheatsheet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-cheatsheet-title"
        data-testid="shortcuts-cheatsheet-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="shortcuts-cheatsheet-header">
          <div>
            <h2 id="shortcuts-cheatsheet-title" className="shortcuts-cheatsheet-title">
              {t('app.shortcutsCheatsheet.title')}
            </h2>
            <p className="shortcuts-cheatsheet-lead">{t('app.shortcutsCheatsheet.lead')}</p>
          </div>
          <div className="shortcuts-cheatsheet-header-actions">
            <SettingsButton
              type="button"
              variant="secondary"
              className="shortcuts-cheatsheet-print"
              onClick={onPrint}
            >
              {t('app.shortcutsCheatsheet.print')}
            </SettingsButton>
            <button
              ref={closeButtonRef}
              type="button"
              className="shortcuts-cheatsheet-close"
              onClick={closeShortcutsCheatsheetDialog}
            >
              {t('app.shortcutsCheatsheet.close')}
            </button>
          </div>
        </header>
        <div className="shortcuts-cheatsheet-body">
          {sections.map((section) => (
            <section key={section.id} className="shortcuts-cheatsheet-section">
              <h3 className="shortcuts-cheatsheet-section-title">{section.title}</h3>
              <table className="shortcuts-cheatsheet-table">
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.commandId}>
                      <th scope="row" className="shortcuts-cheatsheet-command">
                        {row.label}
                      </th>
                      <td className="shortcuts-cheatsheet-key">
                        <kbd>{row.shortcut}</kbd>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
        <footer className="shortcuts-cheatsheet-footer">
          <button
            type="button"
            className="shortcuts-cheatsheet-customize-link"
            onClick={() => {
              closeShortcutsCheatsheetDialog()
              openPreferencesDialog('shortcuts')
            }}
          >
            {t('app.shortcutsCheatsheet.customize')}
          </button>
        </footer>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(shell, resolveOverlayPortalRoot()) : shell
}
