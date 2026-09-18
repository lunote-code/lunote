import { useEffect, useMemo, useState } from 'react'

import { SettingsSelect, type SettingsSelectOption } from '../../../components/settings'
import {
  resolveAiModel,
  resolveAiModelPresetOptions,
  resolveAiProvider,
  type AiProviderId,
} from '../../../settings-runtime/aiSettings'
import { getAppSettingsSnapshot } from '../../../settings/appSettingsStore'
import {
  getAiSessionModelOverride,
  setAiSessionModelOverride,
  subscribeAiSessionModelStore,
} from '../hooks/aiSessionModelStore'

type Props = {
  ariaLabel: string
  defaultLabel: string
  providerLabel?: string
  inline?: boolean
  meta?: boolean
}

function buildModelOptions(provider: AiProviderId, settingsModel: string): SettingsSelectOption<string>[] {
  const presets = [...resolveAiModelPresetOptions(provider)]
  const models: string[] = []
  const seen = new Set<string>()

  const push = (model: string) => {
    const trimmed = model.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    models.push(trimmed)
  }

  const override = getAiSessionModelOverride()
  if (override) push(override)
  if (settingsModel) push(settingsModel)
  for (const preset of presets) push(preset)

  return models.map((model) => ({ value: model, label: model }))
}

export function AiModelSelector({
  ariaLabel,
  defaultLabel,
  providerLabel,
  inline = false,
  meta = false,
}: Props) {
  const [, bump] = useState(0)
  useEffect(() => subscribeAiSessionModelStore(() => bump((value) => value + 1)), [])

  const snapshot = getAppSettingsSnapshot()
  const provider = resolveAiProvider(snapshot)
  const settingsModel = resolveAiModel(snapshot)
  const override = getAiSessionModelOverride()
  const options = useMemo(() => {
    const built = buildModelOptions(provider, settingsModel)
    if (!settingsModel) {
      return [{ value: '', label: defaultLabel }, ...built]
    }
    return built
  }, [provider, settingsModel, defaultLabel])
  const value = override ?? settingsModel ?? ''

  const wrapperClassName = meta
    ? 'ai-rail-model-select ai-rail-model-select--meta'
    : inline
      ? 'ai-rail-model-select ai-rail-model-select--inline'
      : 'ai-rail-model-select'

  const selector = (
    <SettingsSelect
      value={value}
      options={options}
      ariaLabel={ariaLabel}
      onValueChange={(next) => {
        const trimmed = next.trim()
        if (!trimmed || trimmed === settingsModel) {
          setAiSessionModelOverride(null)
          return
        }
        setAiSessionModelOverride(trimmed)
      }}
    />
  )

  if (meta || inline) {
    return (
      <div className={wrapperClassName} data-testid="ai-rail-model-select">
        {selector}
      </div>
    )
  }

  return (
    <label className={wrapperClassName} data-testid="ai-rail-model-select">
      {providerLabel ? <span className="ai-rail-model-select-label">{providerLabel}</span> : null}
      {selector}
    </label>
  )
}
