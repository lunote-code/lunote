/**
 * CBR v6.7 — runtime truth dependency graph.
 *
 * canonical-runtime is the only true source; the other layers are derived.
 */
export type TruthLayer =
  | 'canonical-runtime'
  | 'derived-pm'
  | 'derived-ui'
  | 'derived-collab-queue'
  | 'derived-native-input-dom'

export const TRUTH_LAYER_ORDER: readonly TruthLayer[] = [
  'canonical-runtime',
  'derived-native-input-dom',
  'derived-collab-queue',
  'derived-pm',
  'derived-ui',
] as const

/** Channels that allow writing to canonical-runtime*/
export type CommitChannel =
  | 'input'
  | 'ime'
  | 'paste'
  | 'collab'
  | 'pm-derived'
  | 'undo'
  | 'redo'
  | 'cbr-ui'
  | 'layout'
  | 'viewport'

const CHANNEL_TO_LAYER: Record<CommitChannel, TruthLayer> = {
  input: 'canonical-runtime',
  ime: 'canonical-runtime',
  paste: 'canonical-runtime',
  collab: 'canonical-runtime',
  'pm-derived': 'canonical-runtime',
  undo: 'canonical-runtime',
  redo: 'canonical-runtime',
  'cbr-ui': 'canonical-runtime',
  layout: 'canonical-runtime',
  viewport: 'canonical-runtime',
}

export function channelTargetsCanonical(channel: CommitChannel): TruthLayer {
  return CHANNEL_TO_LAYER[channel]
}

export function isDerivedLayer(layer: TruthLayer): boolean {
  return layer !== 'canonical-runtime'
}
