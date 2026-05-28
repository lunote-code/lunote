/**
 * Viewport registration and mode switching debug anchor point (selection plane).
 *
 * When switching modes **Viewport is derived from the selection**: CodeMirror uses `EditorView.scrollIntoView` and the same `dispatch` as the selection;
 * ProseMirror / TipTap uses `Transaction.scrollIntoView()` in the same transaction as `replace` / `setSelection`.
 * This module does not read or restore `scrollTop` in the mode switching path, and does not provide asynchronous viewport replay.
 */

import type { SourceModeEnterAnchor } from './viewportModeAnchor'

export const VIEWPORT_DOCUMENT_NODE_ID = 'luna:viewport:document' as const

/** The logical anchor of the last switch (for debugging); does not include scrolling amount.*/
export type ViewAnchor = {
  id: string
  mode: 'editor' | 'source'
  editor: { from: number; to: number }
}

export type EditorSurfaceRefs = {
  scrollRoot: HTMLElement
  contentRoot: HTMLElement | null
}

export type SourceSurfaceRefs = {
  scrollRoot: HTMLElement
  contentRoot: HTMLElement | null
}

export class ViewportAnchorEngine {
  readonly editorNodeMap = new Map<string, EditorSurfaceRefs>()

  readonly sourceNodeMap = new Map<string, SourceSurfaceRefs>()

  private lastAnchor: ViewAnchor | null = null

  registerEditorNode(nodeId: string, scrollRoot: HTMLElement, contentRoot: HTMLElement | null = null): void {
    this.editorNodeMap.set(nodeId, { scrollRoot, contentRoot })
  }

  unregisterEditorNode(nodeId: string): void {
    this.editorNodeMap.delete(nodeId)
  }

  registerSourceNode(nodeId: string, scrollRoot: HTMLElement, contentRoot: HTMLElement | null = null): void {
    this.sourceNodeMap.set(nodeId, { scrollRoot, contentRoot })
  }

  unregisterSourceNode(nodeId: string): void {
    this.sourceNodeMap.delete(nodeId)
  }

  getEditorSurface(nodeId: string): EditorSurfaceRefs | null {
    return this.editorNodeMap.get(nodeId) ?? null
  }

  getSourceSurface(nodeId: string): SourceSurfaceRefs | null {
    return this.sourceNodeMap.get(nodeId) ?? null
  }

  recordAnchorLeavingEditor(payload: SourceModeEnterAnchor): void {
    this.lastAnchor = {
      id: payload.bridgeId,
      mode: 'editor',
      editor: { from: payload.cmAnchor, to: payload.cmHead },
    }
  }

  recordAnchorLeavingSource(args: { bridgeId: string; cmAnchor: number; cmHead: number }): void {
    this.lastAnchor = {
      id: args.bridgeId,
      mode: 'source',
      editor: { from: args.cmAnchor, to: args.cmHead },
    }
  }

  getLastAnchor(): ViewAnchor | null {
    return this.lastAnchor
  }
}

export const viewportAnchorEngine = new ViewportAnchorEngine()
