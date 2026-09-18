import { getBootMessages } from '../../i18n/bootStrings'

/** Static layout skeleton shown before bootstrap completes; mirrors default app chrome. */
export function BootShell() {
  const boot = getBootMessages()
  return (
    <div className="boot-shell" aria-busy="true">
      <div className="boot-shell-layout with-sidebar" aria-hidden="true">
        <aside className="boot-shell-sidebar" />
        <div className="boot-shell-splitter" />
        <main className="boot-shell-main">
          <div className="boot-shell-toolbar" />
          <div className="boot-shell-tabs" />
          <div className="boot-shell-editor" />
        </main>
      </div>
      <p className="boot-shell-status" data-testid="boot-shell-status" role="status" aria-live="polite">
        {boot.starting}
      </p>
    </div>
  )
}
