import type { Dispatch } from 'react'

/** Main editing surface: WYSIWYG vs source code*/
export type LunaSurfacePane = 'render' | 'source'

/**
 * Unify the phase externally (derived from pane + substate) for use by UI/debugging and subsequent behavior branches.
 * - `render`: What you see is what you get, no special chrome
 * - `source`: CodeMirror source code
 * - `focus`: the writing state under group word or text focus (still belongs to the render document tree)
 * - `table-active` / `code-active`: structured editing substate (when combined with pane, this enumeration shall prevail)
 */
export type EditorState = 'render' | 'source' | 'focus' | 'table-active' | 'code-active'

export type LunaEditorSurfaceState = {
  pane: LunaSurfacePane
  composing: boolean
  tableChrome: boolean
  codeChrome: boolean
  activeBlockType: string | null
}

export type LunaSurfaceAction =
  | { type: 'SET_PANE'; pane: LunaSurfacePane }
  | { type: 'SET_COMPOSING'; composing: boolean }
  | { type: 'SET_TABLE_CHROME'; active: boolean }
  | { type: 'SET_CODE_CHROME'; active: boolean }
  | { type: 'SET_ACTIVE_BLOCK'; nodeName: string | null }

export function createInitialLunaEditorSurface(): LunaEditorSurfaceState {
  return {
    pane: 'render',
    composing: false,
    tableChrome: false,
    codeChrome: false,
    activeBlockType: null,
  }
}

export function lunaEditorSurfaceReducer(
  state: LunaEditorSurfaceState,
  action: LunaSurfaceAction,
): LunaEditorSurfaceState {
  switch (action.type) {
    case 'SET_PANE': {
      if (action.pane === 'source') {
        return {
          ...state,
          pane: 'source',
          tableChrome: false,
          codeChrome: false,
        }
      }
      if (state.pane === 'source') {
        return { ...state, pane: 'render', tableChrome: false, codeChrome: false }
      }
      return { ...state, pane: 'render' }
    }
    case 'SET_COMPOSING':
      return { ...state, composing: action.composing }
    case 'SET_TABLE_CHROME':
      return { ...state, tableChrome: action.active }
    case 'SET_CODE_CHROME':
      return { ...state, codeChrome: action.active }
    case 'SET_ACTIVE_BLOCK':
      return { ...state, activeBlockType: action.nodeName }
    default:
      return state
  }
}

export function deriveEditorState(surface: LunaEditorSurfaceState): EditorState {
  if (surface.pane === 'source') return 'source'
  if (surface.tableChrome) return 'table-active'
  if (surface.codeChrome) return 'code-active'
  if (surface.composing) return 'focus'
  return 'render'
}

/** Non-React layers such as the ProseMirror plug-in deliver actions to FSM (the App registers dispatch when mounting)*/
let surfaceDispatch: Dispatch<LunaSurfaceAction> | null = null

export function registerLunaSurfaceDispatch(d: Dispatch<LunaSurfaceAction>): void {
  surfaceDispatch = d
}

export function unregisterLunaSurfaceDispatch(): void {
  surfaceDispatch = null
}

export function emitLunaSurface(action: LunaSurfaceAction): void {
  surfaceDispatch?.(action)
}
