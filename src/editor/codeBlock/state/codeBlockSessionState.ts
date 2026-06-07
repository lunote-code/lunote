export type CodeBlockSessionMode = 'display' | 'editing'

export type CodeBlockSessionState = {
  mode: CodeBlockSessionMode
  paletteOpen: boolean
}

export type CodeBlockSessionEvent =
  | { type: 'enter-editing' }
  | { type: 'exit-editing' }
  | { type: 'open-palette' }
  | { type: 'close-palette' }
  | { type: 'force-display' }

export const INITIAL_CODE_BLOCK_SESSION_STATE: CodeBlockSessionState = {
  mode: 'display',
  paletteOpen: false,
}

export function reduceCodeBlockSessionState(
  state: CodeBlockSessionState,
  event: CodeBlockSessionEvent,
): CodeBlockSessionState {
  switch (event.type) {
    case 'enter-editing':
      if (state.mode === 'editing') return state
      return { ...state, mode: 'editing' }
    case 'exit-editing':
      if (state.mode === 'display') return state
      return { ...state, mode: 'display' }
    case 'open-palette':
      if (state.paletteOpen) return state
      return { ...state, paletteOpen: true }
    case 'close-palette':
      if (!state.paletteOpen) return state
      return { ...state, paletteOpen: false }
    case 'force-display':
      if (state.mode === 'display' && !state.paletteOpen) return state
      return INITIAL_CODE_BLOCK_SESSION_STATE
    default:
      return state
  }
}
