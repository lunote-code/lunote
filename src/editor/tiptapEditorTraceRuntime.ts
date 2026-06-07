import type { Editor } from '@tiptap/core'

import { revealScrollContainer } from './visualModeViewportRestore'

function isVisualTailTraceEnabled(): boolean {
  return false
}

function px(style: CSSStyleDeclaration, prop: string): number {
  const raw = style.getPropertyValue(prop)
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function describeElementForTailTrace(root: HTMLElement, el: HTMLElement | null): string {
  if (!el) return 'null'
  const style = window.getComputedStyle(el)
  const rootRect = root.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  const topInRoot = rect.top - rootRect.top + root.scrollTop
  const bottomInRoot = rect.bottom - rootRect.top + root.scrollTop
  return [
    `tag=${el.tagName.toLowerCase()}`,
    `cls=${JSON.stringify(el.className || '')}`,
    `h=${Math.round(rect.height)}`,
    `top=${Math.round(topInRoot)}`,
    `bottom=${Math.round(bottomInRoot)}`,
    `mb=${px(style, 'margin-bottom')}`,
    `mt=${px(style, 'margin-top')}`,
    `pb=${px(style, 'padding-bottom')}`,
    `pt=${px(style, 'padding-top')}`,
  ].join(' ')
}

export function scheduleVisualTailTrace(editor: Editor, reason: string, documentKey: string): void {
  if (!isVisualTailTraceEnabled()) return
  const run = () => {
    if (editor.isDestroyed) return
    const root = editor.view.dom as HTMLElement | null
    if (!root) return
    const scrollRoot = revealScrollContainer(editor)
    const topChildren = Array.from(root.children) as HTMLElement[]
    const lastTop = topChildren[topChildren.length - 1] ?? null
    const lastWrapper =
      lastTop?.querySelector?.('[data-node-view-wrapper]') instanceof HTMLElement
        ? (lastTop.querySelector('[data-node-view-wrapper]') as HTMLElement)
        : null
    const lastCodePre =
      (lastWrapper ?? lastTop)?.querySelector?.('.pm-code-block-pre') instanceof HTMLElement
        ? ((lastWrapper ?? lastTop).querySelector('.pm-code-block-pre') as HTMLElement)
        : null
    const lastCodeContent =
      (lastWrapper ?? lastTop)?.querySelector?.('.pm-code-block-content') instanceof HTMLElement
        ? ((lastWrapper ?? lastTop).querySelector('.pm-code-block-content') as HTMLElement)
        : null
    const rootStyle = window.getComputedStyle(root)
    const scrollStyle = window.getComputedStyle(scrollRoot)
    const rootRect = root.getBoundingClientRect()
    const lastBottomInRoot = lastTop
      ? lastTop.getBoundingClientRect().bottom - rootRect.top + root.scrollTop
      : 0
    const visualGapAfterLastTop = Math.round(root.scrollHeight - lastBottomInRoot)
    console.debug(
      `[VISUAL_TAIL] reason=${reason} doc=${documentKey} rootChildren=${topChildren.length} rootPadBottom=${px(rootStyle, 'padding-bottom')} rootScrollPadBottom=${px(rootStyle, 'scroll-padding-bottom')} scrollPadBottom=${px(scrollStyle, 'scroll-padding-bottom')} rootScrollHeight=${root.scrollHeight} rootClientHeight=${root.clientHeight} visualGapAfterLastTop=${visualGapAfterLastTop} lastTop{${describeElementForTailTrace(root, lastTop)}} lastWrapper{${describeElementForTailTrace(root, lastWrapper)}} lastCodePre{${describeElementForTailTrace(root, lastCodePre)}} lastCodeContent{${describeElementForTailTrace(root, lastCodeContent)}}`,
    )
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

export function scheduleVisualBlockGapTrace(editor: Editor, reason: string, documentKey: string): void {
  if (!isVisualTailTraceEnabled()) return
  const run = () => {
    if (editor.isDestroyed) return
    const root = editor.view.dom as HTMLElement | null
    if (!root) return
    const rootRect = root.getBoundingClientRect()
    const topChildren = Array.from(root.children) as HTMLElement[]
    const docChildren = Array.from({ length: editor.state.doc.childCount }, (_, i) =>
      editor.state.doc.child(i),
    )
    const count = Math.min(topChildren.length, docChildren.length)
    const rows: string[] = []
    let prevBottom = 0
    for (let i = 0; i < count; i += 1) {
      const el = topChildren[i]
      const node = docChildren[i]
      const rect = el.getBoundingClientRect()
      const top = rect.top - rootRect.top + root.scrollTop
      const bottom = rect.bottom - rootRect.top + root.scrollTop
      const gapFromPrev = i === 0 ? Math.round(top) : Math.round(top - prevBottom)
      prevBottom = bottom
      const style = window.getComputedStyle(el)
      const isEmptyParagraph =
        node.type.name === 'paragraph' &&
        (node.content.size === 0 ||
          (node.childCount === 1 && node.firstChild?.type.name === 'hardBreak'))
      if (isEmptyParagraph || gapFromPrev > 12) {
        rows.push(
          `#${i}:${node.type.name}${isEmptyParagraph ? ':empty' : ''}{gap=${gapFromPrev},h=${Math.round(rect.height)},mt=${px(style, 'margin-top')},mb=${px(style, 'margin-bottom')},cls=${JSON.stringify(el.className || '')}}`,
        )
      }
    }
    console.debug(
      `[VISUAL_BLOCK_GAPS] reason=${reason} doc=${documentKey} docChildren=${editor.state.doc.childCount} domChildren=${topChildren.length} suspicious=${rows.length} ${rows.join(' | ')}`,
    )
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}
