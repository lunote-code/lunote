import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { TiptapMarkdownEditorHandle } from '../../TiptapMarkdownEditor'
import { useI18n } from '../../../i18n'
import { pushAppToast } from '../../../app/toast/appToastStore'
import {
  clearEditorAiInsertUndo,
  notifyEditorAiInsertApplied,
} from '../editorAiInsertFeedback'
import {
  consumeEditorAiCursorInsertRequest,
  registerEditorAiCursorInsertContext,
  runEditorAiCursorInsert,
  subscribeEditorAiCursorInsert,
  type EditorAiCursorInsertContext,
} from '../editorAiCursorInsert'

type Input = EditorAiCursorInsertContext & {
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
}

export function useEditorAiCursorInsert(input: Input): void {
  const { t } = useI18n()

  useEffect(() => {
    registerEditorAiCursorInsertContext({
      docKey: input.docKey,
      activePath: input.activePath,
      activeTabLabel: input.activeTabLabel,
      content: input.content,
      visualEditorRef: input.visualEditorRef,
    })
    return () => registerEditorAiCursorInsertContext(null)
  }, [
    input.activePath,
    input.activeTabLabel,
    input.content,
    input.docKey,
    input.visualEditorRef,
  ])

  useEffect(() => {
    const runPending = () => {
      const request = consumeEditorAiCursorInsertRequest()
      if (!request) return

      const context = {
        docKey: input.docKey,
        activePath: input.activePath,
        activeTabLabel: input.activeTabLabel,
        content: input.content,
        visualEditorRef: input.visualEditorRef,
      }

      const resolvedWorkingToastKey =
        request.type === 'direct-apply' ? request.request.workingToastKey : undefined
      const resolvedDoneToastKey =
        request.type === 'direct-apply' ? request.request.doneToastKey : undefined
      const resolvedFailedToastKey =
        request.type === 'direct-apply' ? request.request.failedToastKey : undefined
      const suppressWorkingToast =
        request.type === 'direct-apply' ? request.request.suppressWorkingToast === true : false
      const suppressDoneToast =
        request.type === 'direct-apply' ? request.request.suppressDoneToast === true : false

      if (!suppressWorkingToast) {
        pushAppToast(t(resolvedWorkingToastKey ?? 'ai.editor.cursorInsert.working'), 'info')
      }

      void runEditorAiCursorInsert(context, request).then((result) => {
        if (result.ok) {
          notifyEditorAiInsertApplied(input.activePath)
          if (suppressDoneToast) {
            return
          }
          if (resolvedDoneToastKey) {
            pushAppToast(t(resolvedDoneToastKey), 'success')
          } else {
            pushAppToast(t('ai.editor.cursorInsert.done', { count: result.charCount }), 'success')
          }
          return
        }

        if (result.code === 'aborted') return

        if (result.code === 'not_configured') {
          pushAppToast(t('ai.rail.configureFirst'), 'warning')
          return
        }
        if (result.code === 'no_selection') {
          pushAppToast(t('ai.rail.command.noSelection'), 'warning')
          return
        }
        if (result.code === 'empty_response') {
          pushAppToast(t('ai.rail.error.empty_response'), 'error')
          return
        }
        pushAppToast(t(resolvedFailedToastKey ?? 'ai.editor.directApply.failed'), 'error')
      })
    }

    runPending()
    return subscribeEditorAiCursorInsert(runPending)
  }, [
    input.activePath,
    input.activeTabLabel,
    input.content,
    input.docKey,
    input.visualEditorRef,
    t,
  ])
}

export function useClearEditorAiInsertUndoOnPathChange(activePath: string | null): void {
  useEffect(() => {
    clearEditorAiInsertUndo()
  }, [activePath])
}
