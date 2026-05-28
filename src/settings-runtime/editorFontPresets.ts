export type EditorFontKind = 'sans' | 'mono'

export type EditorFontPreset = {
  value: string
  label: string
  groupKey: string
  kind: EditorFontKind
}

export const EDITOR_FONT_GROUP_KEYS = {
  general: 'settings.editor.fontFamily.group.general',
  ide: 'settings.editor.fontFamily.group.ide',
  github: 'settings.editor.fontFamily.group.github',
  mono: 'settings.editor.fontFamily.group.mono',
} as const

/** Preference "Document Font" default (value is persisted to settings; label is the font display name)*/
export const EDITOR_FONT_PRESETS: readonly EditorFontPreset[] = [
  { value: 'Inter', label: 'Inter', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },
  { value: 'SF Pro Text', label: 'SF Pro Text', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },
  { value: 'Segoe UI', label: 'Segoe UI', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },
  { value: 'PingFang SC', label: 'PingFang SC', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },
  { value: 'Microsoft YaHei', label: 'Microsoft YaHei', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },
  { value: 'Noto Sans SC', label: 'Noto Sans SC', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },
  { value: 'Source Han Sans SC', label: 'Source Han Sans SC', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },
  { value: 'Helvetica Neue', label: 'Helvetica Neue', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },
  { value: 'Arial', label: 'Arial', groupKey: EDITOR_FONT_GROUP_KEYS.general, kind: 'sans' },

  { value: 'JetBrains Sans', label: 'JetBrains Sans', groupKey: EDITOR_FONT_GROUP_KEYS.ide, kind: 'sans' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', groupKey: EDITOR_FONT_GROUP_KEYS.ide, kind: 'mono' },

  { value: 'Mona Sans', label: 'Mona Sans', groupKey: EDITOR_FONT_GROUP_KEYS.github, kind: 'sans' },
  { value: 'Mona Mono', label: 'Mona Mono', groupKey: EDITOR_FONT_GROUP_KEYS.github, kind: 'mono' },

  { value: 'Fira Code', label: 'Fira Code', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Cascadia Code', label: 'Cascadia Code', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Cascadia Mono', label: 'Cascadia Mono', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Consolas', label: 'Consolas', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Menlo', label: 'Menlo', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'SF Mono', label: 'SF Mono', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Source Code Pro', label: 'Source Code Pro', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Roboto Mono', label: 'Roboto Mono', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Ubuntu Mono', label: 'Ubuntu Mono', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Hack', label: 'Hack', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Iosevka', label: 'Iosevka', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Victor Mono', label: 'Victor Mono', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Monaco', label: 'Monaco', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
  { value: 'Lucida Console', label: 'Lucida Console', groupKey: EDITOR_FONT_GROUP_KEYS.mono, kind: 'mono' },
]

export function findEditorFontPreset(value: string): EditorFontPreset | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return EDITOR_FONT_PRESETS.find((preset) => preset.value === trimmed)
}

/** Generate CSS values written to `--editor-content-font-family` (including quotes and back stack)*/
export function buildEditorFontFamilyCss(storedValue: string): string | undefined {
  const trimmed = storedValue.trim()
  if (!trimmed) return undefined
  const quoted = `"${trimmed.replace(/"/g, '')}"`
  const preset = findEditorFontPreset(trimmed)
  if (preset?.kind === 'mono') {
    return `${quoted}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  }
  return `${quoted}, var(--font-content)`
}

export function isEditorMonoFont(storedValue: string): boolean {
  return findEditorFontPreset(storedValue)?.kind === 'mono'
}
