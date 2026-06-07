/** Static layout skeleton shown before bootstrap completes; mirrors default app chrome. */
export function BootShell() {
  return (
    <div className="boot-shell" aria-hidden="true">
      <div className="boot-shell-layout with-sidebar">
        <aside className="boot-shell-sidebar" />
        <div className="boot-shell-splitter" />
        <main className="boot-shell-main">
          <div className="boot-shell-toolbar" />
          <div className="boot-shell-tabs" />
          <div className="boot-shell-editor" />
        </main>
      </div>
    </div>
  )
}
