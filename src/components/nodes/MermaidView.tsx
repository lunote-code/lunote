import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'

import { CodeBlockShell } from '../codeBlock/CodeBlockShell'
import { ensureMermaidBlockIdAtPos } from '../../editor/extensions/MermaidNode'
import { getBlockMode, useCodeBlock, useCodeBlockMode } from '../../editor/codeBlockRuntime'
import { switchMermaidActiveBlock } from '../../editor/mermaid/mermaidSourceBlockSwitch'
import { debugMermaid } from '../../editor/mermaid/mermaidDebug'
import { isMermaidDocumentEditable } from '../../editor/mermaid/mermaidSourceInputFocus'
import { useMermaidBlockSession, useMermaidSourceSession } from '../../editor/mermaid/MermaidSourceSession'
import { runAfterReactCommit } from '../../editor/reactCommitScheduler'
import { parseChangedBlock } from '../../editor/runtimeEngine'
import {
  cancelBlockRender,
  preemptLowerPriorityBlockRenders,
} from '../../editor/runtimeEngine/renderScheduler'
import { cancelAllAsyncBlockRender } from '../../editor/runtimeEngine/unified/asyncBlockWorker'
import {
  RUNTIME_SURFACE_CLASS,
  runtimeSurfaceDataAttrs,
  useUnifiedBlockRender,
  type BlockRendererType,
} from '../../editor/runtimeEngine/unified'
import { MermaidBlockSourceEditor } from './MermaidBlockSourceEditor'
import { useI18n } from '../../i18n'

function snapshotScrollableAncestors(root: HTMLElement | null): Array<{ el: HTMLElement; top: number; left: number }> {
  const snapshots: Array<{ el: HTMLElement; top: number; left: number }> = []
  let current: HTMLElement | null = root
  while (current) {
    const style = window.getComputedStyle(current)
    const overflowY = style.overflowY
    const overflowX = style.overflowX
    const canScrollY =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      current.scrollHeight > current.clientHeight + 1
    const canScrollX =
      (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
      current.scrollWidth > current.clientWidth + 1
    if (canScrollY || canScrollX) {
      snapshots.push({ el: current, top: current.scrollTop, left: current.scrollLeft })
    }
    current = current.parentElement
  }
  return snapshots
}

function restoreScrollableAncestors(snapshots: Array<{ el: HTMLElement; top: number; left: number }>): void {
  for (const snapshot of snapshots) {
    snapshot.el.scrollTop = snapshot.top
    snapshot.el.scrollLeft = snapshot.left
  }
}

export const MermaidView = memo(function MermaidView(props: ReactNodeViewProps) {
  const { editor, node, getPos } = props
  const { t } = useI18n()
  const source = String(node.attrs.source ?? '')
  const blockId = String((node.attrs as { blockId?: string | null }).blockId ?? '').trim()
  const mode = useCodeBlockMode(blockId)
  const block = useCodeBlock(blockId)
  const session = useMermaidBlockSession(blockId)
  const {
    activeBlockId,
    registerBlock,
    updateBlockPos,
    setActiveTab,
    flushBlock,
  } = useMermaidSourceSession()

  const pos = typeof getPos === 'function' ? getPos() : null
  const isEditMode = mode === 'edit'
  const isActiveBlock = activeBlockId === blockId
  const previewDraft = block?.state.draft ?? session?.draft ?? source

  const parseResult = useMemo(
    () => parseChangedBlock(blockId, previewDraft),
    [blockId, previewDraft],
  )
  const blockType: BlockRendererType = parseResult.kind === 'mindmap' ? 'mindmap' : 'mermaid'

  const { busy, error: renderErr, hostRef, wrapRef } = useUnifiedBlockRender({
    blockId,
    blockType,
    source: previewDraft,
    enabled: Boolean(blockId),
    isEditMode,
    priority: isActiveBlock ? 'interaction' : 'visible',
  })

  const showToolbar = isMermaidDocumentEditable(editor)
  const previewPaneRef = useRef<HTMLDivElement | null>(null)
  const preferredSourceHeightRef = useRef(180)

  const surfaceAttrs = runtimeSurfaceDataAttrs({
    busy,
    error: renderErr,
    lifecycle: 'visible',
    blockType,
  })

  useLayoutEffect(() => {
    if (blockId) return
    const p = typeof getPos === 'function' ? getPos() : null
    if (p == null) return
    debugMermaid('ensure_block_id_on_mount', {
      pos: p,
      sourceLength: source.length,
    })
    ensureMermaidBlockIdAtPos(editor, p, node.attrs as { blockId?: string | null; source?: string })
  }, [blockId, editor, getPos, node.attrs, source.length])

  useEffect(() => {
    if (!blockId || pos == null) return
    debugMermaid('register_block_session', {
      blockId,
      pos,
      sourceLength: source.length,
      mode,
      activeBlockId,
    })
    registerBlock(blockId, pos, source)
  }, [activeBlockId, blockId, mode, pos, registerBlock, source])

  useLayoutEffect(() => {
    if (isEditMode) return
    const pane = previewPaneRef.current
    if (!pane) return
    const updateHeight = () => {
      preferredSourceHeightRef.current = Math.max(180, Math.round(pane.getBoundingClientRect().height))
    }
    updateHeight()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => updateHeight())
    observer.observe(pane)
    return () => observer.disconnect()
  }, [isEditMode, previewDraft, busy, renderErr, blockId])

  useEffect(() => {
    if (!blockId || pos == null) return
    updateBlockPos(blockId, pos)
  }, [blockId, pos, updateBlockPos])

  useEffect(() => {
    if (!activeBlockId || pos == null) return
    if (getBlockMode(activeBlockId) === 'edit') return
    if (activeBlockId !== blockId) return
    switchMermaidActiveBlock(editor, null, blockId)
  }, [activeBlockId, blockId, editor, pos])

  const goSource = useCallback(() => {
    preemptLowerPriorityBlockRenders('interaction')
    const p = typeof getPos === 'function' ? getPos() : null
    if (p == null) return
    preferredSourceHeightRef.current = Math.max(
      180,
      Math.round(previewPaneRef.current?.getBoundingClientRect().height ?? preferredSourceHeightRef.current),
    )
    const scrollSnapshots = snapshotScrollableAncestors(editor.view.dom as HTMLElement | null)
    const id = ensureMermaidBlockIdAtPos(
      editor,
      p,
      node.attrs as { blockId?: string | null; source?: string },
    )
    debugMermaid('go_source', {
      blockId: id,
      prevBlockId: blockId || null,
      pos: p,
      mode,
      activeBlockId,
      sourceLength: source.length,
    })
    registerBlock(id, p, source)
    cancelBlockRender(id)
    cancelAllAsyncBlockRender(id)
    setActiveTab(id, 'source')
    switchMermaidActiveBlock(editor, id, activeBlockId)
    runAfterReactCommit(() => {
      editor.commands.blur()
      restoreScrollableAncestors(scrollSnapshots)
      requestAnimationFrame(() => restoreScrollableAncestors(scrollSnapshots))
    })
  }, [activeBlockId, blockId, editor, getPos, mode, node.attrs, registerBlock, setActiveTab, source])

  const preemptSourceSwitch = useCallback(() => {
    preemptLowerPriorityBlockRenders('interaction')
  }, [])

  const goPreview = useCallback(() => {
    if (!blockId) return
    debugMermaid('go_preview', {
      blockId,
      activeBlockId,
      mode,
    })
    setActiveTab(blockId, 'preview')
    flushBlock(editor, blockId, 'tab-switch')
    if (activeBlockId === blockId) {
      switchMermaidActiveBlock(editor, null, blockId, 'tab-switch', { skipFlush: true })
    }
  }, [blockId, flushBlock, editor, activeBlockId, mode, setActiveTab])

  const fallbackCode = (
    <pre className="pm-mermaid-fallback">
      <code>{`mermaid\n${previewDraft}`}</code>
    </pre>
  )

  const typeLabel = blockType === 'mindmap' ? 'Mindmap' : 'Mermaid'

  return (
    <NodeViewWrapper
      ref={wrapRef}
      as="div"
      className={['pm-mermaid-wrap', isEditMode ? 'pm-mermaid-wrap--source-edit' : '']
        .filter(Boolean)
        .join(' ')}
      data-type="mermaid-block"
      data-mermaid-block-id={blockId}
      spellCheck={false}
      {...surfaceAttrs}
    >
      <CodeBlockShell
        blockId={blockId}
        type="mermaid"
        mode={mode}
        showToolbar={showToolbar}
        onEdit={goSource}
        onEditPointerDown={preemptSourceSwitch}
        onPreview={goPreview}
        className="pm-mermaid-cbr"
      >
        {isEditMode && blockId ? (
          <MermaidBlockSourceEditor
            key={blockId}
            blockId={blockId}
            editor={editor}
            isActive={isActiveBlock}
            preferredHeight={preferredSourceHeightRef.current}
          />
        ) : (
          <div
            ref={previewPaneRef}
            className={`pm-mermaid-preview mermaid-preview mermaid code-block-preview ${RUNTIME_SURFACE_CLASS.preview}`}
            data-mermaid-preview-pane=""
          >
            {busy ? (
              <div className={`pm-mermaid-loading ${RUNTIME_SURFACE_CLASS.loading}`}>{t('editor.mermaid.rendering')}</div>
            ) : null}
            {renderErr ? (
              <div className={`pm-mermaid-error ${RUNTIME_SURFACE_CLASS.error}`} role="alert">
                <strong>{typeLabel}</strong>：{renderErr}
                {showToolbar ? (
                  <button type="button" className="pm-mermaid-error-back" onClick={goSource}>
                    {t('editor.mermaid.editSource')}
                  </button>
                ) : null}
                {fallbackCode}
              </div>
            ) : null}
            <div
              ref={hostRef}
              className={`pm-mermaid-svg-host mermaid ${RUNTIME_SURFACE_CLASS.host}`}
              style={renderErr ? { display: 'none' } : undefined}
            />
          </div>
        )}
      </CodeBlockShell>
    </NodeViewWrapper>
  )
})
