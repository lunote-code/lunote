/**
 * Graph panel layout binding: size comes from surfaceLayoutRuntime, graph data still goes from noteGraphRuntime.
 */
import { getPanelLayoutForType } from './surfaceLayoutRuntime'
import type { OSKernelTickId } from './osKernelClock'

export function getGraphPanelLayout(kernelTick?: OSKernelTickId) {
  return getPanelLayoutForType('graph', kernelTick)
}
