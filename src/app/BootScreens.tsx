import { getBootMessages } from '../i18n/bootStrings'

export function BootErrorScreen({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const boot = getBootMessages()
  return (
    <div
      role="alert"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        background: 'var(--surface-app, #0d1117)',
        color: 'var(--text-primary, #e6edf3)',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{boot.failedTitle}</h1>
      <p style={{ margin: 0, maxWidth: 480, textAlign: 'center', opacity: 0.85 }}>{boot.failedMessage}</p>
      <pre
        style={{
          margin: 0,
          maxWidth: 'min(640px, 92vw)',
          padding: 12,
          borderRadius: 8,
          fontSize: 12,
          overflow: 'auto',
          background: 'color-mix(in srgb, var(--text-primary, #fff) 6%, transparent)',
        }}
      >
        {error}
      </pre>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--text-primary, #fff) 20%, transparent)',
            background: 'var(--accent, #3b82f6)',
            color: 'var(--luna-on-accent, var(--surface-editor, #fff))',
            cursor: 'pointer',
          }}
        >
          {boot.retry}
        </button>
      ) : null}
    </div>
  )
}
