import { sanitizeMermaidSvgHtml } from '../editor/mermaid/mermaidSvgSanitize'
import {
  getMermaidThemeRevision,
  resolveMermaidEditorColors,
} from '../editor/markdown/mermaid/mermaidThemeBridge'
import { postProcessMermaidSvg } from '../theme/postProcessMermaidSvg'
import { buildMermaidInitializeOptions } from '../theme/buildMermaidInitializeOptions'
import {
  buildMermaidExportInitializeOptions,
  resolveMermaidExportColors,
} from './mermaidExportColors'

let mermaidInit = false
let mermaidConfigRev: number | null = null
const MERMAID_CONFIG_REV = 8

export type MermaidExportInjectOptions = {
  dark?: boolean
  /** In-app preview (e.g. document history): follow Theme Runtime tokens instead of export fallbacks. */
  useAppTheme?: boolean
}

/**
 * Replaced `language-mermaid` code blocks in exported HTML with Mermaid rendering SVG.
 * The source code is extracted from the original Markdown (to avoid rehype-highlight contaminating the code content).
 */
export async function injectMermaidExportDiagrams(
  html: string,
  sourceMarkdown = '',
  opts?: MermaidExportInjectOptions,
): Promise<string> {
  const template = document.createElement('template')
  template.innerHTML = html
  const pres = Array.from(template.content.querySelectorAll('pre')).filter((pre) =>
    pre.querySelector('code.language-mermaid'),
  )
  if (pres.length === 0) return html

  const dark = opts?.dark ?? false
  const useAppTheme = opts?.useAppTheme === true && typeof window !== 'undefined'
  const colors = useAppTheme ? resolveMermaidEditorColors() : resolveMermaidExportColors(dark)
  const fenceRe = /```mermaid[ \t]*\r?\n([\s\S]*?)```/gu
  const sources = [...sourceMarkdown.matchAll(fenceRe)].map((m) => m[1]?.trim() ?? '').filter(Boolean)

  const mermaid = (await import('mermaid')).default
  const configRev =
    MERMAID_CONFIG_REV + getMermaidThemeRevision() + (useAppTheme ? 100 : 0) + (dark ? 1 : 0)
  if (!mermaidInit || mermaidConfigRev !== configRev) {
    mermaid.initialize(
      useAppTheme ? buildMermaidInitializeOptions(dark) : buildMermaidExportInitializeOptions(dark),
    )
    mermaidInit = true
    mermaidConfigRev = configRev
  }

  let seq = 0
  for (let i = 0; i < pres.length; i += 1) {
    const pre = pres[i]!
    const source = sources[i] ?? pre.querySelector('code')?.textContent?.trim() ?? ''
    if (!source) continue
    try {
      const id = `luna-export-mmd-${seq}-${Date.now()}`
      seq += 1
      const { svg } = await mermaid.render(id, source)
      const host = document.createElement('div')
      host.className = 'mermaid-export-diagram pm-mermaid-block mermaid'
      host.setAttribute('data-luna-mermaid-export', '1')
      host.innerHTML = sanitizeMermaidSvgHtml(svg)
      postProcessMermaidSvg(host, colors)
      pre.replaceWith(host)
    } catch {
      /*Keep original code block in case of syntax error*/
    }
  }
  return template.innerHTML
}
