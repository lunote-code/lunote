import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TranslateFn } from '../i18n'
import { SettingsSelect, type SettingsSelectOption } from '../components/settings'
import { listWorkspaceTemplates, type WorkspaceTemplateEntry } from './templateCatalog'

export function normalizeTemplatePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
}

export function buildTemplateSelectOptions(
  templates: readonly WorkspaceTemplateEntry[],
  currentPath: string,
): SettingsSelectOption<string>[] {
  const options: SettingsSelectOption<string>[] = templates.map((entry) => ({
    value: entry.relativePath,
    label: entry.displayName,
    description: entry.relativePath,
  }))
  const normalized = normalizeTemplatePath(currentPath)
  if (normalized && !options.some((option) => option.value === normalized)) {
    options.unshift({
      value: normalized,
      label: normalized.split('/').pop() ?? normalized,
      description: normalized,
    })
  }
  return options
}

type WorkspaceTemplateSelectProps = {
  rootDir: string
  value: string
  disabled?: boolean
  ariaLabel: string
  onValueChange: (path: string) => void
  t: TranslateFn
  className?: string
}

export function WorkspaceTemplateSelect({
  rootDir,
  value,
  disabled = false,
  ariaLabel,
  onValueChange,
  t,
  className,
}: WorkspaceTemplateSelectProps) {
  const [templates, setTemplates] = useState<WorkspaceTemplateEntry[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!rootDir.trim()) {
      setTemplates([])
      return
    }
    setLoading(true)
    try {
      const entries = await listWorkspaceTemplates(rootDir)
      setTemplates(entries)
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [rootDir])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const options = useMemo(() => buildTemplateSelectOptions(templates, value), [templates, value])

  const emptyLabel = loading
    ? t('settings.workspaceNotes.templatesLoading')
    : t('settings.workspaceNotes.templatesEmpty')

  const rootClass = ['workspace-template-select', className, disabled ? 'is-disabled' : '']
    .filter(Boolean)
    .join(' ')

  if (loading || options.length === 0) {
    return <p className="workspace-template-select-status rename-modal-template-status">{emptyLabel}</p>
  }

  return (
    <div className={rootClass}>
      <SettingsSelect
        value={value}
        options={options}
        ariaLabel={ariaLabel}
        onValueChange={disabled ? () => {} : onValueChange}
      />
    </div>
  )
}
