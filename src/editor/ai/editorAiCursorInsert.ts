import type { RefObject } from 'react'
import type { TiptapMarkdownEditorHandle } from '../TiptapMarkdownEditor'
import { getAppSettingsSnapshot } from '../../settings/appSettingsStore'
import {
  isAiConfiguredFromSettings,
  resolveAiGraphTwoHop,
  resolveAiIncludeGraphNeighbors,
  resolveAiIncludeWorkspaceSearch,
  resolveAiPreferMentionContextOnly,
  resolveAiSettings,
  resolveAiSystemPrompt,
} from '../../settings-runtime/aiSettings'
import { streamAiChat } from './aiChatService'
import { createAiChatMessageId, type AiChatErrorCode, type AiChatMessage } from './aiChatTypes'
import { getBridgePaneMode } from '../editorMutationBridge'
import { buildAiContext } from './context/buildAiContext'
import { buildAiGraphContext } from './context/buildAiGraphContext'
import { buildAiMentionContext } from './context/buildAiMentionContext'
import { buildAiRagContext } from './context/buildAiRagContext'
import { hasAiEditorSelection } from './context/readAiEditorSelection'
import {
  AI_QUICK_ACTIONS,
  type AiAutoApplyMode,
  buildAiQuickActionPayload,
  isCursorInsertQuickAction,
  type AiQuickActionId,
} from './actions/aiQuickActions'
import { insertAssistantText } from './actions/insertAssistantText'
import type { TaskMode } from './prompts/types'
import { preserveAiRailScrollDuring } from './ui/aiRailScrollPreserve'
import { acquireEditorAiWriteLock, releaseEditorAiWriteLock } from './editorAiWriteLock'

export type EditorAiCursorInsertContext = {
  docKey: string | null
  activePath: string | null
  activeTabLabel?: string | null
  content: string
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
}

type Sub = () => void

let registeredContext: EditorAiCursorInsertContext | null = null
let running = false
let runningActionId: AiQuickActionId | null = null
let runningRequestKey: string | null = null
let abortController: AbortController | null = null
const subs = new Set<Sub>()

function notify(): void {
  for (const sub of subs) sub()
}

export function registerEditorAiCursorInsertContext(
  context: EditorAiCursorInsertContext | null,
): void {
  registeredContext = context
}

export function subscribeEditorAiCursorInsert(cb: Sub): () => void {
  subs.add(cb)
  return () => subs.delete(cb)
}

export function isEditorAiCursorInsertRunning(): boolean {
  return running
}

export function getEditorAiCursorInsertActionId(): AiQuickActionId | null {
  return runningActionId
}

export function getEditorAiCursorInsertRequestKey(): string | null {
  return runningRequestKey
}

export function isCursorInsertAction(actionId: AiQuickActionId): boolean {
  return isCursorInsertQuickAction(actionId)
}

export function stopEditorAiCursorInsert(): void {
  abortController?.abort()
}

function shouldSkipWorkspaceSearch(
  settings: ReturnType<typeof getAppSettingsSnapshot>,
  userContent: string,
  mentionedNoteCount: number,
): boolean {
  if (mentionedNoteCount === 0) return false
  if (resolveAiPreferMentionContextOnly(settings)) return true
  return /\[\[[^\]]+\]\]/.test(userContent)
}

export type EditorAiCursorInsertResult =
  | { ok: true; charCount: number }
  | { ok: false; code: AiChatErrorCode | 'no_selection' | 'no_context' | 'insert_failed' | 'busy' }

export type EditorAiDirectApplyRequest = {
  userMessage: string
  taskMode: TaskMode
  systemHint?: string
  autoApply: Extract<AiAutoApplyMode, 'insert' | 'replace'>
  requiresSelection?: boolean
  actionId?: AiQuickActionId
  trackingKey?: string
  workingToastKey?: string
  doneToastKey?: string
  failedToastKey?: string
  suppressWorkingToast?: boolean
  suppressDoneToast?: boolean
}

export type EditorAiCursorInsertRequest =
  | { type: 'quick-action'; actionId: AiQuickActionId; t: (key: string) => string }
  | { type: 'direct-apply'; request: EditorAiDirectApplyRequest; t: (key: string) => string }

export type ResolvedEditorAiCursorInsertRequest = {
  userMessage: string
  taskMode: TaskMode
  systemHint?: string
  autoApply: Extract<AiAutoApplyMode, 'insert' | 'replace'>
  requiresSelection: boolean
  actionId?: AiQuickActionId
  trackingKey?: string
  workingToastKey?: string
  doneToastKey?: string
  failedToastKey?: string
  suppressWorkingToast?: boolean
  suppressDoneToast?: boolean
}

function resolveEditorAiCursorInsertRequest(
  request: EditorAiCursorInsertRequest,
): ResolvedEditorAiCursorInsertRequest | null {
  if (request.type === 'quick-action') {
    const action = buildAiQuickActionPayload(request.actionId, request.t)
    if (!action) return null
    const actionDef = AI_QUICK_ACTIONS.find((item) => item.id === request.actionId)
    return {
      userMessage: action.userMessage,
      taskMode: action.taskMode,
      systemHint: action.systemHint,
      autoApply: 'insert',
      requiresSelection: Boolean(actionDef?.requiresSelection),
      actionId: action.actionId,
      trackingKey: request.actionId,
    }
  }
  return {
    userMessage: request.request.userMessage,
    taskMode: request.request.taskMode,
    systemHint: request.request.systemHint,
    autoApply: request.request.autoApply,
    requiresSelection: Boolean(request.request.requiresSelection),
    actionId: request.request.actionId,
    trackingKey: request.request.trackingKey,
    workingToastKey: request.request.workingToastKey,
    doneToastKey: request.request.doneToastKey,
    failedToastKey: request.request.failedToastKey,
    suppressWorkingToast: request.request.suppressWorkingToast,
    suppressDoneToast: request.request.suppressDoneToast,
  }
}

export async function runEditorAiCursorInsert(
  context: EditorAiCursorInsertContext,
  request: EditorAiCursorInsertRequest,
): Promise<EditorAiCursorInsertResult> {
  const resolved = resolveEditorAiCursorInsertRequest(request)
  if (!resolved) return { ok: false, code: 'invalid_request' as AiChatErrorCode }

  if (resolved.requiresSelection && !hasAiEditorSelection(context.visualEditorRef)) {
    return { ok: false, code: 'no_selection' }
  }

  const settings = resolveAiSettings(getAppSettingsSnapshot())
  if (!isAiConfiguredFromSettings(settings)) {
    return { ok: false, code: 'not_configured' }
  }
  const lockKey = context.activePath ?? context.docKey
  const lockOwner = 'cursor-insert'
  if (!acquireEditorAiWriteLock(lockKey, lockOwner)) {
    return { ok: false, code: 'busy' }
  }

  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  running = true
  runningActionId = resolved.actionId ?? null
  runningRequestKey = resolved.trackingKey ?? resolved.actionId ?? null
  notify()

  const userMessage: AiChatMessage = {
    id: createAiChatMessageId(),
    role: 'user',
    content: resolved.userMessage,
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

    let aiContext = {
      ...baseContext,
      taskMode: resolved.taskMode,
      actionId: resolved.actionId,
      systemHint: resolved.systemHint,
      customSystemPrompt: resolveAiSystemPrompt(settingsSnapshot) || null,
    }

    if (resolveAiIncludeGraphNeighbors(settingsSnapshot) && context.docKey) {
      try {
        const graphTwoHop = resolveAiGraphTwoHop(settingsSnapshot)
        const neighbors = buildAiGraphContext(context.docKey, { twoHop: graphTwoHop })
        if (neighbors.length > 0) {
          aiContext = {
            ...aiContext,
            graphNeighbors: neighbors,
            graphNeighborMaxHops: graphTwoHop ? 2 : 1,
          }
        }
      } catch {
        // graph context is best-effort for cursor insert
      }
    }

    const skipWorkspaceSearch = shouldSkipWorkspaceSearch(settingsSnapshot, resolved.userMessage, 0)
    const workspaceSearchAttempted =
      resolveAiIncludeWorkspaceSearch(settingsSnapshot) &&
      !skipWorkspaceSearch &&
      Boolean(resolved.userMessage.trim())

    if (workspaceSearchAttempted) {
      try {
        const snippets = await buildAiRagContext({
          query: resolved.userMessage,
          excludeDocKey: context.docKey,
        })
        if (snippets.length > 0) {
          aiContext = { ...aiContext, workspaceSnippets: snippets }
        }
      } catch {
        // workspace search is best-effort for cursor insert
      }
    }

    const mentionedNotes = buildAiMentionContext(resolved.userMessage, context.docKey)
    if (mentionedNotes.length > 0) {
      aiContext = { ...aiContext, mentionedNotes }
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

    let inserted = false
    preserveAiRailScrollDuring(() => {
      inserted = insertAssistantText(trimmed, resolved.autoApply)
    })
    if (!inserted) return { ok: false, code: 'insert_failed' }

    return { ok: true, charCount: trimmed.length }
  } catch {
    if (controller.signal.aborted) return { ok: false, code: 'aborted' }
    return {
      ok: false,
      code: 'unknown',
    }
  } finally {
    releaseEditorAiWriteLock(lockKey, lockOwner)
    if (abortController === controller) {
      abortController = null
    }
    running = false
    runningActionId = null
    runningRequestKey = null
    notify()
  }
}

type PendingRequest = EditorAiCursorInsertRequest

let pendingRequest: PendingRequest | null = null
let requestQueued = false

export function requestEditorAiCursorInsert(
  actionId: AiQuickActionId,
  t: (key: string) => string,
): void {
  pendingRequest = { type: 'quick-action', actionId, t }
  requestQueued = true
  notify()
}

export function requestEditorAiDirectApply(
  request: EditorAiDirectApplyRequest,
  t: (key: string) => string,
): void {
  pendingRequest = { type: 'direct-apply', request, t }
  requestQueued = true
  notify()
}

export function consumeEditorAiCursorInsertRequest(): PendingRequest | null {
  if (!requestQueued) return null
  requestQueued = false
  const value = pendingRequest
  pendingRequest = null
  return value
}

export function getEditorAiCursorInsertContext(): EditorAiCursorInsertContext | null {
  return registeredContext
}

export function resetEditorAiCursorInsertForTests(): void {
  abortController?.abort()
  abortController = null
  running = false
  runningActionId = null
  runningRequestKey = null
  registeredContext = null
  pendingRequest = null
  requestQueued = false
  subs.clear()
}
