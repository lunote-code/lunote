/** Reason for editor mounting: Cold open and ⌘/ mode switching recovery are strictly separated, and the use of payload is prohibited. Is there any implicit inference?*/

export const EditorOpenReason = {
  ColdOpen: 'cold_open',
  ModeSwitchRestore: 'mode_switch_restore',
} as const

export type EditorOpenReason = (typeof EditorOpenReason)[keyof typeof EditorOpenReason]
