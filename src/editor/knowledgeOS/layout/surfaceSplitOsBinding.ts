import { subscribeSurfaceSplitLayout } from './surfaceSplitLayoutRuntime'

let invalidate: (() => void) | null = null

export function bindSurfaceSplitOsInvalidation(fn: () => void): void {
  invalidate = fn
  subscribeSurfaceSplitLayout(() => {
    invalidate?.()
  })
}
