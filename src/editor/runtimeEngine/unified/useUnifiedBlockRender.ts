import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
  type RefObject,
} from 'react'

import { resolveMermaidEditorColors } from '../../markdown/mermaid/mermaidThemeBridge'
import { postProcessMermaidSvg } from '../../../theme/postProcessMermaidSvg'
import { getMermaidThemeRevision, subscribeMermaidTheme } from '../../markdown/mermaid/mermaidThemeBridge'
import { cancelBlockRender, scheduleBlockRender } from '../renderScheduler'
import type { RenderPriority } from '../renderPriority'
import { cancelAllAsyncBlockRender, enqueueAsyncBlockRender } from './asyncBlockWorker'
import {
  buildBlockRenderCacheKey,
  getCachedBlockRender,
  setCachedBlockRender,
} from './blockRenderResultCache'
import {
  clearAsyncCommitGuards,
  clearBlockLayoutMeasure,
  clearViewportRuntime,
  getViewportRuntimeRevision,
  measureBlockSurface,
  observeBlockViewport,
  primeBlockViewportOnMount,
  subscribeViewportRuntime,
  bumpBlockCommitGeneration,
  openBlockCommitScope,
  revokeBlockCommitScope,
  markBarrierComplete,
  scheduleRuntimeTask,
  shouldBlockRenderInViewport,
} from '../../documentRuntime'
import { destroyBlockLifecycle, mountBlockLifecycle } from './blockLifecycle'
import type { BlockRenderOutput } from './blockRenderer'
import type { BlockRendererType } from './blockRenderer'
import { getRenderHost, releaseRenderHost } from './renderHost'
import { registerBuiltinBlockRenderers } from './registerBuiltinRenderers'
import { requireBlockRenderer } from './blockRuntimeRegistry'
import { clearRuntimeSurface, patchRuntimeSurface } from './runtimeSurface'
import { getBlockLifecycle } from '../virtualBlockViewport'
import type { BlockParseResult } from '../incrementalParser'
import { debugMermaid } from '../../mermaid/mermaidDebug'
import { mermaidRenderErrorMessage } from '../../mermaid/mermaidSourceLint'

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

  useLayoutEffect(() => {
    if (!blockId) return
    primeBlockViewportOnMount(blockId, wrapRef.current)
  }, [blockId, viewportRevision])

  useEffect(() => {
    if (!blockId) return
    let cancelled = false
    const seed = () => {
      if (cancelled) return
      primeBlockViewportOnMount(blockId, wrapRef.current)
    }
    seed()
    queueMicrotask(seed)
    requestAnimationFrame(seed)
    return () => {
      cancelled = true
    }
  }, [blockId, viewportRevision])

  const setHostRef = useCallback((node: HTMLDivElement | null) => {
    hostRef.current = node
    queueMicrotask(() => setHostReady(node != null))
  }, [])

  const commitCachedOutput = useCallback(
    (output: Extract<BlockRenderOutput, { kind: 'html' }>, renderKey: string) => {
      if (!hostRef.current?.isConnected) return
      const liveHost = getRenderHost(blockId, hostRef.current)
      liveHost.swapContent(output)
      measureBlockSurface(blockId, hostRef.current)
      if (blockType === 'mermaid' || blockType === 'mindmap') {
        postProcessMermaidSvg(hostRef.current, resolveMermaidEditorColors())
      }
      lastCommittedRenderKeyRef.current = renderKey
      setError(null)
      patchRuntimeSurface(blockId, { busy: false, error: null, blockType })
      setBusy(false)
    },
    [blockId, blockType],
  )

  useEffect(() => {
    const host = getRenderHost(blockId, hostRef.current)

    if (!enabled || !blockId || isEditMode) {
      if (blockType === 'mermaid') {
        debugMermaid('render_skipped', {
          blockId: blockId || null,
          enabled,
          isEditMode,
          reason: !enabled || !blockId ? 'missing_block_id' : 'edit_mode',
        })
      }
      setBusy(false)
      setError(null)
      if (isEditMode) {
        host.clear()
        patchRuntimeSurface(blockId, { busy: false, error: null, blockType, lifecycle: 'hidden' })
      } else {
        lastCommittedRenderKeyRef.current = ''
        host.clear()
        patchRuntimeSurface(blockId, { busy: false, error: null, blockType, lifecycle: 'hidden' })
      }
      return
    }

    if (!source.trim()) {
      if (blockType === 'mermaid') {
        debugMermaid('render_empty_source', {
          blockId,
        })
      }
      setBusy(false)
      setError(null)
      lastCommittedRenderKeyRef.current = ''
      host.clear()
      patchRuntimeSurface(blockId, { busy: false, error: null, blockType, lifecycle: 'mount' })
      return
    }

    const renderKey = `${source}\0${renderThemeRevision}\0${hostReady ? 1 : 0}`
    const cacheKey = buildBlockRenderCacheKey(blockType, source, renderThemeRevision)
    const cached = getCachedBlockRender(cacheKey)
    const hasLivePreview = Boolean(hostRef.current?.querySelector('svg'))

    if (cached?.kind === 'html') {
      if (blockType === 'mermaid') {
        debugMermaid('cache_restore', {
          blockId,
          renderKey,
          hostReady,
          hadLivePreview: hasLivePreview,
          viewportBlocked: wasViewportBlockedRef.current,
        })
      }
      const shouldRestoreCachedPreview =
        !hasLivePreview ||
        lastCommittedRenderKeyRef.current !== renderKey ||
        wasViewportBlockedRef.current
      if (shouldRestoreCachedPreview) {
        commitCachedOutput(cached, renderKey)
      }
      wasViewportBlockedRef.current = false
      return
    }

    if (!shouldBlockRenderInViewport(blockId)) {
      if (blockType === 'mermaid') {
        debugMermaid('viewport_blocked', {
          blockId,
          lifecycle: getBlockLifecycle(blockId),
          hostReady,
        })
      }
      setBusy(false)
      wasViewportBlockedRef.current = true
      return
    }
    if (
      hasLivePreview &&
      lastCommittedRenderKeyRef.current === renderKey &&
      !wasViewportBlockedRef.current
    ) {
      return
    }

    const lifecycle = getBlockLifecycle(blockId)
    const requestedPriority =
      lifecycle === 'background' && priority !== 'interaction' ? 'background' : priority
    const renderPriority =
      wasViewportBlockedRef.current && requestedPriority === 'visible' ? 'interaction' : requestedPriority
    if (blockType === 'mermaid') {
      debugMermaid('schedule_render', {
        blockId,
        lifecycle,
        requestedPriority,
        renderPriority,
        hostReady,
        sourceLength: source.length,
      })
    }
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

        let output: Awaited<ReturnType<typeof enqueueAsyncBlockRender>>
        try {
          output = await enqueueAsyncBlockRender(
            blockType,
            {
              blockId,
              source,
              generation: myGen,
              priority: renderPriority,
            },
            signal,
          )
        } catch (error) {
          if (signal.aborted || generationRef.current !== myGen) return
          const message = mermaidRenderErrorMessage(error)
          setError(message)
          host.clear()
          setBusy(false)
          patchRuntimeSurface(blockId, { busy: false, error: message, blockType })
          return
        }

        if (signal.aborted || generationRef.current !== myGen) return

        if (output.kind === 'cancelled') {
          if (blockType === 'mermaid') {
            debugMermaid('render_cancelled', {
              blockId,
              generation: myGen,
            })
          }
          setBusy(false)
          patchRuntimeSurface(blockId, { busy: false, blockType })
          return
        }

        if (output.kind === 'error') {
          if (blockType === 'mermaid') {
            debugMermaid('render_error', {
              blockId,
              generation: myGen,
              message: output.message,
            })
          }
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

        setCachedBlockRender(cacheKey, output)

        markBarrierComplete(`block:${blockId}`, 'layout')
        scheduleRuntimeTask({
          key: `render-commit:${blockId}:${myGen}`,
          kind: 'async',
          phase: 'render',
          priority: 1,
          blockId,
          generation: myGen,
          run: async () => {
            if (generationRef.current !== myGen) return
            if (!hostRef.current?.isConnected) return
            if (blockType === 'mermaid') {
              debugMermaid('render_commit', {
                blockId,
                generation: myGen,
                renderKey,
              })
            }
            commitCachedOutput(output, renderKey)
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
    commitCachedOutput,
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
