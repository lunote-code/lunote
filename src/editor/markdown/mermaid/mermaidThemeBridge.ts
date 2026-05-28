import { subscribeTheme } from '../../../theme-runtime/themeRuntime'
import {
  MERMAID_ACCENT_THEME_TOKEN_MAP,
  MERMAID_THEME_TOKEN_MAP,
  mermaidColorsFromThemeVariables,
  type MermaidResolvedColors,
  type MermaidThemeVariables,
} from './mermaidThemeTokens'

type MermaidThemeSubscriber = () => void

let mermaidThemeRevision = 0
let themeRuntimeSubscription: (() => void) | null = null
const subscribers = new Set<MermaidThemeSubscriber>()

function readSemanticToken(token: string | readonly string[]): string {
  const tokens = Array.isArray(token) ? token : [token]
  if (typeof window === 'undefined') return `var(${tokens[0]})`
  const root = document.documentElement
  const style = window.getComputedStyle(root)
  for (const candidate of tokens) {
    const value = style.getPropertyValue(candidate).trim()
    if (value) return value
  }
  return `var(${tokens[0]})`
}

/** Mermaid off-screen render cannot parse var() and must use the calculated font family*/
function readEditorFontFamily(): string {
  if (typeof window === 'undefined') return 'system-ui, -apple-system, sans-serif'
  const bodyFont = window.getComputedStyle(document.body).fontFamily?.trim()
  if (bodyFont) return bodyFont
  const rootStyle = window.getComputedStyle(document.documentElement)
  const fromToken = rootStyle.getPropertyValue('--font-ui').trim()
  if (fromToken && !fromToken.startsWith('var(')) return fromToken
  return 'system-ui, -apple-system, sans-serif'
}

function applyResolvedColorsToThemeVariables(
  variables: MermaidThemeVariables,
): MermaidThemeVariables {
  const colors = mermaidColorsFromThemeVariables(variables)
  return {
    ...variables,
    background: colors.background,
    mainBkg: colors.panel,
    primaryColor: colors.panel,
    secondBkg: colors.elevated,
    tertiaryColor: colors.elevated,
    primaryTextColor: colors.text,
    tertiaryTextColor: colors.text,
    textColor: colors.text,
    nodeTextColor: colors.text,
    primaryBorderColor: colors.border,
    lineColor: colors.border,
    nodeBorder: colors.border,
    clusterBkg: colors.elevated,
    clusterBorder: colors.border,
    edgeLabelBackground: colors.background,
    actorBkg: colors.panel,
    actorBorder: colors.border,
    actorTextColor: colors.text,
    signalColor: colors.border,
    labelBoxBkgColor: colors.background,
    labelBoxBorderColor: colors.border,
    labelTextColor: colors.text,
    loopTextColor: colors.text,
    noteBkgColor: colors.elevated,
    noteTextColor: colors.text,
    noteBorderColor: colors.border,
    mindmapBranchColor: colors.accent,
    mindmapNodeBkg: colors.elevated,
    mindmapNodeBorderColor: colors.border,
    mindmapTextColor: colors.text,
    secondaryColor: colors.accent,
  }
}

export function invalidateMermaidRenderedGraphCache(): void {
  mermaidThemeRevision += 1
  for (const subscriber of subscribers) subscriber()
}

function ensureThemeRuntimeSubscription(): void {
  if (themeRuntimeSubscription) return
  themeRuntimeSubscription = subscribeTheme(() => {
    invalidateMermaidRenderedGraphCache()
  })
}

export function getMermaidThemeVariables(): MermaidThemeVariables {
  const variables: MermaidThemeVariables = {
    fontFamily: readEditorFontFamily(),
    fontSize: '13px',
  }

  for (const [mermaidKey, semanticToken] of Object.entries(MERMAID_THEME_TOKEN_MAP)) {
    variables[mermaidKey] = readSemanticToken(semanticToken)
  }

  for (const [mermaidKey, semanticToken] of Object.entries(MERMAID_ACCENT_THEME_TOKEN_MAP)) {
    variables[mermaidKey] = readSemanticToken(semanticToken)
  }

  return variables
}

/** For mermaid.render: use hex + real font in the layout stage to avoid too narrow nodes and vertical text*/
export function buildMermaidThemeVariables(): MermaidThemeVariables {
  if (typeof window === 'undefined') return getMermaidThemeVariables()
  return applyResolvedColorsToThemeVariables(getMermaidThemeVariables())
}

/** Mermaid rendering/postProcess in the editor uses solid color hex (off-screen SVG cannot parse var())*/
export function resolveMermaidEditorColors(): MermaidResolvedColors {
  return mermaidColorsFromThemeVariables(buildMermaidThemeVariables())
}

export function getMermaidThemeRevision(): number {
  return mermaidThemeRevision
}

export function subscribeMermaidTheme(callback: MermaidThemeSubscriber): () => void {
  ensureThemeRuntimeSubscription()
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
    if (subscribers.size === 0) {
      themeRuntimeSubscription?.()
      themeRuntimeSubscription = null
    }
  }
}
