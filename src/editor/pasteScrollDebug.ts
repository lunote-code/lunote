import type { EditorView } from '@tiptap/pm/view'
import type { Transaction } from '@tiptap/pm/state'

import { describeScrollMetrics } from './modeSwitchDebug'

const LOG_PREFIX = '[paste-scroll-debug]'

export type PasteScrollSource =
  | 'native-paste-event'
  | 'menu-paste'
  | 'menu-paste-plain'
  | 'bridge-replace'

type ScrollScrollerSnapshot = {
  label: string
  scrollTop: number
  max: number
  ratio: number | null
}

export type PasteScrollSnapshot = {
  pm: ReturnType<typeof describeScrollMetrics>
  window: { scrollY: number; max: number | null; ratio: number | null }
  scrollers: ScrollScrollerSnapshot[]
}

type ScrollWatcher = {
  label: string
  element: HTMLElement | Window
  lastTop: number
  onScroll: () => void
}

type PasteScrollTraceSession = {
  id: string
  source: PasteScrollSource
  startedAt: number
  context: Record<string, unknown>
  pmView: EditorView | null
  startSnapshot: PasteScrollSnapshot | null
  watchers: ScrollWatcher[]
  timers: number[]
  finished: boolean
}

let traceCounter = 0
let activeTrace: PasteScrollTraceSession | null = null

function shouldLogPasteScroll(): boolean {
  return import.meta.env.DEV
}

function walkScrollContainers(root: HTMLElement | null): ScrollScrollerSnapshot[] {
  if (!root) return []
  const out: ScrollScrollerSnapshot[] = []
  let node: HTMLElement | null = root
  while (node) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      const metrics = describeScrollMetrics(node)
      out.push({
        label: `${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`,
        scrollTop: metrics.top ?? 0,
        max: metrics.max ?? 0,
        ratio: metrics.ratio,
      })
    }
    node = node.parentElement
  }
  return out
}

export function capturePasteScrollSnapshot(pmDom: HTMLElement | null): PasteScrollSnapshot {
  const pm = describeScrollMetrics(pmDom)
  const windowMax = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  const windowScrollY = window.scrollY
  return {
    pm,
    window: {
      scrollY: windowScrollY,
      max: windowMax,
      ratio: windowMax > 0 ? windowScrollY / windowMax : 0,
    },
    scrollers: walkScrollContainers(pmDom),
  }
}

function isPmViewLive(view: EditorView | null | undefined): view is EditorView {
  if (!view) return false
  try {
    const dom = view.dom as HTMLElement | undefined
    if (!dom?.isConnected) return false
    void view.state.doc.content.size
    return Boolean((view as EditorView & { docView?: unknown }).docView)
  } catch {
    return false
  }
}

function safeCoordsAtPos(view: EditorView, pos: number): { top: number; bottom: number; left: number } | null {
  if (!isPmViewLive(view)) return null
  try {
    return view.coordsAtPos(pos)
  } catch {
    return null
  }
}

function summarizeSelection(view: EditorView | null | undefined): Record<string, unknown> | null {
  if (!isPmViewLive(view)) return null
  try {
    const { from, to, empty } = view.state.selection
    const coords = safeCoordsAtPos(view, from)
    return {
      from,
      to,
      empty,
      docSize: view.state.doc.content.size,
      coords: coords
        ? { top: Math.round(coords.top), bottom: Math.round(coords.bottom), left: Math.round(coords.left) }
        : null,
    }
  } catch {
    return null
  }
}

function transactionScrollFlags(tr: Transaction): Record<string, unknown> {
  const scrollIntoView =
    Object.prototype.hasOwnProperty.call(tr, 'scrollIntoView') &&
    (tr as Transaction & { scrollIntoView?: boolean }).scrollIntoView === true
  return {
    docChanged: tr.docChanged,
    selectionSet: tr.selectionSet,
    steps: tr.steps.length,
    scrollIntoView,
    uiEvent: tr.getMeta('uiEvent'),
    pasteMeta: tr.getMeta('paste'),
    inputLayerSource: tr.getMeta('inputLayerSource'),
  }
}

export function debugPasteScroll(phase: string, payload: Record<string, unknown>): void {
  if (!shouldLogPasteScroll()) return
  const traceId = activeTrace?.id ?? null
  console.debug(`${LOG_PREFIX} ${phase}`, traceId ? { traceId, ...payload } : payload)
}

function installScrollWatcher(
  session: PasteScrollTraceSession,
  label: string,
  element: HTMLElement | Window,
  readTop: () => number,
): void {
  const onScroll = () => {
    if (session.finished) return
    const nextTop = readTop()
    const prevTop = session.watchers.find((w) => w.label === label)?.lastTop ?? nextTop
    if (Math.abs(nextTop - prevTop) < 2) return
    const watcher = session.watchers.find((w) => w.label === label)
    if (watcher) watcher.lastTop = nextTop
    debugPasteScroll('scroll-jump-detected', {
      label,
      from: prevTop,
      to: nextTop,
      delta: nextTop - prevTop,
      stack: new Error('[paste-scroll-debug] scroll jump stack').stack,
      snapshot: capturePasteScrollSnapshot(
        element instanceof Window ? (document.querySelector('.ProseMirror') as HTMLElement | null) : element,
      ),
    })
  }

  const lastTop = readTop()
  session.watchers.push({ label, element, lastTop, onScroll })
  if (element instanceof Window) {
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
  } else {
    element.addEventListener('scroll', onScroll, { passive: true, capture: true })
  }
}

function finishPasteScrollTrace(session: PasteScrollTraceSession, reason: string): void {
  if (session.finished) return
  session.finished = true
  for (const watcher of session.watchers) {
    if (watcher.element instanceof Window) {
      window.removeEventListener('scroll', watcher.onScroll, true)
    } else {
      watcher.element.removeEventListener('scroll', watcher.onScroll, true)
    }
  }
  for (const timer of session.timers) clearTimeout(timer)
  if (activeTrace?.id === session.id) activeTrace = null
  debugPasteScroll('trace-finished', {
    reason,
    durationMs: Date.now() - session.startedAt,
    endSnapshot: session.context.pmDom
      ? capturePasteScrollSnapshot(session.context.pmDom as HTMLElement)
      : null,
  })
}

function schedulePasteScrollFollowUp(session: PasteScrollTraceSession, pmDom: HTMLElement | null): void {
  const delays = [0, 16, 50, 120, 250, 500, 1000]
  for (const delay of delays) {
    const timer = window.setTimeout(() => {
      if (session.finished) return
      try {
        debugPasteScroll(`follow-up@${delay}ms`, {
          snapshot: capturePasteScrollSnapshot(pmDom?.isConnected ? pmDom : null),
          selection: summarizeSelection(session.pmView),
          pmViewLive: isPmViewLive(session.pmView),
        })
      } catch (error) {
        debugPasteScroll(`follow-up@${delay}ms-error`, {
          message: error instanceof Error ? error.message : String(error),
        })
      }
      if (delay === 1000) finishPasteScrollTrace(session, 'follow-up-complete')
    }, delay)
    session.timers.push(timer)
  }
}

export function startPasteScrollTrace(args: {
  source: PasteScrollSource
  pmView?: EditorView | null
  context?: Record<string, unknown>
}): string | null {
  if (!shouldLogPasteScroll()) return null
  if (activeTrace) finishPasteScrollTrace(activeTrace, 'superseded')

  traceCounter += 1
  const pmDom = (args.pmView?.dom as HTMLElement | undefined) ?? null
  const id = `paste-${traceCounter}-${Date.now()}`
  const session: PasteScrollTraceSession = {
    id,
    source: args.source,
    startedAt: Date.now(),
    pmView: args.pmView ?? null,
    context: {
      ...args.context,
      pmDom,
    },
    startSnapshot: capturePasteScrollSnapshot(pmDom),
    watchers: [],
    timers: [],
    finished: false,
  }
  activeTrace = session

  if (pmDom) {
    installScrollWatcher(session, 'pm-root', pmDom, () => pmDom.scrollTop)
    let node: HTMLElement | null = pmDom.parentElement
    let depth = 0
    while (node && depth < 8) {
      const style = window.getComputedStyle(node)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') {
        const label = `ancestor-${depth}:${node.tagName.toLowerCase()}`
        const target = node
        installScrollWatcher(session, label, target, () => target.scrollTop)
      }
      node = node.parentElement
      depth += 1
    }
  }
  installScrollWatcher(session, 'window', window, () => window.scrollY)

  debugPasteScroll('trace-started', {
    source: args.source,
    startSnapshot: session.startSnapshot,
    selection: summarizeSelection(args.pmView ?? null),
    context: args.context ?? {},
  })

  schedulePasteScrollFollowUp(session, pmDom)
  return id
}

export function logPasteScrollPhase(
  phase: string,
  payload: Record<string, unknown> & { pmView?: EditorView | null },
): void {
  if (!shouldLogPasteScroll()) return
  try {
    const { pmView, ...rest } = payload
    debugPasteScroll(phase, {
      ...rest,
      selection: summarizeSelection(pmView ?? null),
      snapshot: capturePasteScrollSnapshot(
        pmView && isPmViewLive(pmView) ? (pmView.dom as HTMLElement) : null,
      ),
    })
  } catch (error) {
    debugPasteScroll(`${phase}-error`, {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

export function logPasteScrollTransaction(
  phase: string,
  pmView: EditorView,
  tr: Transaction,
  extra?: Record<string, unknown>,
): void {
  if (!shouldLogPasteScroll()) return
  logPasteScrollPhase(phase, {
    pmView,
    transaction: transactionScrollFlags(tr),
    ...extra,
  })
}

export function logPasteScrollPropSync(args: {
  path:
    | 'skip-duplicate-hydration'
    | 'skip-atomic-bootstrap'
    | 'skip-serialized-match'
    | 'skip-editor-echo'
    | 'set-content'
    | 'skip-composing'
    | 'skip-suppressed-sync'
  documentKey: string
  markdownLength: number
  pmView?: EditorView | null
  detail?: Record<string, unknown>
}): void {
  if (!shouldLogPasteScroll()) return
  debugPasteScroll('prop-sync', {
    ...args,
    snapshot: capturePasteScrollSnapshot((args.pmView?.dom as HTMLElement | undefined) ?? null),
  })
}

export function logPasteScrollMarkdownSync(args: {
  phase: 'schedule' | 'serialize' | 'emit-change' | 'skip'
  delayMs?: number
  markdownLength?: number
  changed?: boolean
  pmView?: EditorView | null
  detail?: Record<string, unknown>
}): void {
  if (!shouldLogPasteScroll()) return
  debugPasteScroll('markdown-sync', {
    ...args,
    snapshot: capturePasteScrollSnapshot((args.pmView?.dom as HTMLElement | undefined) ?? null),
  })
}
