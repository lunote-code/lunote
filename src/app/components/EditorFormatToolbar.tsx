import { useCallback, useEffect, useState } from 'react'

import type { ToolbarItemDef } from '../../menu/menu.types'
import type { TranslateFn } from '../../i18n'
import { Icon } from '../../design-system/icons'
import { getAppSettingsSnapshot, subscribeAppSettings } from '../../settings/appSettingsStore'
import { resolveEditorFormatToolbarEnabled } from '../../settings-runtime/editorFormatToolbarEnabled'
import { EditorCalloutToolbarDropdown } from './EditorCalloutToolbarDropdown'
import { EditorTextColorToolbarControl } from './EditorTextColorToolbarControl'
import { resolveEditorFormatToolbarIcon } from './editorFormatToolbarIcons'

type Props = {
  t: TranslateFn
  commands: ToolbarItemDef[]
  onCommand: (commandId: string) => void
  hasTextSelection: boolean
  onTextColorPick: (color: string | null) => void
  isCommandActive?: (commandId: string) => boolean
  onMenuOpenChange?: (open: boolean) => void
}

function readFormatToolbarEnabled(): boolean {
  return resolveEditorFormatToolbarEnabled(getAppSettingsSnapshot().appearance?.editor)
}

export function EditorFormatToolbar({
  t,
  commands,
  onCommand,
  hasTextSelection,
  onTextColorPick,
  isCommandActive,
  onMenuOpenChange,
}: Props) {
  const [enabled, setEnabled] = useState(readFormatToolbarEnabled)
  const [openFormatMenus, setOpenFormatMenus] = useState(0)

  const handleFormatMenuOpenChange = useCallback((open: boolean) => {
    setOpenFormatMenus((count) => Math.max(0, count + (open ? 1 : -1)))
  }, [])

  useEffect(() => {
    onMenuOpenChange?.(openFormatMenus > 0)
  }, [onMenuOpenChange, openFormatMenus])

  useEffect(() => {
    return subscribeAppSettings(() => {
      setEnabled(readFormatToolbarEnabled())
    })
  }, [])

  if (commands.length === 0 || !enabled) return null

  return (
    <div
      className={`editor-format-toolbar-shell${openFormatMenus > 0 ? ' editor-format-toolbar-shell--menu-open' : ''}`}
    >
      <div
        className="editor-format-toolbar"
        role="toolbar"
        aria-label={t('editor.format.toolbarAria')}
      >
        {commands.map((item) => {
          if (item.kind === 'dropdown') {
            return (
              <EditorCalloutToolbarDropdown
                key={item.id}
                t={t}
                label={item.label}
                title={item.title}
                items={item.items}
                onCommand={onCommand}
                onOpenChange={handleFormatMenuOpenChange}
              />
            )
          }
          const iconName = resolveEditorFormatToolbarIcon(item.id)
          const pressed = isCommandActive?.(item.id) ?? false
          return (
            <button
              key={item.id}
              type="button"
              className={`editor-format-btn${pressed ? ' editor-format-btn--active' : ''}`}
              data-format-command={item.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onCommand(item.id)}
              title={item.shortcut ? `${item.title} (${item.shortcut})` : item.title}
              aria-label={item.title}
              aria-pressed={pressed}
            >
              {iconName ? (
                <Icon name={iconName} className="editor-format-btn-icon" size="sm" stroke="strong" />
              ) : (
                item.label
              )}
            </button>
          )
        })}
        <EditorTextColorToolbarControl
          t={t}
          disabled={!hasTextSelection}
          onColorPick={onTextColorPick}
          onOpenChange={handleFormatMenuOpenChange}
        />
      </div>
    </div>
  )
}
