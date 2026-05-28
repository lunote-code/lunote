import type { FrozenStructuralIR } from './modeSwitchStructuralIR'
import type { ModeSelectionSpan, SemanticAnchor } from './modeSwitchSemanticProjection'
import type { SourceModeEnterAnchor, VisualModeRestorePayload } from './viewportModeAnchor'

/** UI truth value: What you see is what you get vs source code*/
export type ModeSwitchMode = 'visual' | 'source'

/** Process phase; does not block UI rendering*/
export type SwitchPhase =
  | 'idle'
  | 'entering_source'
  | 'entering_visual'
  | 'applying_anchor'
  | 'failed'

/** Reinforcement anchor point loads (optional; absence does not prevent mode switching)*/
export type ModeSwitchAnchorPayload = {
  readonly sourceEnter?: SourceModeEnterAnchor | null
  readonly visualRestore?: VisualModeRestorePayload | null
}

/** Only semantic anchors and target selections; **not responsible** replay (the selection is written by the editor in a single transaction)*/
export type ModeFsmSemanticState = {
  readonly semanticAnchor: SemanticAnchor | null
  readonly semanticHead: SemanticAnchor | null
  readonly pmSelection: ModeSelectionSpan | null
  readonly cmSelection: ModeSelectionSpan | null
  readonly ir: FrozenStructuralIR | null
  readonly canonicalBuffer: string | null
}

export function createEmptyModeFsmSemanticState(): ModeFsmSemanticState {
  return Object.freeze({
    semanticAnchor: null,
    semanticHead: null,
    pmSelection: null,
    cmSelection: null,
    ir: null,
    canonicalBuffer: null,
  })
}

export type ModeSwitchFsmState = {
  readonly mode: ModeSwitchMode
  readonly phase: SwitchPhase
  readonly pendingAnchor: ModeSwitchAnchorPayload | null
  readonly lastError: unknown | null
  readonly semantic: ModeFsmSemanticState
}

export function createInitialModeSwitchFsmState(mode: ModeSwitchMode = 'visual'): ModeSwitchFsmState {
  return Object.freeze({
    mode,
    phase: 'idle' as const,
    pendingAnchor: null,
    lastError: null,
    semantic: createEmptyModeFsmSemanticState(),
  })
}

export function isModeSwitchTransitioning(state: ModeSwitchFsmState | SwitchPhase): boolean {
  const phase = typeof state === 'string' ? state : state.phase
  return phase !== 'idle' && phase !== 'failed'
}

export function canRetryModeSwitch(state: ModeSwitchFsmState): boolean {
  return state.phase === 'failed' || state.phase === 'idle'
}

export type ModeSwitchFsmSemanticPatch = Partial<{
  semanticAnchor: SemanticAnchor | null
  semanticHead: SemanticAnchor | null
  pmSelection: ModeSelectionSpan | null
  cmSelection: ModeSelectionSpan | null
  ir: FrozenStructuralIR | null
  canonicalBuffer: string | null
}>

function mergeSemantic(
  prev: ModeFsmSemanticState,
  patch?: ModeSwitchFsmSemanticPatch | null,
): ModeFsmSemanticState {
  if (!patch) return prev
  return Object.freeze({ ...prev, ...patch })
}

export type ModeSwitchFsmAction =
  | { type: 'ENTER_SOURCE'; semantic?: ModeSwitchFsmSemanticPatch | null }
  | { type: 'ENTER_VISUAL'; semantic?: ModeSwitchFsmSemanticPatch | null }
  | { type: 'SET_SEMANTIC'; semantic: ModeSwitchFsmSemanticPatch }
  | { type: 'APPLYING_ANCHOR' }
  | { type: 'ANCHOR_READY'; pendingAnchor: ModeSwitchAnchorPayload | null }
  | { type: 'ENHANCEMENT_FAILED'; error: unknown }
  | { type: 'RESET_ERROR' }
  | { type: 'CLEAR_MODE_SWITCH_PAYLOAD' }

export function modeSwitchFsmReducer(
  state: ModeSwitchFsmState,
  action: ModeSwitchFsmAction,
): ModeSwitchFsmState {
  switch (action.type) {
    case 'ENTER_SOURCE':
      return Object.freeze({
        ...state,
        mode: 'source',
        phase: 'entering_source',
        lastError: null,
        semantic: mergeSemantic(createEmptyModeFsmSemanticState(), action.semantic),
      })
    case 'ENTER_VISUAL':
      return Object.freeze({
        ...state,
        mode: 'visual',
        phase: 'entering_visual',
        lastError: null,
        semantic: mergeSemantic(createEmptyModeFsmSemanticState(), action.semantic),
      })
    case 'SET_SEMANTIC':
      return Object.freeze({
        ...state,
        semantic: mergeSemantic(state.semantic, action.semantic),
      })
    case 'APPLYING_ANCHOR':
      return Object.freeze({ ...state, phase: 'applying_anchor' })
    case 'ANCHOR_READY':
      return Object.freeze({
        ...state,
        phase: 'idle',
        pendingAnchor: action.pendingAnchor,
        lastError: null,
      })
    case 'ENHANCEMENT_FAILED':
      return Object.freeze({
        ...state,
        phase: 'failed',
        lastError: action.error,
      })
    case 'RESET_ERROR':
      return Object.freeze({ ...state, lastError: null, phase: 'idle' })
    case 'CLEAR_MODE_SWITCH_PAYLOAD':
      return Object.freeze({
        ...state,
        phase: 'idle',
        pendingAnchor: null,
        lastError: null,
        semantic: createEmptyModeFsmSemanticState(),
      })
    default:
      return state
  }
}
