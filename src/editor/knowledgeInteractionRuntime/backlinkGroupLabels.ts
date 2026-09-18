import { resolveEditorUiMessage } from '../resolveEditorUiMessage'

/** Localized backlink surface group heading (runtime layer, no React). */
export function resolveBacklinkGroupLabel(groupId: string): string {
  switch (groupId) {
    case 'direct':
      return resolveEditorUiMessage('knowledge.backlinks.group.direct')
    case 'embed':
      return resolveEditorUiMessage('knowledge.embeds.title')
    case 'mention':
      return resolveEditorUiMessage('knowledge.backlinks.group.mentions')
    case 'virtual':
      return resolveEditorUiMessage('knowledge.backlinks.title')
    default:
      return groupId
  }
}
