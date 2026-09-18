import { useEffect, type RefObject } from 'react'

import { pushAppToast } from '../../../app/toast/appToastStore'
import { useI18n } from '../../../i18n'
import type { TiptapMarkdownEditorHandle } from '../../TiptapMarkdownEditor'
import {
  notifyEditorAiInsertApplied,
} from '../editorAiInsertFeedback'
import { blockAiActionDoneKey } from '../editorBlockAiActions'
import {
  consumeEditorBlockAiRequest,
  registerEditorBlockAiContext,
  runEditorBlockAi,
  subscribeEditorBlockAi,
  type EditorBlockAiContext,
} from '../editorBlockAiRunner'

type Input = EditorBlockAiContext & {
  visualEditorRef?: RefObject<TiptapMarkdownEditorHandle | null> | null
}

export function useEditorBlockAi(input: Input): void {
  const { t } = useI18n()

  useEffect(() => {
    registerEditorBlockAiContext({
      docKey: input.docKey,
      activePath: input.activePath,
      activeTabLabel: input.activeTabLabel,
      content: input.content,
      visualEditorRef: input.visualEditorRef,
    })
    return () => registerEditorBlockAiContext(null)
  }, [
    input.activePath,
    input.activeTabLabel,
    input.content,
    input.docKey,
    input.visualEditorRef,
  ])

  useEffect(() => {
    const runPending = () => {
      const request = consumeEditorBlockAiRequest()
      if (!request) return

      const context = {
        docKey: input.docKey,
        activePath: input.activePath,
        activeTabLabel: input.activeTabLabel,
        content: input.content,
        visualEditorRef: input.visualEditorRef,
      }

      void runEditorBlockAi(context, request.actionId, request.target, request.t).then((result) => {
        if (result.ok) {
          notifyEditorAiInsertApplied(input.activePath)
          pushAppToast(t(blockAiActionDoneKey(request.actionId)), 'success')
          return
        }

        if (result.code === 'aborted') return

        if (result.code === 'not_configured') {
          pushAppToast(t('ai.rail.configureFirst'), 'warning')
          return
        }
        if (result.code === 'empty_block') {
          pushAppToast(t('editor.blockAi.emptyBlock'), 'warning')
          return
        }
        if (result.code === 'empty_response') {
          pushAppToast(t('ai.rail.error.empty_response'), 'error')
          return
        }
        if (result.code === 'insert_failed') {
          pushAppToast(t('ai.editor.directApply.failed'), 'error')
          return
        }
        pushAppToast(t('ai.editor.directApply.failed'), 'error')
      }).catch(() => {
        pushAppToast(t('ai.editor.directApply.failed'), 'error')
      })
    }

    runPending()
    return subscribeEditorBlockAi(runPending)
  }, [
    input.activePath,
    input.activeTabLabel,
    input.content,
    input.docKey,
    input.visualEditorRef,
    t,
  ])
}
