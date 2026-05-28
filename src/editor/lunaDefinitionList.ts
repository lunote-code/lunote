import { Node, mergeAttributes } from '@tiptap/core'

/** PHP Markdown Extra style definition list `<dl>`*/
export const LunaDefinitionList = Node.create({
  name: 'definitionList',
  group: 'block',
  content: '(definitionTerm | definitionDescription)+',

  parseHTML() {
    return [{ tag: 'dl' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['dl', mergeAttributes(HTMLAttributes, { class: 'pm-definition-list' }), 0]
  },
})

export const LunaDefinitionTerm = Node.create({
  name: 'definitionTerm',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'dt' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['dt', mergeAttributes(HTMLAttributes), 0]
  },
})

export const LunaDefinitionDescription = Node.create({
  name: 'definitionDescription',
  group: 'block',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'dd' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['dd', mergeAttributes(HTMLAttributes), 0]
  },
})
