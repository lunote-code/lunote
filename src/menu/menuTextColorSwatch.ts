import { LUNA_TEXT_COLOR_PRESETS } from '../editor/lunaTextColor'

const SWATCH_BY_COMMAND: Record<string, string> = Object.fromEntries(
  LUNA_TEXT_COLOR_PRESETS.map((preset) => [`fmt-text-color-${preset.id}`, preset.value]),
)

export type MenuTextColorSwatch = string | 'default'

export function resolveMenuTextColorSwatch(commandId: string): MenuTextColorSwatch | undefined {
  if (commandId === 'fmt-text-color-default') return 'default'
  return SWATCH_BY_COMMAND[commandId]
}
