export type LunaCodeBlockAttrDelta = {
  foldedChanged: boolean
  languageChanged: boolean
  diffChanged: boolean
}

export function lunaCodeBlockAttrDelta(
  prevAttrs: { language?: string | null; folded?: boolean; diffMode?: boolean },
  nextAttrs: { language?: string | null; folded?: boolean; diffMode?: boolean },
): LunaCodeBlockAttrDelta {
  return {
    foldedChanged: Boolean(prevAttrs.folded) !== Boolean(nextAttrs.folded),
    languageChanged: prevAttrs.language !== nextAttrs.language,
    diffChanged: Boolean(prevAttrs.diffMode) !== Boolean(nextAttrs.diffMode),
  }
}

export function lunaCodeBlockAttrsNeedRerender(delta: LunaCodeBlockAttrDelta): boolean {
  return delta.foldedChanged || delta.languageChanged || delta.diffChanged
}
