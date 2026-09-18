import type { RefObject } from 'react'

import { pushAppToast } from '../../app/toast/appToastStore'
import { getAppSettingsSnapshot } from '../../settings/appSettingsStore'
import {
  isAiConfiguredFromSettings,
  resolveAiSettings,
  resolveAiSystemPrompt,
} from '../../settings-runtime/aiSettings'
import type { TiptapMarkdownEditorHandle } from '../TiptapMarkdownEditor'
import { bridgeRememberBlockAiTarget, bridgeForceTextSelection, getBridgePaneMode } from '../editorMutationBridge'
import { streamAiChat } from './aiChatService'
import {
  createAiChatMessageId,
  type AiChatErrorCode,
  type AiChatMessage,
} from './aiChatTypes'
import {
  buildBlockAiSystemHint,
  buildBlockAiUserMessage,
  revalidateBlockAiTargetSnapshot,
  resolveBlockAiApplyMode,
  resolveBlockAiTaskMode,
  type BlockAiActionId,
  type BlockAiTargetSnapshot,
} from './editorBlockAi'
import { buildAiContext } from './context/buildAiContext'
import { insertAssistantText } from './actions/insertAssistantText'
import { preserveAiRailScrollDuring } from './ui/aiRailScrollPreserve'
import { acquireEditorAiWriteLock, releaseEditorAiWriteLock } from './editorAiWriteLock'

export type EditorBlockAiContext = {
  docKey: string | null
  activePath: string | null
  activeTabLabel?: string | null
  content: string
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
}

type Sub = () => void

let registeredContext: EditorBlockAiContext | null = null
let running = false
let abortController: AbortController | null = null
const subs = new Set<Sub>()

function notify(): void {
  for (const sub of subs) sub()
}

export function registerEditorBlockAiContext(context: EditorBlockAiContext | null): void {
  registeredContext = context
}

export function subscribeEditorBlockAi(cb: Sub): () => void {
  subs.add(cb)
  return () => subs.delete(cb)
}

export function isEditorBlockAiRunning(): boolean {
  return running
}

export function stopEditorBlockAi(): void {
  abortController?.abort()
}

export type EditorBlockAiResult =
  | { ok: true; charCount: number }
  | {
      ok: false
      code: AiChatErrorCode | 'no_context' | 'empty_block' | 'insert_failed' | 'invalid_request' | 'busy'
    }

export async function runEditorBlockAi(
  context: EditorBlockAiContext,
  actionId: BlockAiActionId,
  target: BlockAiTargetSnapshot,
  t: (key: string) => string,
): Promise<EditorBlockAiResult> {
  if (!target.blockMarkdown.trim()) return { ok: false, code: 'empty_block' }

  const settings = resolveAiSettings(getAppSettingsSnapshot())
  if (!isAiConfiguredFromSettings(settings)) {
    return { ok: false, code: 'not_configured' }
  }
  const lockKey = context.activePath ?? context.docKey
  const lockOwner = 'block-ai'
  if (!acquireEditorAiWriteLock(lockKey, lockOwner)) {
    return { ok: false, code: 'busy' }
  }

  const applyMode = resolveBlockAiApplyMode(actionId)
  bridgeRememberBlockAiTarget(target.from, target.to, applyMode)

  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  running = true
  notify()

  const userMessage: AiChatMessage = {
    id: createAiChatMessageId(),
    role: 'user',
    content: buildBlockAiUserMessage(actionId, target.blockMarkdown, t),
    createdAt: Date.now(),
  }

  try {
    let contextContent = context.content
    if (getBridgePaneMode() === 'visual') {
      try {
        contextContent =
          context.visualEditorRef?.current?.flushPendingMarkdownSync(true, false) ??
          context.content
      } catch {
        contextContent = context.content
      }
    }

    const settingsSnapshot = getAppSettingsSnapshot()
    const baseContext = buildAiContext({
      docKey: context.docKey,
      activePath: context.activePath,
      activeTabLabel: context.activeTabLabel,
      content: contextContent,
      visualEditorRef: context.visualEditorRef,
    })

    const aiContext = {
      ...baseContext,
      selection: null,
      taskMode: resolveBlockAiTaskMode(actionId),
      systemHint: buildBlockAiSystemHint(actionId),
      customSystemPrompt: resolveAiSystemPrompt(settingsSnapshot) || null,
    }

    let assistantText = ''
    for await (const event of streamAiChat({
      settings,
      messages: [userMessage],
      context: aiContext,
      signal: controller.signal,
    })) {
      if (event.type === 'delta') {
        assistantText += event.text
        continue
      }
      if (event.type === 'error') {
        if (event.code === 'aborted') return { ok: false, code: 'aborted' }
        return { ok: false, code: event.code }
      }
      if (event.type === 'done') break
    }

    const trimmed = assistantText.trim()
    if (!trimmed) return { ok: false, code: 'empty_response' }

    const editor = context.visualEditorRef?.current?.getEditor() ?? null
    const applyTarget = editor != null ? revalidateBlockAiTargetSnapshot(editor, target) : target
    if (!applyTarget) return { ok: false, code: 'insert_failed' }

    let inserted = false
    preserveAiRailScrollDuring(() => {
      bridgeRememberBlockAiTarget(applyTarget.from, applyTarget.to, applyMode)
      if (applyMode === 'replace') {
        bridgeForceTextSelection(applyTarget.from, applyTarget.to)
      }
      inserted = insertAssistantText(trimmed, applyMode)
    })
    if (!inserted) return { ok: false, code: 'insert_failed' }

    return { ok: true, charCount: trimmed.length }
  } catch {
    if (controller.signal.aborted) return { ok: false, code: 'aborted' }
    return { ok: false, code: 'unknown' }
  } finally {
    releaseEditorAiWriteLock(lockKey, lockOwner)
    if (abortController === controller) {
      abortController = null
    }
    running = false
    notify()
  }
}

type PendingRequest = {
  actionId: BlockAiActionId
  target: BlockAiTargetSnapshot
  t: (key: string) => string
}

let pendingRequest: PendingRequest | null = null
let requestQueued = false

export function requestEditorBlockAi(
  actionId: BlockAiActionId,
  target: BlockAiTargetSnapshot,
  t: (key: string) => string,
): void {
  if (running) {
    pushAppToast(t('editor.blockAi.alreadyRunning'), 'info')
    return
  }
  pendingRequest = { actionId, target, t }
  requestQueued = true
  notify()
}

export function consumeEditorBlockAiRequest(): PendingRequest | null {
  if (!requestQueued) return null
  requestQueued = false
  const value = pendingRequest
  pendingRequest = null
  return value
}

export function getEditorBlockAiContext(): EditorBlockAiContext | null {
  return registeredContext
}

export function resetEditorBlockAiForTests(): void {
  abortController?.abort()
  abortController = null
  running = false
  registeredContext = null
  pendingRequest = null
  requestQueued = false
  subs.clear()
}
