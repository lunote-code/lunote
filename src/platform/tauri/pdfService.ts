import { invoke } from '@tauri-apps/api/core'

export async function renderHtmlToPdfBase64(html: string): Promise<string> {
  return invoke<string>('render_html_to_pdf_base64', { payload: { html } })
}

export async function renderHtmlToPdfPath(
  html: string,
  path: string,
  workspaceRoot: string,
): Promise<void> {
  await invoke('render_html_to_pdf_to_path', {
    payload: { html, path, workspaceRoot },
  })
}
