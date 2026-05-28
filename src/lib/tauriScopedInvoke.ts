/** Aligned with Rust ScopedPathPayload / PathExistsPayload*/
export type ScopedPathPayload = {
  path: string
  workspaceRoot: string
}

export function scopedPathPayload(path: string, workspaceRoot: string): { payload: ScopedPathPayload } {
  return { payload: { path, workspaceRoot } }
}

export function exportNotePayload(path: string, content: string, workspaceRoot: string) {
  return { payload: { path, content, workspaceRoot } }
}

export function exportBinaryPayload(path: string, dataBase64: string, workspaceRoot: string) {
  return { payload: { path, dataBase64, workspaceRoot } }
}
