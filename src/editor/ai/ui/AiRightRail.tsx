import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Icon } from '../../../design-system/icons'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useI18n } from '../../../i18n'
import { openPreferencesDialog } from '../../../preferences/preferencesDialogStore'
import {
  getAppSettingsSnapshotWithLocalFallback,
  subscribeAppSettings,
} from '../../../settings/appSettingsStore'
import {
  AI_PROVIDER_LABEL_KEYS,
  isAiConfigured,
  resolveAiConversationDocKey,
  resolveAiConversationScope,
  resolveAiProvider,
  vaultScopeAiConversationDocKey,
} from '../../../settings-runtime/aiSettings'
import {
  resolveAiConnectionHeaderStatus,
  type AiConnectionHeaderStatus,
} from '../../../settings-runtime/aiConnectionTestStorage'
import { isBufferTabId } from '../../../app/workspace/constants'
import { formatAiErrorDetail } from '../http/aiFetch'
import type { TiptapMarkdownEditorHandle } from '../../TiptapMarkdownEditor'
import { useAiChat } from '../hooks/useAiChat'
import { buildAiQuickActionPayload, isCursorInsertQuickAction, AI_QUICK_ACTIONS, type AiAutoApplyMode, type AiQuickActionId } from '../actions/aiQuickActions'
import {
  requestAssistantReplace,
} from '../actions/applyAssistantReplace'
import { copyAiConversationMarkdown } from '../export/exportAiConversationMarkdown'
import { performEditorAiInsertUndo } from '../actions/insertAssistantText'
import { subscribeAiPanelStore, takePendingAiPanelOpen } from '../aiPanelStore'
import {
  clearEditorAiInsertUndo,
  getEditorAiInsertUndoDocId,
  notifyEditorAiInsertApplied,
  subscribeEditorAiInsertFeedback,
} from '../editorAiInsertFeedback'
import { isEditorAiCursorInsertRunning, getEditorAiCursorInsertActionId, getEditorAiCursorInsertRequestKey, requestEditorAiCursorInsert, stopEditorAiCursorInsert, subscribeEditorAiCursorInsert } from '../editorAiCursorInsert'
import { isEditorBlockAiRunning, stopEditorBlockAi, subscribeEditorBlockAi } from '../editorBlockAiRunner'
import { bridgeRememberCurrentSelection, bridgeRememberInsertAnchor } from '../../editorMutationBridge'
import { pushAppToast } from '../../../app/toast/appToastStore'
import {
  AI_RAIL_SCROLL_SELECTORS,
  observeOverlayScrollbarReveal,
} from '../../../app/overlayScrollbarReveal'
import { AiChatComposer } from './AiChatComposer'
import { AiContextInspector } from './AiContextInspector'
import { AiMessageList } from './AiMessageList'
import { AiModelSelector } from './AiModelSelector'
import { AiQuickActions } from './AiQuickActions'
import { AiRelatedNotes } from './AiRelatedNotes'
import { AiWelcomeActions } from './AiWelcomeActions'
import {
  captureAiRailScrollSnapshotForRestore,
  registerAiRailScrollElement,
  restoreAiRailScrollSnapshot,
  syncAiRailScrollSnapshot,
  notifyAiRailPanelHidden,
  notifyAiRailPanelVisible,
} from './aiRailScrollPreserve'

type Props = {
  visible: boolean
  /** False when the knowledge tab covers the AI panel in the right rail. */
  panelActive?: boolean
  onClose: () => void
  workspaceRoot?: string
  activeDocKey: string | null
  activePath: string | null
  activeTabLabel?: string | null
  content: string
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
  selectionTick?: number
}

function resolveAiChatErrorLabel(
  t: (key: string) => string,
  code: NonNullable<ReturnType<typeof useAiChat>['errorCode']>,
): string {
  return t(`ai.rail.error.${code}`)
}

export function AiRightRail({
  visible,
  panelActive = true,
  onClose,
  workspaceRoot = '',
  activeDocKey,
  activePath,
  activeTabLabel = null,
  content,
  visualEditorRef,
  selectionTick = 0,
}: Props) {
  const { t, effectiveLocale } = useI18n()
  const [configured, setConfigured] = useState(() => isAiConfigured(getAppSettingsSnapshotWithLocalFallback()))
  const [conversationScope, setConversationScope] = useState(() =>
    resolveAiConversationScope(getAppSettingsSnapshotWithLocalFallback()),
  )
  const [providerLabel, setProviderLabel] = useState(() =>
    t(AI_PROVIDER_LABEL_KEYS[resolveAiProvider(getAppSettingsSnapshotWithLocalFallback())]),
  )
  const [insertUndoDocId, setInsertUndoDocId] = useState<string | null>(null)
  const [errorCopied, setErrorCopied] = useState(false)
  const [clearChatConfirmOpen, setClearChatConfirmOpen] = useState(false)
  const [cursorInsertRunning, setCursorInsertRunning] = useState(false)
  const [directInsertActionId, setDirectInsertActionId] = useState<AiQuickActionId | null>(null)
  const [blockAiRunning, setBlockAiRunning] = useState(false)
  const [connectionHeaderStatus, setConnectionHeaderStatus] = useState<AiConnectionHeaderStatus>(() => {
    const snapshot = getAppSettingsSnapshotWithLocalFallback()
    return resolveAiConnectionHeaderStatus(isAiConfigured(snapshot), resolveAiProvider(snapshot))
  })
  const railRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const clearInsertUndo = useCallback(() => {
    setInsertUndoDocId(null)
    clearEditorAiInsertUndo()
  }, [])

  const handleInserted = useCallback(() => {
    pushAppToast(t('ai.rail.inserted'), 'success')
    notifyEditorAiInsertApplied(activePath)
    setInsertUndoDocId(activePath)
  }, [activePath, t])

  const handleAutoApplied = useCallback(
    (mode: AiAutoApplyMode) => {
      if (mode === 'frontmatter') {
        pushAppToast(t('ai.rail.appliedToProperties'), 'success')
        return
      }
      handleInserted()
    },
    [handleInserted, t],
  )

  const handleAppliedToProperties = useCallback(() => {
    pushAppToast(t('ai.rail.appliedToProperties'), 'success')
  }, [t])

  const handleApplyToPropertiesFailed = useCallback(() => {
    pushAppToast(t('ai.rail.appliedToProperties.failed'), 'error')
  }, [t])

  const handleSaveToNewNoteResult = useCallback(
    (ok: boolean) => {
      if (ok) {
        pushAppToast(t('ai.rail.saveToNewNote.success'), 'success')
        return
      }
      pushAppToast(t('ai.rail.saveToNewNote.failed'), 'error')
    },
    [t],
  )

  const handleAutoApplyFailed = useCallback(
    (mode: AiAutoApplyMode) => {
      if (mode === 'frontmatter') {
        handleApplyToPropertiesFailed()
        return
      }
      if (mode === 'insert') {
        pushAppToast(t('ai.rail.autoApply.insertFailed'), 'error')
        return
      }
      if (mode === 'replace') {
        pushAppToast(t('ai.rail.autoApply.replaceFailed'), 'error')
      }
    },
    [handleApplyToPropertiesFailed, t],
  )

  const handleReplaceUnchanged = useCallback(() => {
    pushAppToast(t('ai.rail.replaceUnchanged'), 'info')
  }, [t])

  const handleInsertFailed = useCallback(() => {
    pushAppToast(t('ai.rail.autoApply.insertFailed'), 'error')
  }, [t])

  const handleReplaceFailed = useCallback(() => {
    pushAppToast(t('ai.rail.autoApply.replaceFailed'), 'error')
  }, [t])

  const handleReplaceMessage = useCallback(
    (proposed: string, actionId?: AiQuickActionId) => {
      const result = requestAssistantReplace({
        proposed,
        actionId,
        content,
        activePath,
        visualEditorRef,
        onApplied: handleInserted,
      })
      if (result === 'unchanged') handleReplaceUnchanged()
      else if (result === 'failed') handleReplaceFailed()
    },
    [activePath, content, handleInserted, handleReplaceFailed, handleReplaceUnchanged, visualEditorRef],
  )

  const contextDocKey =
    activePath && isBufferTabId(activePath) ? activePath : activeDocKey
  const conversationDocKey = vaultScopeAiConversationDocKey(
    workspaceRoot,
    resolveAiConversationDocKey(getAppSettingsSnapshotWithLocalFallback(), contextDocKey, activePath),
  )
  const chat = useAiChat({
    docKey: contextDocKey,
    conversationDocKey,
    activePath,
    activeTabLabel,
    content,
    visualEditorRef,
    selectionTick,
    onAutoApplied: handleAutoApplied,
    onAutoApplyFailed: handleAutoApplyFailed,
    onReplaceUnchanged: handleReplaceUnchanged,
  })
  const { setDraft: setChatDraft, sendMessage: sendChatMessage, clearChat } = chat

  useEffect(() => {
    return subscribeAppSettings(() => {
      const snapshot = getAppSettingsSnapshotWithLocalFallback()
      const provider = resolveAiProvider(snapshot)
      const nextConfigured = isAiConfigured(snapshot)
      setConfigured(nextConfigured)
      setConnectionHeaderStatus(resolveAiConnectionHeaderStatus(nextConfigured, provider))
      setConversationScope(resolveAiConversationScope(snapshot))
      setProviderLabel(t(AI_PROVIDER_LABEL_KEYS[provider]))
    })
  }, [activePath, contextDocKey, t])

  useEffect(() => {
    const syncInsertUndo = () => {
      const docId = getEditorAiInsertUndoDocId()
      setInsertUndoDocId(docId)
    }
    syncInsertUndo()
    return subscribeEditorAiInsertFeedback(syncInsertUndo)
  }, [])

  useEffect(() => {
    const syncRunning = () => {
      setCursorInsertRunning(isEditorAiCursorInsertRunning())
      const actionId = getEditorAiCursorInsertActionId()
      const requestKey = getEditorAiCursorInsertRequestKey()
      setDirectInsertActionId(actionId ?? (requestKey as AiQuickActionId | null))
    }
    syncRunning()
    return subscribeEditorAiCursorInsert(syncRunning)
  }, [])

  useEffect(() => {
    const refreshConnectionStatus = () => {
      const snapshot = getAppSettingsSnapshotWithLocalFallback()
      setConnectionHeaderStatus(
        resolveAiConnectionHeaderStatus(isAiConfigured(snapshot), resolveAiProvider(snapshot)),
      )
    }
    refreshConnectionStatus()
    window.addEventListener('luna:ai-connection-test-updated', refreshConnectionStatus)
    return () => window.removeEventListener('luna:ai-connection-test-updated', refreshConnectionStatus)
  }, [visible, configured])

  useEffect(() => {
    const syncRunning = () => setBlockAiRunning(isEditorBlockAiRunning())
    syncRunning()
    return subscribeEditorBlockAi(syncRunning)
  }, [])

  useEffect(() => {
    if (!visible) return
    const consumePendingOpen = () => {
      const pending = takePendingAiPanelOpen()
      if (!pending) return
      if (pending.prefillDraft) setChatDraft(pending.prefillDraft)
      if (pending.autoSend && pending.prefillDraft?.trim() && configured) {
        sendChatMessage({
          text: pending.prefillDraft,
          systemHint: pending.systemHint,
          taskMode: pending.taskMode,
          actionId: pending.actionId,
          autoApply: pending.autoApply ?? null,
        })
      }
    }
    consumePendingOpen()
    return subscribeAiPanelStore(consumePendingOpen)
  }, [configured, sendChatMessage, setChatDraft, visible])

  useEffect(() => {
    if (visible) return
    setInsertUndoDocId(null)
  }, [visible])

  useEffect(() => {
    clearInsertUndo()
  }, [clearInsertUndo, conversationDocKey])

  useEffect(() => {
    setErrorCopied(false)
  }, [chat.errorCode, chat.errorDetail])

  const bindScrollRef = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node
    registerAiRailScrollElement(node)
  }, [])

  useEffect(() => {
    return () => registerAiRailScrollElement(null)
  }, [])

  useEffect(() => {
    if (!visible || !railRef.current) return
    return observeOverlayScrollbarReveal(railRef.current, AI_RAIL_SCROLL_SELECTORS)
  }, [visible, chat.messages.length])

  const handleQuickAction = (actionId: AiQuickActionId) => {
    if (isCursorInsertQuickAction(actionId)) {
      bridgeRememberInsertAnchor()
      requestEditorAiCursorInsert(actionId, t)
      return
    }
    const payload = buildAiQuickActionPayload(actionId, t, effectiveLocale)
    if (!payload) return
    if (payload.autoApply === 'replace') {
      bridgeRememberCurrentSelection()
    } else if (payload.autoApply === 'insert') {
      bridgeRememberInsertAnchor()
    }
    chat.sendMessage({
      text: payload.userMessage,
      actionId: payload.actionId,
      systemHint: payload.systemHint,
      taskMode: payload.taskMode,
      autoApply: payload.autoApply ?? null,
    })
  }

  const handleExportChat = () => {
    if (chat.messages.length === 0) return
    void copyAiConversationMarkdown(chat.messages, {
      title: activeTabLabel ?? activePath,
    })
      .then(() => {
        pushAppToast(t('ai.rail.exportChat.copied'), 'success')
      })
      .catch(() => {
        pushAppToast(t('ai.rail.exportChat.failed'), 'error')
      })
  }

  const handleUndoInsert = () => {
    if (!insertUndoDocId) return
    if (performEditorAiInsertUndo(insertUndoDocId)) {
      setInsertUndoDocId(null)
      return
    }
    pushAppToast(t('ai.rail.undoInsert.failed'), 'error')
  }

  const handleClearChat = useCallback(() => {
    setClearChatConfirmOpen(true)
  }, [])

  const handleClearChatConfirm = useCallback(() => {
    setClearChatConfirmOpen(false)
    clearInsertUndo()
    clearChat()
  }, [clearChat, clearInsertUndo])

  const handleClearChatCancel = useCallback(() => {
    setClearChatConfirmOpen(false)
  }, [])

  const errorLabel = chat.errorCode ? resolveAiChatErrorLabel(t, chat.errorCode) : null
  const formattedErrorDetail = chat.errorDetail ? formatAiErrorDetail(chat.errorDetail) : undefined
  const errorText = errorLabel
    ? formattedErrorDetail
      ? `${errorLabel}: ${formattedErrorDetail}`
      : errorLabel
    : ''
  const hasMessages = chat.messages.length > 0
  const aiBusy = chat.isStreaming || cursorInsertRunning || blockAiRunning
  const showInsertUndo = Boolean(insertUndoDocId && hasMessages)
  const showWelcomeInsertUndo = Boolean(insertUndoDocId && !hasMessages)
  const showDirectActionBusy = Boolean(!hasMessages && (cursorInsertRunning || blockAiRunning))
  const directActionLabel = directInsertActionId
    ? t(AI_QUICK_ACTIONS.find((action) => action.id === directInsertActionId)?.labelKey ?? 'ai.rail.directAction.generic')
    : t('ai.rail.directAction.generic')
  const connectionStatusLabel =
    connectionHeaderStatus === 'verified'
      ? t('ai.rail.connectionVerified')
      : t('ai.rail.connectionUnverified')
  const connectionStatusTestId =
    connectionHeaderStatus === 'verified'
      ? 'ai-rail-connection-verified'
      : 'ai-rail-connection-unverified'
  const panelActiveRef = useRef(panelActive)

  useLayoutEffect(() => {
    const wasActive = panelActiveRef.current
    panelActiveRef.current = panelActive
    if (wasActive && !panelActive) {
      notifyAiRailPanelHidden()
      return
    }
    if (!visible || !panelActive) return
    if (!wasActive && panelActive) {
      notifyAiRailPanelVisible()
      return
    }
    captureAiRailScrollSnapshotForRestore()
    restoreAiRailScrollSnapshot()
  }, [
    visible,
    panelActive,
    chat.messages,
    chat.isStreaming,
    insertUndoDocId,
    chat.errorCode,
    chat.errorDetail,
  ])

  const handleCopyError = () => {
    if (!errorText) return
    void navigator.clipboard.writeText(errorText).then(() => {
      setErrorCopied(true)
      window.setTimeout(() => setErrorCopied(false), 1600)
    }).catch(() => {
      pushAppToast(t('ai.rail.copyError.failed'), 'error')
    })
  }

  if (!visible) return null

  return (
    <aside
      ref={railRef}
      className={`kos-right-rail ai-right-rail workspace-split mod-right-split${hasMessages ? ' ai-right-rail--active-chat' : ''}`}
      aria-label={t('ai.rail.aria')}
      data-testid="editor-ai-rail"
    >
      <div className="ai-rail-header">
        <div className="ai-rail-header-top">
          <div className="ai-rail-title-row">
            <Icon name="ai" size="sm" tone="accent" />
            <span className="ai-rail-title">{t('ai.rail.title')}</span>
            {conversationScope === 'global' ? (
              <span className="ai-rail-scope-chip" data-testid="ai-rail-scope-global">
                {t('ai.rail.scope.global')}
              </span>
            ) : null}
          </div>
          <div className="ai-rail-header-actions">
            {hasMessages ? (
              <>
                <button
                  type="button"
                  className="icon-btn ghost-btn ai-rail-action-btn"
                  onClick={handleExportChat}
                  disabled={aiBusy}
                  aria-label={t('ai.rail.exportChat')}
                  title={t('ai.rail.exportChat')}
                  data-testid="ai-rail-export-chat"
                >
                  <Icon name="export" size="sm" stroke="strong" />
                </button>
                <button
                  type="button"
                  className="icon-btn ghost-btn ai-rail-action-btn"
                  onClick={handleClearChat}
                  disabled={aiBusy}
                  aria-label={t('ai.rail.clearChat')}
                  title={t('ai.rail.clearChat')}
                  data-testid="ai-rail-clear-chat"
                >
                  <Icon name="delete" size="sm" stroke="strong" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="icon-btn ghost-btn ai-rail-action-btn kos-rail-close"
              onClick={onClose}
              aria-label={t('ai.rail.close')}
              data-testid="ai-rail-close"
            >
              <Icon name="close" size="sm" stroke="strong" />
            </button>
          </div>
        </div>
        {configured ? (
          <div
            className="ai-rail-header-sub ai-rail-header-status"
            data-testid="ai-rail-connection-ready"
          >
            <div className="ai-rail-header-sub-main">
              <span
                className={`ai-rail-status-pill${
                  connectionHeaderStatus === 'verified'
                    ? ' ai-rail-status-pill--ok'
                    : ' ai-rail-status-pill--warning'
                }`}
                data-testid={connectionStatusTestId}
                title={
                  connectionHeaderStatus === 'unverified'
                    ? t('ai.rail.connectionUnverifiedHint')
                    : undefined
                }
              >
                {connectionStatusLabel}
              </span>
              <span className="ai-rail-sub-sep" aria-hidden="true">
                ·
              </span>
              <span className="ai-rail-sub-provider">{providerLabel}</span>
              <span className="ai-rail-sub-sep" aria-hidden="true">
                ·
              </span>
              <AiModelSelector
                ariaLabel={t('ai.rail.sessionModel')}
                defaultLabel={t('ai.rail.modelDefault')}
                meta
              />
            </div>
            <button
              type="button"
              className="icon-btn ghost-btn ai-rail-action-btn ai-rail-sub-settings"
              onClick={() => openPreferencesDialog('ai')}
              aria-label={t('ai.rail.openSettings')}
              title={t('ai.rail.openSettings')}
              data-testid="ai-rail-open-settings"
            >
              <Icon name="settings" size="sm" stroke="strong" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="ai-rail-body kos-rail-body">
        {!configured ? (
          <div className="ai-rail-connection" data-testid="ai-rail-not-configured">
            <p className="ai-rail-connection-intro">{t('ai.rail.configureFirst')}</p>
            <ol className="ai-rail-connection-steps">
              <li>{t('ai.rail.configureFirst.step1')}</li>
              <li>{t('ai.rail.configureFirst.step2')}</li>
              <li>{t('ai.rail.configureFirst.step3')}</li>
            </ol>
            <button
              type="button"
              className="ai-rail-settings-btn"
              onClick={() => openPreferencesDialog('ai')}
            >
              {t('ai.rail.openSettings')}
            </button>
          </div>
        ) : null}
        <div
          ref={bindScrollRef}
          className="ai-rail-scroll"
          onScroll={syncAiRailScrollSnapshot}
        >
          {!hasMessages ? (
            <div className="ai-rail-welcome">
              <p className="ai-rail-welcome-title">{t('ai.rail.welcomeTitle')}</p>
              <p className="ai-rail-welcome-desc">{t('ai.rail.welcomeDescription')}</p>
              {showDirectActionBusy ? (
                <div
                  className="ai-rail-direct-action-busy"
                  role="status"
                  aria-live="polite"
                  data-testid="ai-rail-direct-action-busy"
                >
                  <span className="ai-rail-direct-action-busy-spinner" aria-hidden="true" />
                  <span>{t('ai.rail.directAction.working', { action: directActionLabel })}</span>
                </div>
              ) : null}
              <AiWelcomeActions
                disabled={!configured}
                configured={configured}
                configureFirstTitle={t('ai.rail.configureFirst')}
                hasNoteContext={chat.contextIndicators.hasNoteContext}
                isStreaming={aiBusy}
                labelFor={t}
                onAction={handleQuickAction}
              />
              {showWelcomeInsertUndo ? (
                <div
                  className="ai-rail-insert-notice"
                  role="group"
                  aria-label={t('ai.rail.undoInsert')}
                >
                  <button
                    type="button"
                    className="ai-rail-insert-undo"
                    onMouseDown={(event) => {
                      event.preventDefault()
                    }}
                    onClick={handleUndoInsert}
                    data-testid="ai-insert-undo-button"
                  >
                    {t('ai.rail.undoInsert')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <AiMessageList
            messages={chat.messages}
            docKey={contextDocKey}
            thinkingLabel={t('ai.rail.thinking')}
            isStreaming={chat.isStreaming}
            insertLabel={t('ai.rail.insert')}
            replaceLabel={t('ai.rail.replaceSelection')}
            replaceRestoredLabel={t('ai.rail.replaceRestoredSelection')}
            applyToPropertiesLabel={t('ai.rail.applyToProperties')}
            copyLabel={t('ai.rail.copy')}
            copiedLabel={t('ai.rail.copied')}
            userAvatarLabel={t('ai.rail.avatar.user')}
            assistantAvatarLabel={t('ai.rail.avatar.assistant')}
            canReplaceSelection={chat.canReplaceSelection}
            replaceUsesRestoredSelection={chat.replaceUsesRestoredSelection}
            regenerateLabel={t('ai.rail.regenerate')}
            saveToNewNoteLabel={t('ai.rail.saveToNewNote')}
            saveToNewNoteStem={t('ai.rail.saveToNewNote.stem')}
            undoInsertLabel={t('ai.rail.undoInsert')}
            showInsertUndo={showInsertUndo}
            onUndoInsert={handleUndoInsert}
            onInserted={handleInserted}
            onInsertFailed={handleInsertFailed}
            onReplaceFailed={handleReplaceFailed}
            onAppliedToProperties={handleAppliedToProperties}
            onApplyToPropertiesFailed={handleApplyToPropertiesFailed}
            onSaveToNewNoteResult={handleSaveToNewNoteResult}
            onRegenerate={chat.regenerateMessage}
            onReplaceMessage={handleReplaceMessage}
            grammarEmptyLabel={t('ai.grammar.empty')}
            grammarCountLabel={(count) => t('ai.grammar.pendingCount', { count })}
            grammarLocateLabel={t('ai.grammar.locate')}
            grammarApplyLabel={t('ai.grammar.apply')}
            grammarIgnoreLabel={t('ai.grammar.ignore')}
            grammarAppliedLabel={t('ai.grammar.applied')}
            grammarLocateFailedLabel={t('ai.grammar.locateFailed')}
            grammarApplyFailedLabel={t('ai.grammar.applyFailed')}
            grammarParseFailedLabel={t('ai.grammar.parseFailed')}
            onGrammarApplied={handleInserted}
          />
          {errorLabel ? (
            <div className="ai-rail-error-row" role="alert">
              <p className="ai-rail-error">
                {errorLabel}
                {formattedErrorDetail ? `: ${formattedErrorDetail}` : null}
              </p>
              <div className="ai-rail-error-actions">
                <button
                  type="button"
                  className="ai-rail-error-action"
                  onClick={handleCopyError}
                  data-testid="ai-error-copy-button"
                >
                  {errorCopied ? t('ai.rail.copied') : t('ai.rail.copy')}
                </button>
                <button
                  type="button"
                  className="ai-rail-retry-btn"
                  onClick={chat.retryLast}
                  disabled={aiBusy}
                  data-testid="ai-retry-button"
                >
                  {t('ai.rail.retry')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="ai-rail-footer">
          {chat.contextIndicators.hasNoteContext || chat.contextIndicators.selectionCharCount > 0 ? (
            <div className="ai-rail-context-summary" data-testid="ai-context-summary">
              {chat.contextIndicators.hasNoteContext ? (
                <span className="ai-rail-context-summary-note">
                  {activeTabLabel?.trim() || t('ai.rail.context.currentNote')}
                </span>
              ) : null}
              {chat.contextIndicators.selectionCharCount > 0 ? (
                <span className="ai-rail-context-summary-selection">
                  {chat.contextIndicators.hasNoteContext ? (
                    <span className="ai-rail-context-summary-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {t('ai.rail.context.selectionChars', {
                    count: chat.contextIndicators.selectionCharCount,
                  })}
                </span>
              ) : null}
            </div>
          ) : null}
          <AiRelatedNotes docKey={contextDocKey} titleLabel={t('ai.rail.relatedNotes.title')} />
          <div className="ai-rail-footer-tools">
            <AiContextInspector
              snapshot={chat.contextInspector}
              hasNoteContext={chat.contextIndicators.hasNoteContext}
              workspaceSearchCount={chat.contextIndicators.workspaceSearchCount}
              graphNeighborCount={chat.contextIndicators.graphNeighborCount}
              workspaceSearchPending={chat.contextIndicators.workspaceSearchPending}
              graphNeighborsPending={chat.contextIndicators.graphNeighborsPending}
              workspaceSearchFailed={chat.contextIndicators.workspaceSearchFailed}
              workspaceSearchMissed={chat.contextIndicators.workspaceSearchMissed}
              graphNeighborsFailed={chat.contextIndicators.graphNeighborsFailed}
              graphNeighborsMissed={chat.contextIndicators.graphNeighborsMissed}
              referencedNoteCount={chat.contextIndicators.referencedNoteCount}
              noteLabel={t('ai.rail.context.currentNote')}
              workspaceSearchLabel={(count) => t('ai.rail.context.workspaceSearch', { count })}
              workspaceSearchPendingLabel={t('ai.rail.context.workspaceSearchPending')}
              workspaceSearchPendingTooltip={t('ai.rail.context.workspaceSearchPendingTooltip')}
              workspaceSearchPendingInspectorLabel={t('ai.rail.context.workspaceSearchPendingInspector')}
              workspaceSearchFailedLabel={t('ai.rail.context.workspaceSearchFailed')}
              workspaceSearchFailedTooltip={t('ai.rail.context.workspaceSearchFailedTooltip')}
              workspaceSearchFailedInspectorLabel={t('ai.rail.context.workspaceSearchFailedInspector')}
              workspaceSearchMissedLabel={t('ai.rail.context.workspaceSearchMissed')}
              workspaceSearchMissedTooltip={t('ai.rail.context.workspaceSearchMissedTooltip')}
              workspaceSearchMissedInspectorLabel={t('ai.rail.context.workspaceSearchMissedInspector')}
              graphNeighborsLabel={(count) => t('ai.rail.context.graphNeighbors', { count })}
              graphNeighborsPendingLabel={t('ai.rail.context.graphNeighborsPending')}
              graphNeighborsPendingTooltip={t('ai.rail.context.graphNeighborsPendingTooltip')}
              graphNeighborsFailedLabel={t('ai.rail.context.graphNeighborsFailed')}
              graphNeighborsFailedTooltip={t('ai.rail.context.graphNeighborsFailedTooltip')}
              graphNeighborsFailedInspectorLabel={t('ai.rail.context.graphNeighborsFailedInspector')}
              graphNeighborsMissedLabel={t('ai.rail.context.graphNeighborsMissed')}
              graphNeighborsMissedTooltip={t('ai.rail.context.graphNeighborsMissedTooltip')}
              graphNeighborsMissedInspectorLabel={t('ai.rail.context.graphNeighborsMissedInspector')}
              referencedNotesLabel={(count) => t('ai.rail.context.referencedNotes', { count })}
              inspectorTitle={t('ai.rail.context.inspectorTitle')}
              noteSectionLabel={t('ai.rail.context.inspectorNote')}
              selectionSectionLabel={t('ai.rail.context.inspectorSelection')}
              workspaceSectionLabel={t('ai.rail.context.inspectorWorkspace')}
              graphSectionLabel={t('ai.rail.context.inspectorGraph')}
              referencedSectionLabel={t('ai.rail.context.inspectorReferenced')}
              emptyLabel={t('ai.rail.context.inspectorEmpty')}
              closeLabel={t('ai.rail.close')}
            />
            <AiQuickActions
              disabled={!configured}
              configured={configured}
              configureFirstTitle={t('ai.rail.configureFirst')}
              hasEditorSelection={chat.hasEditorSelection}
              isStreaming={aiBusy}
              labelFor={t}
              moreMenuAriaLabel={t('ai.rail.quickActions.moreMenu')}
              onAction={handleQuickAction}
            />
          </div>
          <AiChatComposer
            value={chat.draft}
            onChange={chat.setDraft}
            onSend={chat.sendMessage}
            onStop={() => {
              chat.stop()
              stopEditorAiCursorInsert()
              stopEditorBlockAi()
            }}
            disabled={!configured}
            canSend={chat.canSend && configured}
            isStreaming={aiBusy}
            placeholder={t('ai.rail.inputPlaceholder')}
            sendLabel={t('ai.rail.send')}
            stopLabel={t('ai.rail.stop')}
            excludeDocKey={contextDocKey}
            mentionEmptyLabel={t('ai.rail.mention.empty')}
          />
        </div>
      </div>
      <ConfirmDialog
        open={clearChatConfirmOpen}
        title={t('ai.rail.clearChat.confirmTitle')}
        message={t('ai.rail.clearChat.confirmMessage')}
        confirmLabel={t('ai.rail.clearChat.confirm')}
        cancelLabel={t('app.rename.cancel')}
        variant="warning"
        portalRoot={railRef.current}
        backdropClassName="ai-rail-confirm-backdrop"
        panelDataTestId="ai-rail-clear-chat-confirm"
        onConfirm={handleClearChatConfirm}
        onCancel={handleClearChatCancel}
      />
    </aside>
  )
}
