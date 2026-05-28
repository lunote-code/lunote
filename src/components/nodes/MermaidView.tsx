import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { memo, useCallback, useEffect, useMemo } from 'react'

import { CodeBlockShell } from '../codeBlock/CodeBlockShell'
import { newMermaidBlockId } from '../../editor/extensions/MermaidNode'
import { useCodeBlock, useCodeBlockMode } from '../../editor/codeBlockRuntime'
import { switchMermaidActiveBlock } from '../../editor/mermaid/mermaidSourceBlockSwitch'
import { isMermaidDocumentEditable } from '../../editor/mermaid/mermaidSourceInputFocus'
import { useMermaidBlockSession, useMermaidSourceSession } from '../../editor/mermaid/MermaidSourceSession'
import { parseChangedBlock } from '../../editor/runtimeEngine'
import {
  RUNTIME_SURFACE_CLASS,
  runtimeSurfaceDataAttrs,
  useUnifiedBlockRender,
  type BlockRendererType,
} from '../../editor/runtimeEngine/unified'
import { MermaidBlockSourceEditor } from './MermaidBlockSourceEditor'

export const MermaidView = memo(function MermaidView(props: ReactNodeViewProps) {
  const { editor, node, getPos, updateAttributes } = props
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
    removeBlock,
  } = useMermaidSourceSession()

  const pos = typeof getPos === 'function' ? getPos() : null
  const isEditMode = mode === 'edit'
  const isActiveBlock = activeBlockId === blockId
  const previewDraft = block?.state.draft ?? session?.draft ?? source

  const parseResult = useMemo(() => parseChangedBlock(blockId, previewDraft), [blockId, previewDraft])
  const blockType: BlockRendererType = parseResult.kind === 'mindmap' ? 'mindmap' : 'mermaid'

  const { busy, error: renderErr, hostRef, wrapRef } = useUnifiedBlockRender({
    blockId,
    blockType,
    source: previewDraft,
    enabled: true,
    isEditMode,
    priority: isActiveBlock ? 'interaction' : 'visible',
  })

  const showToolbar = isMermaidDocumentEditable(editor)

  const surfaceAttrs = runtimeSurfaceDataAttrs({
    busy,
    error: renderErr,
    lifecycle: 'visible',
    blockType,
  })

  useEffect(() => {
    if (blockId) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      updateAttributes({ blockId: newMermaidBlockId() })
    })
    return () => {
      cancelled = true
    }
  }, [blockId, updateAttributes])

  useEffect(() => {
    if (!blockId || pos == null) return
    registerBlock(blockId, pos, source)
  }, [blockId, pos, registerBlock, source])

  useEffect(() => {
    if (!blockId) return
    return () => {
      // Tab/document switches flush via flushEditorToMemory + flushMermaidSourceForDocumentSwitch.
      // Unmount flush here raced with setContent on another tab and corrupted the active document.
      removeBlock(blockId)
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps -- blockId lifecycle only
  }, [blockId])

  useEffect(() => {
    if (!blockId || pos == null) return
    updateBlockPos(blockId, pos)
  }, [blockId, pos, updateBlockPos])

  useEffect(() => {
    if (isEditMode || !blockId || pos == null) return
    if (activeBlockId === blockId) {
      switchMermaidActiveBlock(editor, null, blockId)
    }
  }, [isEditMode, blockId, activeBlockId, editor, pos])

  const goSource = useCallback(() => {
    let id = blockId
    if (!id) {
      id = newMermaidBlockId()
      updateAttributes({ blockId: id })
    }
    const p = typeof getPos === 'function' ? getPos() : null
    if (p != null) {
      registerBlock(id, p, source)
    }
    setActiveTab(id, 'source')
    switchMermaidActiveBlock(editor, id, activeBlockId)
  }, [activeBlockId, blockId, editor, getPos, registerBlock, setActiveTab, source, updateAttributes])

  const goPreview = useCallback(() => {
    if (!blockId) return
    setActiveTab(blockId, 'preview')
    flushBlock(editor, blockId, 'tab-switch')
    if (activeBlockId === blockId) {
      switchMermaidActiveBlock(editor, null, blockId, 'tab-switch', { skipFlush: true })
    }
  }, [blockId, flushBlock, editor, activeBlockId, setActiveTab])

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
        onPreview={goPreview}
        className="pm-mermaid-cbr"
      >
        {isEditMode && blockId && session ? (
          <MermaidBlockSourceEditor
            key={blockId}
            blockId={blockId}
            editor={editor}
            isActive={isActiveBlock}
          />
        ) : (
          <div
            className={`pm-mermaid-preview mermaid-preview mermaid code-block-preview ${RUNTIME_SURFACE_CLASS.preview}`}
            data-mermaid-preview-pane=""
          >
            {busy ? (
              <div className={`pm-mermaid-loading ${RUNTIME_SURFACE_CLASS.loading}`}>Rendering…</div>
            ) : null}
            {renderErr ? (
              <div className={`pm-mermaid-error ${RUNTIME_SURFACE_CLASS.error}`} role="alert">
                <strong>{typeLabel}</strong>：{renderErr}
                {showToolbar ? (
                  <button type="button" className="pm-mermaid-error-back" onClick={goSource}>
                    Edit source
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
