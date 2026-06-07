import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/** Align CM Lezer tags with hljsEditorTheme.css semantic Luna tokens. */
const keywordColor = 'color-mix(in srgb, var(--luna-color-danger) 82%, var(--text-primary))'
const titleColor = 'var(--link-visited)'
const linkColor = 'var(--link)'
const stringColor = 'color-mix(in srgb, var(--link) 68%, var(--text-secondary))'
const warningColor = 'var(--luna-color-warning)'
const mutedColor = 'var(--text-muted)'
const successColor = 'var(--luna-color-success)'

export const codeBlockCmHighlightStyle = HighlightStyle.define(
  [
    {
      tag: [
        tags.keyword,
        tags.modifier,
        tags.operatorKeyword,
        tags.controlKeyword,
        tags.definitionKeyword,
        tags.moduleKeyword,
        tags.self,
      ],
      color: keywordColor,
    },
    {
      tag: [
        tags.definition(tags.name),
        tags.definition(tags.variableName),
        tags.function(tags.variableName),
        tags.function(tags.propertyName),
      ],
      color: titleColor,
    },
    { tag: [tags.typeName, tags.className, tags.namespace], color: titleColor },
    {
      tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit],
      color: linkColor,
    },
    { tag: tags.variableName, color: linkColor },
    { tag: [tags.propertyName, tags.attributeName], color: linkColor },
    { tag: [tags.string, tags.special(tags.string)], color: stringColor },
    { tag: tags.regexp, color: stringColor },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: mutedColor },
    { tag: tags.meta, color: mutedColor },
    { tag: [tags.punctuation, tags.bracket, tags.paren, tags.squareBracket, tags.brace], color: linkColor },
    { tag: tags.operator, color: linkColor },
    { tag: [tags.tagName, tags.labelName], color: successColor },
    { tag: tags.contentSeparator, color: linkColor },
    { tag: tags.invalid, color: keywordColor },
    { tag: [tags.standard(tags.variableName), tags.special(tags.variableName)], color: warningColor },
    { tag: tags.heading, color: linkColor, fontWeight: '700' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
  ],
  { all: { color: 'var(--text-primary)' } },
)

export const codeBlockCmSyntaxHighlighting = syntaxHighlighting(codeBlockCmHighlightStyle, { fallback: true })
