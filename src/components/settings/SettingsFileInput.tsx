import type { ReactNode, DragEvent } from 'react'
import { useRef } from 'react'
import { SettingsButton } from './SettingsButton'

type SettingsFileInputProps = {
  value?: string
  accept?: string
  buttonLabel: string
  emptyLabel: string
  dropHint: string
  onFile: (file: File) => void
  actions?: ReactNode
}

export function SettingsFileInput({
  value,
  accept,
  buttonLabel,
  emptyLabel,
  dropHint,
  onFile,
  actions,
}: SettingsFileInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const readDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files.item(0)
    if (file) onFile(file)
  }

  return (
    <div
      className="settings-file-dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={readDrop}
    >
      <input
        ref={inputRef}
        className="settings-file-native"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.item(0)
          if (file) onFile(file)
          event.currentTarget.value = ''
        }}
      />
      <div className="settings-file-copy">
        <strong>{value || emptyLabel}</strong>
        <span>{dropHint}</span>
      </div>
      <div className="settings-file-actions">
        {actions}
        <SettingsButton type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          {buttonLabel}
        </SettingsButton>
      </div>
    </div>
  )
}
