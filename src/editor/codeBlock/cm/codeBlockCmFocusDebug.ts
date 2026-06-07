import type { Editor } from '@tiptap/core'
import type { EditorView as PmEditorView } from '@tiptap/pm/view'

import { getNativeInputFocusState, listNativeInputRegistrations } from '../../documentRuntime/nativeInput'
import { isCodeBlockCmDom, isCodeBlockToolbarDom } from './codeBlockCmDom'
import { getCodeBlockCmViewInWrap, isCodeBlockCmFocused } from './codeBlockCmFocus'
import { describePmLockState } from './codeBlockCmPmFocusLock'
import {
  clearLunaDebugFile,
  flushLunaDebugFileSink,
  isLunaDebugFileSinkAvailable,
  sinkLunaDebugEvent,
} from '../../debug/lunaDebugFileSink'

const LOG_PREFIX = '[codeblock-cm-focus]'
const LOG_CHANNEL = 'codeblock-cm-focus'
/** Dev JSONL path (written by Vite middleware). Agents: read after user reproduces. */
export const CODEBLOCK_CM_FOCUS_LOG_PATH = `~/.luna/logs/${LOG_CHANNEL}.jsonl`
const LS_KEY = 'luna.debug.codeBlockCmFocus'
const LS_CONSOLE_KEY = 'luna.debug.codeBlockCmFocus.console'
const MAX_RECENT = 80

export type CodeBlockCmFocusDebugEvent = {
  seq: number
  at: number
  wallAt?: number
  tag: string
  data?: Record<string, unknown>
}

let seq = 0
let loggingPaused = false
const recent: CodeBlockCmFocusDebugEvent[] = []

function isCodeBlockCmFocusConsoleEnabled(): boolean {
  try {
    if (localStorage.getItem(LS_CONSOLE_KEY) === '1') return true
  } catch {
    /* ignore */
  }
  return !isCodeBlockCmFocusFileLogEnabled()
}

export function isCodeBlockCmFocusFileLogEnabled(): boolean {
  if (!isCodeBlockCmFocusDebug() || !isLunaDebugFileSinkAvailable()) return false
  try {
    return localStorage.getItem('luna.debug.codeBlockCmFocus.file') !== '0'
  } catch {
    return true
  }
}

function pushRecent(tag: string, data?: Record<string, unknown>): void {
  const entry: CodeBlockCmFocusDebugEvent = {
    seq: ++seq,
    at: performance.now(),
    wallAt: Date.now(),
    tag,
    data,
  }
  recent.push(entry)
  if (recent.length > MAX_RECENT) recent.shift()
  if (isCodeBlockCmFocusFileLogEnabled()) {
    const urgent =
      tag.startsWith('fold-') ||
      tag.startsWith('pm-') ||
      tag.startsWith('controller-session') ||
      tag === 'editor-editable-changed'
    sinkLunaDebugEvent(LOG_CHANNEL, entry, { urgent })
  }
}

export function isCodeBlockCmFocusDebug(): boolean {
  try {
    if (localStorage.getItem(LS_KEY) === '1') return true
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).has('codeblockCmFocusDebug')
    }
  } catch {
    /* ignore */
  }
  return false
}

async function beginCodeBlockCmFocusFileSession(): Promise<void> {
  if (!isCodeBlockCmFocusFileLogEnabled()) return
  await clearLunaDebugFile(LOG_CHANNEL)
  sinkLunaDebugEvent(LOG_CHANNEL, {
    at: performance.now(),
    wallAt: Date.now(),
    tag: 'debug-session-start',
    data: {
      userAgent: navigator.userAgent,
      href: location.href,
    },
  })
  await flushLunaDebugFileSink(LOG_CHANNEL)
}

export function enableCodeBlockCmFocusDebug(reload = true): void {
  localStorage.setItem(LS_KEY, '1')
  if (isLunaDebugFileSinkAvailable()) {
    localStorage.setItem('luna.debug.codeBlockCmFocus.file', '1')
    localStorage.removeItem(LS_CONSOLE_KEY)
    loggingPaused = true
  }
  const fileHint = isLunaDebugFileSinkAvailable()
    ? ` 日志写入 ${CODEBLOCK_CM_FOCUS_LOG_PATH}（已自动清空旧会话；Console 默认暂停，恢复：__lunaCodeBlockCmFocusResume()）。操作代码块后无需复制 Console，Agent 会直接读该文件。`
    : ''
  console.warn(
    `${LOG_PREFIX} 已开启。${fileHint}${reload ? '页面将自动刷新…' : '请手动刷新页面。'}刷新后操作代码块（勿把命令贴进编辑器）。`,
  )
  if (reload && typeof location !== 'undefined') location.reload()
}

export function disableCodeBlockCmFocusDebug(): void {
  localStorage.removeItem(LS_KEY)
  loggingPaused = false
  console.info(`${LOG_PREFIX} 已关闭（无需刷新，新日志立即停止）。`)
}

/** Pause console spam immediately; recent buffer still records for export. */
export function pauseCodeBlockCmFocusDebugLogging(): void {
  loggingPaused = true
  console.info(
    `${LOG_PREFIX} 日志已暂停。复制缓冲：copy(JSON.stringify(__lunaCodeBlockCmFocusLogs(), null, 2))；恢复：__lunaCodeBlockCmFocusResume()`,
  )
}

export function resumeCodeBlockCmFocusDebugLogging(): void {
  loggingPaused = false
  console.info(`${LOG_PREFIX} 日志已恢复。`)
}

export function isCodeBlockCmFocusLoggingPaused(): boolean {
  return loggingPaused
}

export function getRecentCodeBlockCmFocusLogs(): readonly CodeBlockCmFocusDebugEvent[] {
  return recent
}

export function describeDomTarget(target: EventTarget | null): Record<string, unknown> {
  if (!(target instanceof HTMLElement)) {
    return { kind: target == null ? 'null' : typeof target }
  }
  const cls = target.className
    ? String(target.className).split(/\s+/).filter(Boolean).slice(0, 6).join(' ')
    : ''
  return {
    tag: target.tagName.toLowerCase(),
    id: target.id || undefined,
    class: cls || undefined,
    isContentEditable: target.isContentEditable,
    inCodeBlockWrap: !!target.closest('[data-luna-code-block-wrap]'),
    inCm: isCodeBlockCmDom(target),
    inToolbar: isCodeBlockToolbarDom(target),
    nativeInputId: target.closest('[data-native-input-id]')?.getAttribute('data-native-input-id') ?? undefined,
  }
}

/** Simulate ProseMirror eventBelongsToView walk; log which nodeView stops the event. */
export function probePmEventBelongsToView(
  pmView: PmEditorView,
  event: Event,
): { belongsToPm: boolean; stopNode: Record<string, unknown> | null } {
  if (!event.bubbles) return { belongsToPm: true, stopNode: null }
  if (event.defaultPrevented) return { belongsToPm: false, stopNode: { reason: 'defaultPrevented' } }

  let stopNode: Record<string, unknown> | null = null
  for (let node = event.target as Node | null; node && node !== pmView.dom; node = node.parentNode) {
    if (node.nodeType === 11) {
      stopNode = { reason: 'documentFragment' }
      return { belongsToPm: false, stopNode }
    }
    const desc = (node as HTMLElement & { pmViewDesc?: { stopEvent?: (e: Event) => boolean } }).pmViewDesc
    if (desc?.stopEvent?.(event)) {
      stopNode = {
        tag: node instanceof HTMLElement ? node.tagName.toLowerCase() : node.nodeName,
        class:
          node instanceof HTMLElement && node.className
            ? String(node.className).split(/\s+/).slice(0, 4).join(' ')
            : undefined,
      }
      return { belongsToPm: false, stopNode }
    }
  }
  return { belongsToPm: true, stopNode }
}

export function describePmSelection(pmView: PmEditorView | null | undefined): Record<string, unknown> | null {
  if (!pmView) return null
  const { from, to, empty } = pmView.state.selection
  const $from = pmView.state.selection.$from
  return {
    from,
    to,
    empty,
    parentType: $from.parent.type.name,
    inCodeBlock: $from.parent.type.name === 'codeBlock',
    pmFocused: pmView.hasFocus(),
  }
}

export function describeCodeBlockWraps(): Record<string, unknown>[] {
  return [...document.querySelectorAll<HTMLElement>('[data-luna-code-block-wrap]')].map((wrap) => {
    const cmView = getCodeBlockCmViewInWrap(wrap)
    const classTokens = wrap.className ? String(wrap.className).split(/\s+/).filter(Boolean) : []
    return {
      from: wrap.getAttribute('data-luna-code-block-from'),
      sessionMode: wrap.getAttribute('data-session-mode'),
      dataFolded: wrap.getAttribute('data-folded'),
      foldedClass: classTokens.includes('pm-code-block-wrap--folded'),
      cmMounted: !!cmView,
      cmHasFocus: cmView?.hasFocus ?? false,
      cmSelection: cmView ? { from: cmView.state.selection.main.from, to: cmView.state.selection.main.to } : null,
    }
  })
}

let foldTraceSeq = 0

export function nextFoldTraceId(): string {
  return `fold-${++foldTraceSeq}`
}

export function describeFoldUiState(wrap: HTMLElement | null | undefined): Record<string, unknown> | null {
  if (!wrap) return null
  const classTokens = wrap.className ? String(wrap.className).split(/\s+/).filter(Boolean) : []
  return {
    dataFolded: wrap.getAttribute('data-folded'),
    foldedClass: classTokens.includes('pm-code-block-wrap--folded'),
    cmClass: classTokens.includes('pm-code-block-wrap--cm'),
    sessionMode: wrap.getAttribute('data-session-mode'),
    classPreview: classTokens.filter((t) => t.startsWith('pm-code-block-wrap')).join(' '),
  }
}

export function dumpCodeBlockCmFocusState(editor?: Editor | null): Record<string, unknown> {
  const pmView = editor?.view ?? null
  return {
    debugEnabled: isCodeBlockCmFocusDebug(),
    activeElement: describeDomTarget(document.activeElement),
    cmFocusedGlobal: isCodeBlockCmFocused(),
    nativeInput: getNativeInputFocusState(),
    nativeInputs: listNativeInputRegistrations().map((r) => ({
      id: r.id,
      type: r.type,
      blockId: r.blockId,
    })),
    pmSelection: describePmSelection(pmView),
    pmLock: editor ? describePmLockState(editor) : null,
    codeBlocks: describeCodeBlockWraps(),
    recentLogs: recent.slice(-30),
    foldLogs: recent.filter((e) => e.tag.startsWith('fold-')).slice(-20),
  }
}

export function debugCodeBlockCmFocus(tag: string, data?: Record<string, unknown>): void {
  if (!isCodeBlockCmFocusDebug()) return
  pushRecent(tag, data)
  if (loggingPaused || !isCodeBlockCmFocusConsoleEnabled()) return
  console.log(LOG_PREFIX, tag, data ?? {})
}

export async function clearCodeBlockCmFocusDebugFile(): Promise<boolean> {
  return clearLunaDebugFile(LOG_CHANNEL)
}

let bootstrapInstalled = false
let editorRef: Editor | null = null

export function bootstrapCodeBlockCmFocusDebug(): void {
  if (!isCodeBlockCmFocusDebug() || bootstrapInstalled) return
  bootstrapInstalled = true

  const fileMode = isCodeBlockCmFocusFileLogEnabled()
  console.warn(
    `${LOG_PREFIX} ✅ 调试已激活。` +
      (fileMode
        ? ` 日志写入 ${CODEBLOCK_CM_FOCUS_LOG_PATH}（Console 已暂停，恢复：__lunaCodeBlockCmFocusResume()）。`
        : ` Console 过滤请输入前缀 "${LOG_PREFIX}"（带方括号）。`) +
      ` 操作代码块后 Agent 读取 ${CODEBLOCK_CM_FOCUS_LOG_PATH}；快照：__lunaCodeBlockCmFocusDump()。`,
  )
  if (fileMode) {
    void beginCodeBlockCmFocusFileSession()
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      const t = event.target
      if (!(t instanceof HTMLElement)) return
      if (!t.closest('[data-luna-code-block-wrap]')) return
      debugCodeBlockCmFocus('doc-capture-codeblock-click', {
        target: describeDomTarget(t),
        activeElement: describeDomTarget(document.activeElement),
        defaultPrevented: event.defaultPrevented,
      })
    },
    true,
  )
}

type CodeBlockCmFocusDebugWindow = Window & {
  __lunaCodeBlockCmFocusDump?: () => Record<string, unknown>
  __lunaCodeBlockCmFocusEnable?: (reload?: boolean) => void
  __lunaCodeBlockCmFocusDisable?: () => void
  __lunaCodeBlockCmFocusPause?: () => void
  __lunaCodeBlockCmFocusResume?: () => void
  __lunaCodeBlockCmFocusClearFile?: () => Promise<boolean>
  __lunaCodeBlockCmFocusFlush?: () => Promise<void>
  __lunaCodeBlockCmFocusLogPath?: () => string
  __lunaCodeBlockCmFocusLogs?: () => readonly CodeBlockCmFocusDebugEvent[]
  __lunaCodeBlockCmFocusStatus?: () => Record<string, unknown>
}

function installCodeBlockCmFocusDebugGlobalsEarly(): void {
  if (typeof window === 'undefined') return
  const w = window as CodeBlockCmFocusDebugWindow
  if (w.__lunaCodeBlockCmFocusStatus) return

  w.__lunaCodeBlockCmFocusStatus = () => ({
    debugEnabled: isCodeBlockCmFocusDebug(),
    loggingPaused: isCodeBlockCmFocusLoggingPaused(),
    fileLogEnabled: isCodeBlockCmFocusFileLogEnabled(),
    logFile: isCodeBlockCmFocusFileLogEnabled() ? CODEBLOCK_CM_FOCUS_LOG_PATH : null,
    consoleEnabled: isCodeBlockCmFocusConsoleEnabled(),
    localStorageKey: LS_KEY,
    localStorageValue: (() => {
      try {
        return localStorage.getItem(LS_KEY)
      } catch {
        return null
      }
    })(),
    urlFlag: new URLSearchParams(window.location.search).has('codeblockCmFocusDebug'),
    logCount: recent.length,
    hint: isCodeBlockCmFocusDebug()
      ? isCodeBlockCmFocusFileLogEnabled()
        ? `已开启：操作代码块后让 Agent 读取 ${CODEBLOCK_CM_FOCUS_LOG_PATH}`
        : '已开启：点击代码块后执行 __lunaCodeBlockCmFocusDump()'
      : `未开启：在 Console 粘贴执行 __lunaCodeBlockCmFocusEnable()（会自动刷新）`,
  })
  w.__lunaCodeBlockCmFocusEnable = (reload = true) => enableCodeBlockCmFocusDebug(reload)
  w.__lunaCodeBlockCmFocusDisable = disableCodeBlockCmFocusDebug
  w.__lunaCodeBlockCmFocusPause = pauseCodeBlockCmFocusDebugLogging
  w.__lunaCodeBlockCmFocusResume = () => {
    try {
      localStorage.setItem(LS_CONSOLE_KEY, '1')
    } catch {
      /* ignore */
    }
    resumeCodeBlockCmFocusDebugLogging()
  }
  w.__lunaCodeBlockCmFocusClearFile = clearCodeBlockCmFocusDebugFile
  w.__lunaCodeBlockCmFocusFlush = () => flushLunaDebugFileSink(LOG_CHANNEL)
  w.__lunaCodeBlockCmFocusLogPath = () => CODEBLOCK_CM_FOCUS_LOG_PATH
  w.__lunaCodeBlockCmFocusLogs = () => getRecentCodeBlockCmFocusLogs()
  w.__lunaCodeBlockCmFocusDump = () => dumpCodeBlockCmFocusState(editorRef)

  if (isCodeBlockCmFocusDebug()) {
    bootstrapCodeBlockCmFocusDebug()
  }
}

export function installCodeBlockCmFocusDebugGlobals(editor: Editor): () => void {
  if (!isCodeBlockCmFocusDebug()) return () => {}

  editorRef = editor
  installCodeBlockCmFocusDebugGlobalsEarly()
  bootstrapCodeBlockCmFocusDebug()

  const w = window as CodeBlockCmFocusDebugWindow
  w.__lunaCodeBlockCmFocusDump = () => dumpCodeBlockCmFocusState(editor)

  debugCodeBlockCmFocus('debug-editor-ready', {
    docSize: editor.state.doc.content.size,
    pmSelection: describePmSelection(editor.view),
  })

  return () => {
    if (editorRef === editor) editorRef = null
  }
}

if (typeof window !== 'undefined') {
  queueMicrotask(installCodeBlockCmFocusDebugGlobalsEarly)
}
