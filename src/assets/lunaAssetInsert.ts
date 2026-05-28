import type { Editor } from '@tiptap/core'
import type { AssetMeta } from './workspaceAssetStore'
import { lunaAssetFileKindFromName, lunaAssetLinkClassForKind } from './lunaAssetFileKind'
import { createAssetHtmlLink } from './markdownLinkTransformer'

export type LunaAssetLinkRange = { from: number; to: number }

/** Insert file link from slash menu: pick first so cancel keeps the `/` trigger intact. */
export async function applySlashFileLinkCommand(
  getEditor: () => Editor | null,
  range: LunaAssetLinkRange,
  pickAsset: () => Promise<AssetMeta | null>,
): Promise<boolean> {
  const asset = await pickAsset()
  if (!asset) return false

  const editor = getEditor()
  if (!editor || editor.isDestroyed) return false

  const deleted = editor
    .chain()
    .focus(undefined, { scrollIntoView: false })
    .deleteRange({ from: range.from, to: range.to })
    .run()
  if (!deleted) return false

  const live = getEditor()
  if (!live || live.isDestroyed) return false
  const pos = live.state.selection.from
  return insertLunaAssetLinkAt(live, { from: pos, to: pos }, asset)
}

/** Insert or replace with luna-asset link in editor (prefer HTML, fallback to mark JSON on failure)*/
export function insertLunaAssetLinkAt(
  editor: Editor,
  range: LunaAssetLinkRange,
  asset: AssetMeta,
): boolean {
  if (editor.isDestroyed) return false

  const html = createAssetHtmlLink(asset)
  const ok = editor
    .chain()
    .focus(undefined, { scrollIntoView: false })
    .insertContentAt({ from: range.from, to: range.to }, html)
    .run()
  if (ok) return true

  const kind = lunaAssetFileKindFromName(asset.originalName)
  return editor
    .chain()
    .focus(undefined, { scrollIntoView: false })
    .insertContentAt(
      { from: range.from, to: range.to },
      {
        type: 'text',
        text: asset.originalName,
        marks: [
          {
            type: 'link',
            attrs: {
              href: `luna-asset://${asset.id}`,
              class: `pm-link-inline ${lunaAssetLinkClassForKind(kind)}`,
              'data-luna-asset': '1',
              'data-luna-asset-ext': kind,
            },
          },
        ],
      },
    )
    .run()
}
