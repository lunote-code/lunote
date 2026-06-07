const DEFAULT_PAD = 8

export function clampPointToViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  pad = DEFAULT_PAD,
): { x: number; y: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : width + x + pad
  const vh = typeof window !== 'undefined' ? window.innerHeight : height + y + pad
  let nextX = x
  let nextY = y
  if (nextX + width > vw - pad) nextX = Math.max(pad, vw - pad - width)
  if (nextY + height > vh - pad) nextY = Math.max(pad, vh - pad - height)
  if (nextX < pad) nextX = pad
  if (nextY < pad) nextY = pad
  return { x: nextX, y: nextY }
}

/** Clamp a fixed-position menu using its rendered box size. */
export function clampMenuElementPosition(
  el: HTMLElement,
  preferredX: number,
  preferredY: number,
  pad = DEFAULT_PAD,
): { x: number; y: number } {
  const width = el.offsetWidth || el.getBoundingClientRect().width
  const height = el.offsetHeight || el.getBoundingClientRect().height
  return clampPointToViewport(preferredX, preferredY, width, height, pad)
}
