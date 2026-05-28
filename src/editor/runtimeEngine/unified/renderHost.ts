import { sanitizeMermaidSvgHtml } from '../../mermaid/mermaidSvgSanitize'

import type { BlockRenderOutput } from './blockRenderer'

/**
 * Unified render host: renderer output content is swapped by the host and is not directly coupled to the React tree.
 */
export class RenderHost {
  private element: HTMLElement | null
  private generation = 0

  constructor(element: HTMLElement | null) {
    this.element = element
  }

  attach(element: HTMLElement | null): void {
    this.element = element
  }

  getGeneration(): number {
    return this.generation
  }

  swapContent(output: BlockRenderOutput): number {
    this.generation += 1
    const gen = this.generation
    if (!this.element) return gen

    if (output.kind === 'empty' || output.kind === 'cancelled') {
      this.element.innerHTML = ''
      return gen
    }

    if (output.kind === 'error') {
      this.element.innerHTML = ''
      return gen
    }

    if (output.kind === 'html') {
      this.element.innerHTML = sanitizeMermaidSvgHtml(output.html, { trustedMermaidOutput: true })
      output.bind?.(this.element)
    }

    return gen
  }

  clear(): void {
    if (this.element) this.element.innerHTML = ''
    this.generation += 1
  }
}

const hostsByBlock = new Map<string, RenderHost>()

export function getRenderHost(blockId: string, element?: HTMLElement | null): RenderHost {
  let host = hostsByBlock.get(blockId)
  if (!host) {
    host = new RenderHost(element ?? null)
    hostsByBlock.set(blockId, host)
  } else if (element !== undefined) {
    host.attach(element)
  }
  return host
}

export function swapRenderHost(blockId: string, output: BlockRenderOutput): number {
  return getRenderHost(blockId).swapContent(output)
}

export function releaseRenderHost(blockId: string): void {
  const host = hostsByBlock.get(blockId)
  host?.clear()
  hostsByBlock.delete(blockId)
}
