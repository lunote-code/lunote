import { sanitizeMermaidSvgHtml } from '../mermaid/mermaidSvgSanitize'
import { resolveMermaidEditorColors } from '../markdown/mermaid/mermaidThemeBridge'
import { buildMermaidInitializeOptions } from '../../theme/buildMermaidInitializeOptions'
import { postProcessMermaidSvg } from '../../theme/postProcessMermaidSvg'
import { getMermaidThemeRevision } from '../markdown/mermaid/mermaidThemeBridge'
import type { RenderPriority } from './renderPriority'
import { recordAsyncLatency } from './runtimeMetrics'

export { sanitizeMermaidSvgHtml } from '../mermaid/mermaidSvgSanitize'

const abortByBlock = new Map<string, AbortController>()

function blockAbortSignal(blockId: string, signal?: AbortSignal): AbortSignal {
  abortByBlock.get(blockId)?.abort()
  const ac = new AbortController()
  abortByBlock.set(blockId, ac)
  if (signal) {
    signal.addEventListener('abort', () => ac.abort(), { once: true })
  }
  return ac.signal
}

export type AsyncRenderKind = 'mermaid-svg' | 'mindmap-layout'

export type AsyncRenderPayload = {
  blockId: string
  kind: AsyncRenderKind
  source: string
  generation: number
  priority: RenderPriority
}

export type MermaidSvgRenderResult = {
  kind: 'mermaid-svg'
  svg: string
  bindKey?: string
  bindFunctions?: (element: Element) => void
}

export type AsyncRenderResult = MermaidSvgRenderResult | { kind: 'cancelled' }

let mermaidInit = false
const MERMAID_CONFIG_REV = 7
let mermaidConfigRev: number | null = null

function scheduleOnPriority<T>(
  priority: RenderPriority,
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      resolve(null)
      return
    }

    let idleId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (idleId != null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId)
      }
      if (timeoutId != null) clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      resolve(null)
    }

    const run = () => {
      cleanup()
      if (signal?.aborted) {
        resolve(null)
        return
      }
      void fn().then(resolve, reject)
    }

    signal?.addEventListener('abort', onAbort, { once: true })

    if (priority === 'interaction' || priority === 'visible') {
      queueMicrotask(run)
      return
    }

    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(
        () => {
          run()
        },
        { timeout: priority === 'idle' ? 3000 : 1200 },
      )
      return
    }

    timeoutId = setTimeout(run, priority === 'idle' ? 32 : 8)
  })
}

/**
 * Worker-ready: Returns structured results and swaps the DOM by the caller (without blocking the input main path).
 * Currently executed in the idle slot; it can be replaced by Worker postMessage with the same shape in the future.
 */
export async function renderMermaidSvg(
  blockId: string,
  source: string,
  priority: RenderPriority,
  signal?: AbortSignal,
): Promise<MermaidSvgRenderResult | null> {
  if (signal?.aborted) return null

  const t0 = performance.now()
  const result = await scheduleOnPriority(priority, async () => {
    if (signal?.aborted) return null

    const mermaid = (await import('mermaid')).default
    const configRev = MERMAID_CONFIG_REV + getMermaidThemeRevision()
    if (!mermaidInit || mermaidConfigRev !== configRev) {
      mermaid.initialize(buildMermaidInitializeOptions())
      mermaidInit = true
      mermaidConfigRev = configRev
    }

    if (signal?.aborted) return null

    const id = `luna-mmd-${blockId}-${Date.now()}`
    const { svg, bindFunctions } = await mermaid.render(id, source)
    return { kind: 'mermaid-svg' as const, svg, bindKey: id, bindFunctions }
  }, signal)

  recordAsyncLatency(performance.now() - t0)
  return result
}

export function applyMermaidSvgToHost(host: HTMLElement | null, result: MermaidSvgRenderResult): void {
  if (!host) return
  host.innerHTML = sanitizeMermaidSvgHtml(result.svg)
  postProcessMermaidSvg(host, resolveMermaidEditorColors())
  result.bindFunctions?.(host)
}

const pendingByBlock = new Map<string, Promise<AsyncRenderResult | null>>()

export function enqueueAsyncRender(
  payload: AsyncRenderPayload,
  signal?: AbortSignal,
): Promise<AsyncRenderResult | null> {
  const mergedSignal = blockAbortSignal(payload.blockId, signal)

  const task = (async (): Promise<AsyncRenderResult | null> => {
    if (mergedSignal.aborted) return { kind: 'cancelled' }

    if (payload.kind === 'mermaid-svg') {
      const svg = await renderMermaidSvg(
        payload.blockId,
        payload.source,
        payload.priority,
        mergedSignal,
      )
      if (!svg || mergedSignal.aborted) return { kind: 'cancelled' }
      return svg
    }

    return null
  })()

  pendingByBlock.set(payload.blockId, task)
  void task.finally(() => {
    if (pendingByBlock.get(payload.blockId) === task) {
      pendingByBlock.delete(payload.blockId)
    }
  })

  return task
}

export function cancelAsyncRender(blockId: string): void {
  abortByBlock.get(blockId)?.abort()
  abortByBlock.delete(blockId)
  pendingByBlock.delete(blockId)
}

export function cancelAllAsyncRenders(): void {
  for (const ac of abortByBlock.values()) ac.abort()
  abortByBlock.clear()
  pendingByBlock.clear()
}
