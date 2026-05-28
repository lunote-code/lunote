/**
 * @deprecated Please use interactionTransaction.dispatchWikiHover/dispatchKnowledgeNavigate
 */
import type { WikiLinkTarget } from '../../knowledgeRuntime/types'
import {
  asMetadataResolvedTarget,
  dispatchKnowledgeNavigate,
  dispatchWikiHover,
} from './interactionTransaction'

export const cancelWikiLinkHover = () => {
  dispatchWikiHover(null, { x: 0, y: 0 })
}

export const scheduleWikiLinkHover = (
  target: WikiLinkTarget,
  clientX: number,
  clientY: number,
  _onHoverId: (id: string | null) => void,
) => {
  dispatchWikiHover(target, { x: clientX, y: clientY })
}

export const clearWikiLinkHoverPointer = (_onHoverId: (id: string | null) => void) => {
  dispatchWikiHover(null, { x: 0, y: 0 })
}

export const onWikiLinkClick = (
  target: WikiLinkTarget,
  _navigate: (target: WikiLinkTarget) => void,
  _onHoverId: (id: string | null) => void,
) => {
  dispatchKnowledgeNavigate('wiki', asMetadataResolvedTarget(target, 'compiler'))
}
