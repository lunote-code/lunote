/**
 * TipTap React NodeViews call flushSync on mount. Never invoke editor.commands.setContent
 * (or other PM updates that mount NodeViews) synchronously inside React useEffect /
 * useLayoutEffect / render — schedule through runAfterReactCommit* instead.
 */

export function runAfterReactCommit(task: () => void): void {
  queueMicrotask(task)
}

export type RunAfterReactCommitWhenOptions = {
  /** Safety cap for rAF polling (default 120 ≈ 2s at 60fps). */
  maxFrames?: number
}

/**
 * Defer until `shouldDefer` is false, then run `task`.
 * Use when a ref gate (e.g. suppressMarkdownSync) must clear before syncing PM.
 */
export function runAfterReactCommitWhen(
  task: () => void,
  shouldDefer: () => boolean,
  options: RunAfterReactCommitWhenOptions = {},
): void {
  const maxFrames = options.maxFrames ?? 120
  let frames = 0

  const run = (): void => {
    if (shouldDefer()) {
      frames += 1
      if (frames >= maxFrames) return
      requestAnimationFrame(run)
      return
    }
    task()
  }

  queueMicrotask(run)
}
