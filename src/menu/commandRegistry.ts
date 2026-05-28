/**
 * @deprecated Use `commandManifest`; this module retains backward compatibility with re-export.
 */
import type { CommandManifestEntry } from './commandManifest.types'
import { COMMAND_MANIFEST, COMMAND_MANIFEST_LIST } from './commandManifest.entries'
import {
  getManifestEntry,
  getManifestEntryOrThrow,
  listManifestWithAccelerator,
  manifestToMenuLeaf,
} from './commandManifest.build'
import type { MenuLeaf } from './menu.types'

export type { CommandRuntimeKind } from './commandManifest.types'
export type CommandDefinition = CommandManifestEntry

/** @deprecated using COMMAND_MANIFEST*/
export const COMMAND_REGISTRY: Readonly<Record<string, CommandManifestEntry>> = COMMAND_MANIFEST

export const getCommand = getManifestEntry
export const getCommandOrThrow = getManifestEntryOrThrow
export const menuItemFromCommand = manifestToMenuLeaf
export const listCommandsWithAccelerator = listManifestWithAccelerator

/** @deprecated Use manifestToMenuLeaf; prohibit handwriting labelKey*/
export function menuItem(
  id: string,
  labelKey: string,
  extra?: Partial<Pick<MenuLeaf, 'action' | 'palette' | 'paletteKeywords' | 'paletteHint' | 'itemType'>>,
): MenuLeaf {
  if (COMMAND_MANIFEST[id]) {
    throw new Error(`[commandManifest] "${id}" is in manifest — use menu structure ref only, not menuItem()`)
  }
  return { kind: 'item', id, labelKey, ...extra }
}

export { COMMAND_MANIFEST_LIST }
