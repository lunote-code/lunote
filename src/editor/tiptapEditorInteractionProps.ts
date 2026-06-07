import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Editor } from '@tiptap/core'
import type { MarkType, Node as PmNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { isLunaAssetHref } from '../assets/markdownLinkTransformer'
import { resolveWikiLinkTargetAtPmPos } from './compiler/wikiInteractionMetadata'
import { bridgeCaptureEditorSelection } from './editorMutationBridge'
import type { WikiLinkTarget } from './knowledgeRuntime/types'
import { isWikiSuggestItemSelectable } from './lunaWikiLinkSuggest'
import { isMermaidSourceFocused } from './mermaid/mermaidSourceDom'
import { isOpenableExternalHref, openExternalUrlInSystemBrowser } from './openExternalLink'
import { clearTiptapSearch } from './search/editorSearchBindings'
import {
  stepExecutableSlashRowIndex,
  type SlashMenuState,
  type WikiLinkMenuState,
} from './tiptapSlashMenuModel'

function linkMarkRangeAt(
  doc: PmNode,
  pos: number,
  linkType: MarkType,
): { from: number; to: number } | null {
  const size = doc.content.size
  const p = Math.min(Math.max(pos, 1), size)
  const $pos = doc.resolve(p)
  const hasMark =
    linkType.isInSet($pos.marks()) || (p > 1 && linkType.isInSet(doc.resolve(p - 1).marks()))
  if (!hasMark) return null
  let from = p
  let to = p
  while (from > $pos.start()) {
    const prev = doc.resolve(from - 1)
    if (!linkType.isInSet(prev.marks())) break
    from -= 1
  }
  while (to < $pos.end()) {
    const next = doc.resolve(to)
    if (!linkType.isInSet(next.marks())) break
    to += 1
  }
  return { from, to }
}

type TiptapEditorInteractionPropsArgs = {
  wikiLinkMenuRef: MutableRefObject<WikiLinkMenuState | null>
  setWikiLinkMenu: Dispatch<SetStateAction<WikiLinkMenuState | null>>
  applyWikiLinkSuggestAt: (index: number) => boolean
  slashMenuRef: MutableRefObject<SlashMenuState | null>
  setSlashMenu: Dispatch<SetStateAction<SlashMenuState | null>>
  slashHoverIndexRef: MutableRefObject<number>
  setSlashHoverIndex: Dispatch<SetStateAction<number>>
  applySlashCommandAt: (index: number) => Promise<boolean>
  searchOpenRef: MutableRefObject<boolean>
  setSearchOpen: Dispatch<SetStateAction<boolean>>
  editorInstanceRef: MutableRefObject<Editor | null>
  bumpSearchVersion: () => void
  composingRef: MutableRefObject<boolean>
  emitLunaSurface: (payload: { type: 'SET_COMPOSING'; composing: boolean }) => void
  scheduleMarkdownSync: (editor: Editor, delay?: number) => void
  onAssetFilesDropRef: MutableRefObject<((files: File[]) => Promise<void>) | undefined>
  focusNoScroll: { scrollIntoView: false }
  shellRef: MutableRefObject<HTMLDivElement | null>
  pointerLinkRef: MutableRefObject<HTMLAnchorElement | null>
  getLunaAssetTooltipRef: MutableRefObject<((href: string) => string | null) | undefined>
  updateLinkModifierHint: (anchor: HTMLAnchorElement | null, mod: boolean) => void
  onWikiLinkHoverRef: MutableRefObject<
    ((target: WikiLinkTarget | null, client: { x: number; y: number }) => void) | undefined
  >
  rootDirRef: MutableRefObject<string>
  activePathRef: MutableRefObject<string>
  clearLinkModifierHint: () => void
  onWikiLinkNavigateRef: MutableRefObject<((target: WikiLinkTarget) => void) | undefined>
  onLunaAssetLinkClickRef: MutableRefObject<
    ((href: string, event: MouseEvent) => void) | undefined
  >
  reportLinkOpenFailed: (error: unknown) => void
  markUserEditIntent: () => void
}

export function createTiptapEditorInteractionProps(
  args: TiptapEditorInteractionPropsArgs,
) {
  return {
    handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
      if (args.wikiLinkMenuRef.current) {
        if (!(event.metaKey || event.ctrlKey) && event.key === 'ArrowDown') {
          event.preventDefault()
          args.setWikiLinkMenu((prev) => {
            if (!prev) return null
            return { ...prev, activeIndex: (prev.activeIndex + 1) % prev.items.length }
          })
          return true
        }
        if (!(event.metaKey || event.ctrlKey) && event.key === 'ArrowUp') {
          event.preventDefault()
          args.setWikiLinkMenu((prev) => {
            if (!prev) return null
            return {
              ...prev,
              activeIndex: (prev.activeIndex - 1 + prev.items.length) % prev.items.length,
            }
          })
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          const item = args.wikiLinkMenuRef.current.items[args.wikiLinkMenuRef.current.activeIndex]
          if (!item || !isWikiSuggestItemSelectable(item)) return true
          return args.applyWikiLinkSuggestAt(args.wikiLinkMenuRef.current.activeIndex)
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          args.setWikiLinkMenu(null)
          return true
        }
      }

      if (args.slashMenuRef.current) {
        if (!(event.metaKey || event.ctrlKey) && event.key === 'ArrowDown') {
          event.preventDefault()
          args.slashHoverIndexRef.current = -1
          args.setSlashHoverIndex(-1)
          args.setSlashMenu((prev) => {
            if (!prev) return null
            const activeIndex = stepExecutableSlashRowIndex(prev.rows, prev.activeIndex, 1)
            if (prev.activeIndex === activeIndex) return prev
            return { ...prev, activeIndex }
          })
          return true
        }
        if (!(event.metaKey || event.ctrlKey) && event.key === 'ArrowUp') {
          event.preventDefault()
          args.slashHoverIndexRef.current = -1
          args.setSlashHoverIndex(-1)
          args.setSlashMenu((prev) => {
            if (!prev) return null
            const activeIndex = stepExecutableSlashRowIndex(prev.rows, prev.activeIndex, -1)
            if (prev.activeIndex === activeIndex) return prev
            return { ...prev, activeIndex }
          })
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          const session = args.slashMenuRef.current
          const pickIndex =
            args.slashHoverIndexRef.current >= 0 && args.slashHoverIndexRef.current < session.rows.length
              ? args.slashHoverIndexRef.current
              : session.activeIndex
          const row = session.rows[pickIndex]
          if (!row?.executable || !row.run) return true
          bridgeCaptureEditorSelection()
          void args.applySlashCommandAt(pickIndex).catch((err) => {
            if (import.meta.env.DEV) console.warn('[slash-menu] apply failed', err)
          })
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          args.setSlashMenu(null)
          return true
        }
      }

      const isFind =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f'
      if (isFind) {
        event.preventDefault()
        args.setSearchOpen(true)
        return true
      }
      if (event.key === 'Escape' && args.searchOpenRef.current) {
        event.preventDefault()
        args.setSearchOpen(false)
        const activeEditor = args.editorInstanceRef.current
        if (activeEditor) clearTiptapSearch(activeEditor)
        args.bumpSearchVersion()
        return true
      }
      return isMermaidSourceFocused()
    },
    handleDOMEvents: {
      beforeinput: (_view: EditorView, event: InputEvent) => {
        const inputType = event.inputType
        if (
          inputType.startsWith('insert') ||
          inputType.startsWith('delete') ||
          inputType === 'insertReplacementText' ||
          inputType === 'insertFromPaste' ||
          inputType === 'insertFromDrop'
        ) {
          args.markUserEditIntent()
        }
        return false
      },
      compositionstart: () => {
        args.composingRef.current = true
        args.emitLunaSurface({ type: 'SET_COMPOSING', composing: true })
        return false
      },
      compositionupdate: () => {
        args.composingRef.current = true
        return false
      },
      compositionend: (view: { dom: unknown }) => {
        args.composingRef.current = false
        args.emitLunaSurface({ type: 'SET_COMPOSING', composing: false })
        const activeEditor = args.editorInstanceRef.current
        if (activeEditor && activeEditor.view === view) args.scheduleMarkdownSync(activeEditor, 0)
        return false
      },
      drop: (_view: unknown, event: DragEvent) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        const handler = args.onAssetFilesDropRef.current
        if (!files.length || !handler) return false
        args.markUserEditIntent()
        event.preventDefault()
        event.stopPropagation()
        void (async () => {
          await handler(files)
          const liveEditor = args.editorInstanceRef.current
          if (!liveEditor || liveEditor.isDestroyed) return
          args.scheduleMarkdownSync(liveEditor, 0)
        })()
        return true
      },
      mousedown: (_view: unknown, event: MouseEvent) => {
        const anchor = (event.target as HTMLElement | null)?.closest(
          'a[href]',
        ) as HTMLAnchorElement | null
        if (!anchor || !args.shellRef.current?.contains(anchor)) return false
        if (!(event.metaKey || event.ctrlKey)) return false
        const href = anchor.getAttribute('href') || ''
        if (!isOpenableExternalHref(href) && !isLunaAssetHref(href)) return false
        event.preventDefault()
        return true
      },
      mousemove: (view: Editor['view'], event: MouseEvent) => {
        const target = event.target as HTMLElement | null
        const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
        const shell = args.shellRef.current
        args.pointerLinkRef.current = anchor && shell?.contains(anchor) ? anchor : null
        const href = args.pointerLinkRef.current?.getAttribute('href') || ''
        if (args.pointerLinkRef.current && isLunaAssetHref(href)) {
          const tooltip = args.getLunaAssetTooltipRef.current?.(href)
          if (tooltip) args.pointerLinkRef.current.title = tooltip
        }
        const mod =
          event.getModifierState('Meta') ||
          event.getModifierState('Control') ||
          event.metaKey ||
          event.ctrlKey
        args.updateLinkModifierHint(args.pointerLinkRef.current, mod)
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (coords != null) {
          const hit = resolveWikiLinkTargetAtPmPos(view.state.doc, coords.pos, {
            rootDir: args.rootDirRef.current,
            activePath: args.activePathRef.current,
          })
          args.onWikiLinkHoverRef.current?.(hit?.target ?? null, {
            x: event.clientX,
            y: event.clientY,
          })
        } else {
          args.onWikiLinkHoverRef.current?.(null, { x: event.clientX, y: event.clientY })
        }
        return false
      },
      mouseleave: (_view: unknown, event: MouseEvent) => {
        args.pointerLinkRef.current = null
        args.clearLinkModifierHint()
        args.onWikiLinkHoverRef.current?.(null, { x: event.clientX, y: event.clientY })
        return false
      },
      click: (view: Editor['view'], event: MouseEvent) => {
        const mod = event.metaKey || event.ctrlKey
        const coordsEarly = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (coordsEarly != null) {
          const wikiHit = resolveWikiLinkTargetAtPmPos(view.state.doc, coordsEarly.pos, {
            rootDir: args.rootDirRef.current,
            activePath: args.activePathRef.current,
          })
          if (wikiHit && args.onWikiLinkNavigateRef.current && mod) {
            event.preventDefault()
            event.stopPropagation()
            args.onWikiLinkNavigateRef.current(wikiHit.target)
            return true
          }
        }

        const target = event.target as HTMLElement | null
        const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
        const shell = args.shellRef.current
        if (!anchor || !shell?.contains(anchor)) {
          return false
        }

        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        const linkType = view.state.schema.marks.link
        if (!coords || !linkType) {
          return false
        }
        const doc = view.state.doc
        const c = doc.content.size
        const p = Math.min(Math.max(coords.pos, 1), c)
        const $p = doc.resolve(p)
        const inLink =
          linkType.isInSet($p.marks()) || (p > 1 && linkType.isInSet(doc.resolve(p - 1).marks()))
        if (!inLink) {
          return false
        }

        const href = anchor.getAttribute('href') || ''
        event.preventDefault()

        if (isLunaAssetHref(href)) {
          if (event.metaKey || event.ctrlKey) {
            args.onLunaAssetLinkClickRef.current?.(href, event)
          }
          return true
        }

        if (mod && isOpenableExternalHref(href)) {
          void openExternalUrlInSystemBrowser(href).catch(args.reportLinkOpenFailed)
          return true
        }

        const range = linkMarkRangeAt(doc, p, linkType)
        if (range) {
          view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, range.from, range.to)))
        }
        return true
      },
    },
  }
}
