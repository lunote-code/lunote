import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
  type RefObject,
} from 'react'

import { postProcessMermaidSvg } from '../../../theme/postProcessMermaidSvg'
import { getMermaidThemeRevision, subscribeMermaidTheme } from '../../markdown/mermaid/mermaidThemeBridge'
import { cancelBlockRender, scheduleBlockRender } from '../renderScheduler'
import type { RenderPriority } from '../renderPriority'
import { cancelAllAsyncBlockRender, enqueueAsyncBlockRender } from './asyncBlockWorker'
import {
  clearAsyncCommitGuards,
  clearBlockLayoutMeasure,
  clearViewportRuntime,
  getViewportRuntimeRevision,
  measureBlockSurface,
  observeBlockViewport,
  seedBlockViewportIfVisible,
  subscribeViewportRuntime,
  bumpBlockCommitGeneration,
  openBlockCommitScope,
  revokeBlockCommitScope,
  markBarrierComplete,
  scheduleRuntimeTask,
  shouldBlockRenderInViewport,
} from '../../documentRuntime'
import { destroyBlockLifecycle, mountBlockLifecycle } from './blockLifecycle'
import type { BlockRendererType } from './blockRenderer'
import { getRenderHost, releaseRenderHost } from './renderHost'
import { registerBuiltinBlockRenderers } from './registerBuiltinRenderers'
import { requireBlockRenderer } from './blockRuntimeRegistry'
import { clearRuntimeSurface, patchRuntimeSurface } from './runtimeSurface'
import type { BlockParseResult } from '../incrementalParser'

registerBuiltinBlockRenderers()

export type UseUnifiedBlockRenderOptions = {
  blockId: string
  blockType: BlockRendererType
  source: string
  enabled: boolean
  isEditMode: boolean
  priority?: RenderPriority
}

export type UseUnifiedBlockRenderResult = {
  busy: boolean
  error: string | null
  hostRef: Ref<HTMLDivElement | null>
  wrapRef: RefObject<HTMLDivElement | null>
  parseResult: BlockParseResult
  lifecycle: string
}

export function useUnifiedBlockRender(options: UseUnifiedBlockRenderOptions): UseUnifiedBlockRenderResult {
  const { blockId, blockType, source, enabled, isEditMode, priority = 'visible' } = options
  const mermaidThemeRevision = useSyncExternalStore(
    subscribeMermaidTheme,
    getMermaidThemeRevision,
    () => 0,
  )
  const viewportRevision = useSyncExternalStore(
    subscribeViewportRuntime,
    getViewportRuntimeRevision,
    () => 0,
  )
  const renderThemeRevision = blockType === 'mermaid' || blockType === 'mindmap' ? mermaidThemeRevision : 0
  const hostRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hostReady, setHostReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generationRef = useRef(0)
  const wasViewportBlockedRef = useRef(false)
  const lastCommittedRenderKeyRef = useRef('')

  const renderer = requireBlockRenderer(blockType)
  const parseResult = renderer.parse(blockId, source)

  useEffect(() => {
    if (!blockId) return
    mountBlockLifecycle(blockId)
    openBlockCommitScope(blockId, 0)
    return () => {
      cancelBlockRender(blockId)
      cancelAllAsyncBlockRender(blockId)
      revokeBlockCommitScope(blockId)
      clearAsyncCommitGuards(blockId)
      destroyBlockLifecycle(blockId)
      releaseRenderHost(blockId)
      clearRuntimeSurface(blockId)
      clearViewportRuntime(blockId)
      clearBlockLayoutMeasure(blockId)
    }
  }, [blockId])

  useEffect(() => {
    const root = wrapRef.current
    if (!root || !blockId) return
    return observeBlockViewport(blockId, root)
  }, [blockId])

  useEffect(() => {
    if (!blockId) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      seedBlockViewportIfVisible(blockId, wrapRef.current)
    })
    return () => {
      cancelled = true
    }
  }, [blockId, viewportRevision])

  const setHostRef = useCallback((node: HTMLDivElement | null) => {
    hostRef.current = node
    queueMicrotask(() => setHostReady(node != null))
  }, [])

  useEffect(() => {
    const host = getRenderHost(blockId, hostRef.current)

    if (!enabled || !blockId || isEditMode) {
      setBusy(false)
      setError(null)
      lastCommittedRenderKeyRef.current = ''
      host.clear()
      patchRuntimeSurface(blockId, { busy: false, error: null, blockType, lifecycle: 'hidden' })
      return
    }

    if (!source.trim()) {
      setBusy(false)
      setError(null)
      lastCommittedRenderKeyRef.current = ''
      host.clear()
      patchRuntimeSurface(blockId, { busy: false, error: null, blockType, lifecycle: 'mount' })
      return
    }

    if (!shouldBlockRenderInViewport(blockId)) {
      setBusy(false)
      // Remember that this block was skipped by viewport gating; when it becomes visible again,
      // we boost one render to interaction priority to avoid delayed preview after tab switches.
      wasViewportBlockedRef.current = true
      return
    }

    const renderKey = `${source}\0${renderThemeRevision}\0${hostReady ? 1 : 0}`
    const hasLivePreview = Boolean(hostRef.current?.querySelector('svg'))
    if (
      hasLivePreview &&
      lastCommittedRenderKeyRef.current === renderKey &&
      !wasViewportBlockedRef.current
    ) {
      return
    }

    const renderPriority =
      wasViewportBlockedRef.current && priority === 'visible' ? 'interaction' : priority
    wasViewportBlockedRef.current = false
    const myGen = bumpBlockCommitGeneration(blockId)
    generationRef.current = myGen

    scheduleBlockRender(
      blockId,
      renderPriority,
      async (signal) => {
        if (signal.aborted || generationRef.current !== myGen) return

        setBusy(true)
        setError(null)
        patchRuntimeSurface(blockId, { busy: true, error: null, blockType, lifecycle: 'visible' })

        const output = await enqueueAsyncBlockRender(
          blockType,
          {
            blockId,
            source,
            generation: myGen,
            priority: renderPriority,
          },
          signal,
        )

        if (signal.aborted || generationRef.current !== myGen) return

        if (output.kind === 'cancelled') {
          setBusy(false)
          patchRuntimeSurface(blockId, { busy: false, blockType })
          return
        }

        if (output.kind === 'error') {
          setError(output.message)
          host.clear()
          setBusy(false)
          patchRuntimeSurface(blockId, { busy: false, error: output.message, blockType })
          return
        }

        if (output.kind === 'empty') {
          host.clear()
          setError(null)
          setBusy(false)
          patchRuntimeSurface(blockId, { busy: false, error: null, blockType })
          return
        }

        markBarrierComplete(`block:${blockId}`, 'layout')
        scheduleRuntimeTask({
          key: `render-commit:${blockId}:${myGen}`,
          kind: 'async',
          phase: 'render',
          priority: 1,
          blockId,
          generation: myGen,
          run: async () => {
            const liveHost = getRenderHost(blockId, hostRef.current)
            liveHost.swapContent(output)
            measureBlockSurface(blockId, hostRef.current)
            if (blockType === 'mermaid' || blockType === 'mindmap') {
              postProcessMermaidSvg(hostRef.current)
            }
            lastCommittedRenderKeyRef.current = renderKey
            setError(null)
            patchRuntimeSurface(blockId, { busy: false, error: null, blockType })
            setBusy(false)
          },
        })
      },
      `unified:${blockType}`,
    )
  }, [
    blockId,
    blockType,
    source,
    enabled,
    isEditMode,
    priority,
    renderThemeRevision,
    viewportRevision,
    hostReady,
  ])

  return {
    busy,
    error,
    hostRef: setHostRef,
    wrapRef,
    parseResult,
    lifecycle: 'managed',
  }
}
