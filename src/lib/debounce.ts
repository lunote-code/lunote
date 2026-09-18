export type DebouncedFn<T extends (...args: never[]) => void> = {
  (...args: Parameters<T>): void
  cancel: () => void
}

/** Debounce calls; only the last args within `waitMs` are invoked. */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: Parameters<T> | null = null

  const debounced = (...args: Parameters<T>) => {
    pendingArgs = args
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const nextArgs = pendingArgs
      pendingArgs = null
      if (nextArgs) fn(...nextArgs)
    }, waitMs)
  }

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    pendingArgs = null
  }

  return debounced
}
