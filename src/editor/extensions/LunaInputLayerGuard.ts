import { Extension } from '@tiptap/core'

import { createInputLayerPasteGuardPlugin } from '../inputLayer/inputLayerPasteGuard'

/** De-intelligence the input layer: paste plain text + disable paste→codeBlock at runtime*/
export const LunaInputLayerGuard = Extension.create({
  name: 'lunaInputLayerGuard',
  priority: 1000,

  addProseMirrorPlugins() {
    return [createInputLayerPasteGuardPlugin()]
  },
})
