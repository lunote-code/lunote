type BootScreenProps = {
  title: string
  message?: string
  detail?: string
  onRetry?: () => void
}

function BootFrame({ title, message, detail, onRetry }: BootScreenProps) {
  return (
    <div
      className="boot-screen"
      role="status"
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
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
      {message ? <p style={{ margin: 0, maxWidth: 480, textAlign: 'center', opacity: 0.85 }}>{message}</p> : null}
      {detail ? (
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
          {detail}
        </pre>
      ) : null}
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
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function BootLoadingScreen() {
  return <BootFrame title="Luna Note" message="Starting..." />
}

export function BootErrorScreen({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <BootFrame
      title="Startup failed"
      message="The app failed to complete initialization, but you can try again. If it continues to fail, please check the error message below."
      detail={error}
      onRetry={onRetry}
    />
  )
}
