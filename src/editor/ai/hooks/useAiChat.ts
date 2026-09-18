import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { TiptapMarkdownEditorHandle } from '../../TiptapMarkdownEditor'
import { getAppSettingsSnapshot } from '../../../settings/appSettingsStore'
import {
  isAiConfiguredFromSettings,
  resolveAiGraphTwoHop,
  resolveAiIncludeGraphNeighbors,
  resolveAiIncludeWorkspaceSearch,
  resolveAiPreferMentionContextOnly,
  resolveAiProvider,
  resolveAiSettings,
  resolveAiSystemPrompt,
} from '../../../settings-runtime/aiSettings'
import { markAiConnectionVerified } from '../../../settings-runtime/aiConnectionTestStorage'
import { streamAiChat } from '../aiChatService'
import {
  createAiChatMessageId,
  type AiChatErrorCode,
  type AiChatMessage,
  type AiChatStatus,
  type TaskMode,
} from '../aiChatTypes'
import { bridgeHasLastNonEmptySelection, getBridgePaneMode } from '../../editorMutationBridge'
import { buildAiContext, type BuildAiContextInput } from '../context/buildAiContext'
import { buildAiGraphContext } from '../context/buildAiGraphContext'
import { buildAiMentionContext } from '../context/buildAiMentionContext'
import { buildAiRagContext } from '../context/buildAiRagContext'
import { hasAiEditorSelection } from '../context/readAiEditorSelection'
import type { AiAutoApplyMode, AiQuickActionId } from '../actions/aiQuickActions'
import { applyAssistantFrontmatter } from '../actions/applyAssistantFrontmatter'
import {
  requestAssistantReplace,
} from '../actions/applyAssistantReplace'
import { insertAssistantText } from '../actions/insertAssistantText'
import { parseGrammarCheckResponse } from '../grammar/parseGrammarCheckResponse'
import {
  clearAiConversation,
  flushAiConversation,
  getAiConversation,
  hydrateAiConversation,
  setAiConversation,
} from '../persistence/aiConversationStore'
import {
  captureAiRailScrollSnapshotForRestore,
  notifyAiRailStreamingIdle,
  preserveAiRailScrollDuring,
  requestAiRailScrollToBottom,
  scheduleAiRailScrollRestoreAfterSideEffects,
  setAiRailScrollContextKey,
} from '../ui/aiRailScrollPreserve'
import { readAiChatDraft, writeAiChatDraft } from './aiChatDraftStore'
import {
  getAiSessionModelOverride,
  subscribeAiSessionModelStore,
} from './aiSessionModelStore'
import { acquireEditorAiWriteLock, releaseEditorAiWriteLock } from '../editorAiWriteLock'

export type UseAiChatInput = {
  /** Note key used for context (selection, graph, RAG). */
  docKey: string | null
  /** Key used for chat persistence; may differ when conversationScope is global. */
  conversationDocKey?: string | null
  activePath: string | null
  activeTabLabel?: string | null
  content: string
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
  selectionTick?: number
  onAutoApplied?: (mode: AiAutoApplyMode) => void
  onAutoApplyFailed?: (mode: AiAutoApplyMode) => void
  onReplaceUnchanged?: () => void
}

export type AiChatContextIndicators = {
  hasNoteContext: boolean
  selectionCharCount: number
  workspaceSearchCount: number
  graphNeighborCount: number
  workspaceSearchPending: boolean
  graphNeighborsPending: boolean
  workspaceSearchFailed: boolean
  workspaceSearchMissed: boolean
  graphNeighborsFailed: boolean
  graphNeighborsMissed: boolean
  referencedNoteCount: number
}

export type AiContextInspectorNote = {
  docKey: string
  title: string
  snippet?: string | null
}

export type AiContextInspectorSnapshot = {
  noteDocKey: string | null
  noteTitle: string | null
  noteExcerpt: string | null
  selection: string | null
  workspaceHits: readonly AiContextInspectorNote[]
  graphNeighbors: readonly AiContextInspectorNote[]
  referencedNotes: readonly AiContextInspectorNote[]
}

export type SendAiMessageOptions = {
  text?: string
  systemHint?: string
  actionId?: AiQuickActionId
  taskMode?: TaskMode
  autoApply?: AiAutoApplyMode | null
}

export type UseAiChatResult = {
  messages: AiChatMessage[]
  status: AiChatStatus
  errorCode: AiChatErrorCode | null
  errorDetail: string | null
  draft: string
  setDraft: (value: string) => void
  sendMessage: (options?: SendAiMessageOptions | string) => void
  retryLast: () => void
  regenerateMessage: (assistantMessageId: string) => void
  stop: () => void
  clearChat: () => void
  canSend: boolean
  isStreaming: boolean
  contextIndicators: AiChatContextIndicators
  hasEditorSelection: boolean
  canReplaceSelection: boolean
  replaceUsesRestoredSelection: boolean
  contextInspector: AiContextInspectorSnapshot
}

function readGraphNeighborCount(docKey: string | null): number {
  if (!docKey) return 0
  const settings = getAppSettingsSnapshot()
  if (!resolveAiIncludeGraphNeighbors(settings)) return 0
  return buildAiGraphContext(docKey, { twoHop: resolveAiGraphTwoHop(settings) }).length
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

function readReferencedNoteCount(text: string, excludeDocKey?: string | null): number {
  return buildAiMentionContext(text, excludeDocKey).length
}

function toInspectorNote(note: {
  docKey: string
  title: string
  snippet?: string
  excerpt?: string
}): AiContextInspectorNote {
  return {
    docKey: note.docKey,
    title: note.title,
    snippet: note.snippet ?? note.excerpt ?? null,
  }
}

function readContextInspectorLive(input: BuildAiContextInput, draft: string): AiContextInspectorSnapshot {
  const settings = getAppSettingsSnapshot()
  const context = buildAiContext(input)
  const mentioned = buildAiMentionContext(draft, input.docKey)
  const graphNeighbors = buildAiGraphContext(input.docKey, {
    twoHop: resolveAiGraphTwoHop(settings),
  }).map(toInspectorNote)
  return {
    noteDocKey: input.docKey,
    noteTitle: context.title,
    noteExcerpt: context.excerpt,
    selection: context.selection,
    workspaceHits: [],
    graphNeighbors,
    referencedNotes: mentioned.map(toInspectorNote),
  }
}

function readContextIndicators(input: BuildAiContextInput, draft = ''): AiChatContextIndicators {
  const settings = getAppSettingsSnapshot()
  const context = buildAiContext(input)
  const workspaceSearchEnabled = resolveAiIncludeWorkspaceSearch(settings)
  const graphNeighborsEnabled = resolveAiIncludeGraphNeighbors(settings)
  const availableGraphCount = graphNeighborsEnabled ? readGraphNeighborCount(input.docKey) : 0
  return {
    hasNoteContext: Boolean(context.excerpt),
    selectionCharCount: context.selection?.length ?? 0,
    workspaceSearchCount: 0,
    graphNeighborCount: availableGraphCount,
    workspaceSearchPending: workspaceSearchEnabled,
    graphNeighborsPending: false,
    workspaceSearchFailed: false,
    workspaceSearchMissed: false,
    graphNeighborsFailed: false,
    graphNeighborsMissed: false,
    referencedNoteCount: readReferencedNoteCount(draft, input.docKey),
  }
}

function readHasEditorSelection(
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null,
): boolean {
  return hasAiEditorSelection(visualEditorRef)
}

function readCanReplaceSelection(
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null,
): boolean {
  return readHasEditorSelection(visualEditorRef) || bridgeHasLastNonEmptySelection()
}

export function useAiChat(input: UseAiChatInput): UseAiChatResult {
  const conversationDocKey = input.conversationDocKey ?? input.docKey
  const [messages, setMessages] = useState<AiChatMessage[]>(() => getAiConversation(conversationDocKey))
  const [hydrated, setHydrated] = useState(false)
  const [status, setStatus] = useState<AiChatStatus>('idle')
  const [errorCode, setErrorCode] = useState<AiChatErrorCode | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [draft, setDraftState] = useState(() => readAiChatDraft(conversationDocKey))
  const [contextIndicators, setContextIndicators] = useState<AiChatContextIndicators>(() =>
    readContextIndicators(input),
  )
  const [contextInspector, setContextInspector] = useState<AiContextInspectorSnapshot>(() =>
    readContextInspectorLive(input, readAiChatDraft(conversationDocKey)),
  )
  const [hasEditorSelection, setHasEditorSelection] = useState(() =>
    readHasEditorSelection(input.visualEditorRef),
  )
  const [canReplaceSelection, setCanReplaceSelection] = useState(() =>
    readCanReplaceSelection(input.visualEditorRef),
  )
  const [, setSessionModelOverrideState] = useState(() =>
    getAiSessionModelOverride(),
  )
  const abortRef = useRef<AbortController | null>(null)
  const pendingAutoApplyRef = useRef<AiAutoApplyMode | null>(null)
  const onAutoAppliedRef = useRef(input.onAutoApplied)
  onAutoAppliedRef.current = input.onAutoApplied
  const onAutoApplyFailedRef = useRef(input.onAutoApplyFailed)
  onAutoApplyFailedRef.current = input.onAutoApplyFailed
  const onReplaceUnchangedRef = useRef(input.onReplaceUnchanged)
  onReplaceUnchangedRef.current = input.onReplaceUnchanged
  const conversationDocKeyRef = useRef(conversationDocKey)
  const messagesRef = useRef(messages)
  const draftRef = useRef(draft)
  const inputRef = useRef(input)
  messagesRef.current = messages
  draftRef.current = draft
  inputRef.current = input

  const setDraft = useCallback((value: string) => {
    writeAiChatDraft(conversationDocKeyRef.current, value)
    setDraftState(value)
    setContextIndicators((current) => ({
      ...current,
      referencedNoteCount: readReferencedNoteCount(value, input.docKey),
    }))
    setContextInspector((inspector) => ({
      ...inspector,
      referencedNotes: buildAiMentionContext(value, input.docKey).map(toInspectorNote),
    }))
  }, [input.docKey])

  useLayoutEffect(() => {
    const scrollKey = input.conversationDocKey ?? input.docKey ?? null
    setAiRailScrollContextKey(scrollKey)
  }, [input.conversationDocKey, input.docKey])

  useLayoutEffect(() => {
    const current = inputRef.current
    setContextIndicators(readContextIndicators(current, draftRef.current))
    setContextInspector((inspector) => ({
      ...readContextInspectorLive(current, draftRef.current),
      workspaceHits: inspector.workspaceHits,
    }))
    setHasEditorSelection(readHasEditorSelection(current.visualEditorRef))
    setCanReplaceSelection(readCanReplaceSelection(current.visualEditorRef))
  }, [
    input.selectionTick,
    input.activePath,
    input.docKey,
    input.visualEditorRef,
    input.activeTabLabel,
    input.content,
  ])

  useLayoutEffect(() => {
    captureAiRailScrollSnapshotForRestore()
    scheduleAiRailScrollRestoreAfterSideEffects()
  }, [input.content, input.activePath, input.docKey, input.activeTabLabel])

  useEffect(() => {
    if (status === 'streaming') return
    notifyAiRailStreamingIdle()
  }, [status])

  useEffect(() => {
    return subscribeAiSessionModelStore(() => {
      setSessionModelOverrideState(getAiSessionModelOverride())
    })
  }, [])

  useEffect(() => {
    if (conversationDocKeyRef.current === conversationDocKey) return
    writeAiChatDraft(conversationDocKeyRef.current, draftRef.current)
    void flushAiConversation(conversationDocKeyRef.current)
    conversationDocKeyRef.current = conversationDocKey
    setHydrated(false)
    setMessages(getAiConversation(conversationDocKey))
    setDraftState(readAiChatDraft(conversationDocKey))
    setStatus('idle')
    setErrorCode(null)
    setErrorDetail(null)
    const current = inputRef.current
    setContextIndicators(readContextIndicators(current, draftRef.current))
    setContextInspector(readContextInspectorLive(current, readAiChatDraft(conversationDocKey)))
    abortRef.current?.abort()
    abortRef.current = null
  }, [conversationDocKey, input.activePath, input.activeTabLabel, input.content, input.docKey, input.visualEditorRef])

  useEffect(() => {
    let cancelled = false
    setHydrated(false)
    void hydrateAiConversation(conversationDocKey).then((loaded) => {
      if (cancelled || conversationDocKeyRef.current !== conversationDocKey) return
      setMessages((current) => (current.length > 0 ? current : loaded))
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [conversationDocKey])

  useEffect(() => {
    if (!hydrated) return
    setAiConversation(conversationDocKey, messages)
  }, [conversationDocKey, hydrated, messages])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      const current = messagesRef.current
      const lastMessage = current[current.length - 1]
      if (lastMessage?.role === 'assistant' && !lastMessage.content.trim()) {
        setAiConversation(conversationDocKeyRef.current, current.slice(0, -1))
      }
      void flushAiConversation(conversationDocKeyRef.current)
    }
  }, [])

  const stop = useCallback(() => {
    pendingAutoApplyRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
  }, [])

  const clearChat = useCallback(() => {
    stop()
    clearAiConversation(conversationDocKey)
    setMessages([])
    setErrorCode(null)
    setErrorDetail(null)
    setDraft('')
    const current = inputRef.current
    setContextIndicators(readContextIndicators(current, draftRef.current))
    setContextInspector(readContextInspectorLive(current, readAiChatDraft(conversationDocKey)))
  }, [conversationDocKey, setDraft, stop])

  const runChat = useCallback(
    (nextMessages: AiChatMessage[], sendOptions?: SendAiMessageOptions) => {
      const baseSettings = resolveAiSettings(getAppSettingsSnapshot())
      const overrideModel = getAiSessionModelOverride()
      const settings = overrideModel ? { ...baseSettings, model: overrideModel } : baseSettings
      if (!isAiConfiguredFromSettings(settings)) return
      const autoApplyMode = sendOptions?.autoApply ?? null
      const autoApplyLockKey = autoApplyMode ? input.activePath ?? input.docKey : null
      const autoApplyLockOwner = 'ai-chat'
      if (
        autoApplyMode &&
        autoApplyLockKey &&
        !acquireEditorAiWriteLock(autoApplyLockKey, autoApplyLockOwner)
      ) {
        onAutoApplyFailedRef.current?.(autoApplyMode)
        return
      }

      setStatus('streaming')
      setErrorCode(null)
      setErrorDetail(null)

      const controller = new AbortController()
      abortRef.current = controller

      const assistantId = createAiChatMessageId()
      const actionId = sendOptions?.actionId
      setMessages([
        ...nextMessages,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          autoApply: autoApplyMode ?? undefined,
          actionId,
        },
      ])

      void (async () => {
        let assistantText = ''
        const sendSnapshot = {
          docKey: input.docKey,
          activePath: input.activePath,
          content: input.content,
          visualEditorRef: input.visualEditorRef,
          activeTabLabel: input.activeTabLabel,
        }
        const finishStream = (text: string) => {
          notifyAiRailStreamingIdle()
          setStatus('idle')
          abortRef.current = null

          if (text.trim()) {
            void markAiConnectionVerified(resolveAiProvider(getAppSettingsSnapshot()))
          }

          if (actionId === 'grammar-check') {
            pendingAutoApplyRef.current = null
            const parsed = parseGrammarCheckResponse(text)
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: text,
                      grammarIssues: parsed?.issues,
                      grammarIssuesFailed: parsed === null,
                    }
                  : message,
              ),
            )
            return
          }

          const autoApply = pendingAutoApplyRef.current
          pendingAutoApplyRef.current = null
          if (!autoApply || !text.trim()) return
          const live = inputRef.current
          if (live.activePath !== sendSnapshot.activePath || live.docKey !== sendSnapshot.docKey) {
            onAutoApplyFailedRef.current?.(autoApply)
            return
          }
          preserveAiRailScrollDuring(() => {
            if (autoApply === 'frontmatter') {
              void applyAssistantFrontmatter(text, sendSnapshot.docKey).then((ok) => {
                if (ok) onAutoAppliedRef.current?.('frontmatter')
                else onAutoApplyFailedRef.current?.('frontmatter')
              })
              return
            }
            if (autoApply === 'replace') {
              const result = requestAssistantReplace({
                proposed: text,
                actionId,
                content: sendSnapshot.content,
                activePath: sendSnapshot.activePath,
                visualEditorRef: sendSnapshot.visualEditorRef,
                onApplied: () => onAutoAppliedRef.current?.('replace'),
              })
              if (result === 'unchanged') {
                onReplaceUnchangedRef.current?.()
              } else if (result === 'failed') {
                onAutoApplyFailedRef.current?.('replace')
              }
              return
            }
            if (autoApply === 'insert') {
              if (insertAssistantText(text, 'insert')) {
                onAutoAppliedRef.current?.('insert')
              } else {
                onAutoApplyFailedRef.current?.('insert')
              }
            }
          })
        }

        try {
          const settingsSnapshot = getAppSettingsSnapshot()
          let contextContent = sendSnapshot.content
          if (getBridgePaneMode() === 'visual') {
            try {
              contextContent =
                sendSnapshot.visualEditorRef?.current?.flushPendingMarkdownSync(true, false) ??
                sendSnapshot.content
            } catch {
              contextContent = sendSnapshot.content
            }
          }
          const baseContext = buildAiContext({
            docKey: sendSnapshot.docKey,
            activePath: sendSnapshot.activePath,
            activeTabLabel: sendSnapshot.activeTabLabel,
            content: contextContent,
            visualEditorRef: sendSnapshot.visualEditorRef,
          })
          const lastUser = [...nextMessages].reverse().find((message) => message.role === 'user')
          let context = {
            ...baseContext,
            taskMode: sendOptions?.taskMode,
            actionId: sendOptions?.actionId,
            systemHint: sendOptions?.systemHint,
            customSystemPrompt: resolveAiSystemPrompt(settingsSnapshot) || null,
          }
          const mentionedNotes = buildAiMentionContext(lastUser?.content ?? '', sendSnapshot.docKey)
          if (mentionedNotes.length > 0) {
            context = { ...context, mentionedNotes }
          }
          let workspaceSearchCount = 0
          let graphNeighborCount = readGraphNeighborCount(sendSnapshot.docKey)
          let workspaceSearchFailed = false
          let workspaceSearchMissed = false
          let graphNeighborsFailed = false
          let graphNeighborsMissed = false
          let workspaceHits: AiContextInspectorNote[] = []
          let graphNeighbors: AiContextInspectorNote[] = []

          if (resolveAiIncludeGraphNeighbors(settingsSnapshot)) {
            try {
              const graphTwoHop = resolveAiGraphTwoHop(settingsSnapshot)
              const neighbors = buildAiGraphContext(sendSnapshot.docKey, { twoHop: graphTwoHop })
              if (neighbors.length > 0) {
                context = {
                  ...context,
                  graphNeighbors: neighbors,
                  graphNeighborMaxHops: graphTwoHop ? 2 : 1,
                }
                graphNeighborCount = neighbors.length
                graphNeighbors = neighbors.map(toInspectorNote)
              } else if (graphNeighborCount > 0) {
                graphNeighborsMissed = true
              }
            } catch {
              graphNeighborsFailed = true
            }
          }
          const skipWorkspaceSearch = shouldSkipWorkspaceSearch(
            settingsSnapshot,
            lastUser?.content ?? '',
            mentionedNotes.length,
          )
          const workspaceSearchAttempted =
            resolveAiIncludeWorkspaceSearch(settingsSnapshot) &&
            !skipWorkspaceSearch &&
            Boolean(lastUser?.content.trim())
          if (workspaceSearchAttempted) {
            try {
              const snippets = await buildAiRagContext({
                query: lastUser!.content,
                excludeDocKey: sendSnapshot.docKey,
              })
              if (snippets.length > 0) {
                context = { ...context, workspaceSnippets: snippets }
                workspaceSearchCount = snippets.length
                workspaceHits = snippets.map(toInspectorNote)
              } else {
                workspaceSearchMissed = true
              }
            } catch {
              workspaceSearchFailed = true
            }
          }

          setContextIndicators((current) => ({
            ...current,
            workspaceSearchCount,
            graphNeighborCount,
            workspaceSearchPending: false,
            graphNeighborsPending: false,
            workspaceSearchFailed,
            workspaceSearchMissed,
            graphNeighborsFailed,
            graphNeighborsMissed,
            referencedNoteCount: mentionedNotes.length,
          }))
          setContextInspector({
            noteDocKey: sendSnapshot.docKey,
            noteTitle: baseContext.title,
            noteExcerpt: baseContext.excerpt,
            selection: baseContext.selection,
            workspaceHits,
            graphNeighbors,
            referencedNotes: mentionedNotes.map(toInspectorNote),
          })

          for await (const event of streamAiChat({
            settings,
            messages: nextMessages,
            context,
            signal: controller.signal,
          })) {
            if (event.type === 'delta') {
              assistantText += event.text
              const snapshot = assistantText
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId ? { ...message, content: snapshot } : message,
                ),
              )
              continue
            }

            if (event.type === 'done') {
              if (!assistantText.trim()) {
                pendingAutoApplyRef.current = null
                setMessages(nextMessages)
                setStatus('error')
                setErrorCode('empty_response')
                setErrorDetail(null)
                abortRef.current = null
                return
              }
              finishStream(assistantText)
              return
            }

            if (event.type === 'error') {
              if (event.code === 'aborted') {
                pendingAutoApplyRef.current = null
                if (!assistantText.trim()) {
                  setMessages(nextMessages)
                }
                notifyAiRailStreamingIdle()
                setStatus('idle')
                abortRef.current = null
                return
              }
              pendingAutoApplyRef.current = null
              setStatus('error')
              setErrorCode(event.code)
              setErrorDetail(event.detail ?? null)
              abortRef.current = null
              if (!assistantText.trim()) {
                setMessages(nextMessages)
              }
              return
            }
          }

          if (!assistantText.trim()) {
            pendingAutoApplyRef.current = null
            setMessages(nextMessages)
            setStatus('error')
            setErrorCode('empty_response')
            setErrorDetail(null)
            abortRef.current = null
            return
          }

          finishStream(assistantText)
        } catch (error) {
          if (controller.signal.aborted) {
            pendingAutoApplyRef.current = null
            if (!assistantText.trim()) {
              setMessages(nextMessages)
            }
            setStatus('idle')
            abortRef.current = null
            return
          }
          pendingAutoApplyRef.current = null
          setStatus('error')
          setErrorCode('unknown')
          setErrorDetail(error instanceof Error ? error.message : String(error))
          abortRef.current = null
          if (!assistantText.trim()) {
            setMessages(nextMessages)
          }
        } finally {
          if (autoApplyLockKey) {
            releaseEditorAiWriteLock(autoApplyLockKey, autoApplyLockOwner)
          }
        }
      })()
    },
    [input.activePath, input.activeTabLabel, input.content, input.docKey, input.visualEditorRef],
  )

  const sendMessage = useCallback(
    (options?: SendAiMessageOptions | string) => {
      const resolved =
        typeof options === 'string'
          ? { text: options }
          : options ?? {}
      const text = (resolved.text ?? draft).trim()
      if (!text || status === 'streaming') return
      if (!isAiConfiguredFromSettings(resolveAiSettings(getAppSettingsSnapshot()))) return

      pendingAutoApplyRef.current = resolved.autoApply ?? null

      const userMessage: AiChatMessage = {
        id: createAiChatMessageId(),
        role: 'user',
        content: text,
        createdAt: Date.now(),
      }
      const nextMessages = [...messagesRef.current, userMessage]
      requestAiRailScrollToBottom()
      setMessages(nextMessages)
      if (!resolved.text) setDraft('')
      runChat(nextMessages, {
        systemHint: resolved.systemHint,
        actionId: resolved.actionId,
        taskMode: resolved.taskMode,
        autoApply: resolved.autoApply,
      })
    },
    [draft, runChat, setDraft, status],
  )

  const retryLast = useCallback(() => {
    if (status === 'streaming') return
    const current = messagesRef.current
    const lastUserIndex = current.findLastIndex((message) => message.role === 'user')
    if (lastUserIndex < 0) return
    pendingAutoApplyRef.current = null
    const trimmed = current.slice(0, lastUserIndex + 1)
    setMessages(trimmed)
    runChat(trimmed)
  }, [runChat, status])

  const regenerateMessage = useCallback(
    (assistantMessageId: string) => {
      if (status === 'streaming') return
      const current = messagesRef.current
      const assistantIndex = current.findIndex((message) => message.id === assistantMessageId)
      if (assistantIndex < 0 || current[assistantIndex]?.role !== 'assistant') return

      let userIndex = -1
      for (let index = assistantIndex - 1; index >= 0; index -= 1) {
        if (current[index]?.role === 'user') {
          userIndex = index
          break
        }
      }
      if (userIndex < 0) return

      pendingAutoApplyRef.current = null
      abortRef.current?.abort()
      abortRef.current = null
      const trimmed = current.slice(0, userIndex + 1)
      setMessages(trimmed)
      setErrorCode(null)
      setErrorDetail(null)
      runChat(trimmed)
    },
    [runChat, status],
  )

  const canSend = draft.trim().length > 0 && status !== 'streaming'
  const replaceUsesRestoredSelection = canReplaceSelection && !hasEditorSelection

  return {
    messages,
    status,
    errorCode,
    errorDetail,
    draft,
    setDraft,
    sendMessage,
    retryLast,
    regenerateMessage,
    stop,
    clearChat,
    canSend,
    isStreaming: status === 'streaming',
    contextIndicators,
    hasEditorSelection,
    canReplaceSelection,
    replaceUsesRestoredSelection,
    contextInspector,
  }
}
