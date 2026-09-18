const DEFAULT_PAD = 8

export type ContainerSize = { width: number; height: number }

/** Clamp a point so a box of the given size stays inside a local container. */
export function clampPointToContainer(
  x: number,
  y: number,
  width: number,
  height: number,
  container: ContainerSize,
  pad = DEFAULT_PAD,
): { x: number; y: number } {
  let nextX = x
  let nextY = y
  if (nextX + width > container.width - pad) nextX = Math.max(pad, container.width - pad - width)
  if (nextY + height > container.height - pad) nextY = Math.max(pad, container.height - pad - height)
  if (nextX < pad) nextX = pad
  if (nextY < pad) nextY = pad
  return { x: nextX, y: nextY }
}

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

/** Clamp a menu position so it stays inside a local container (e.g. editor shell). */
export function clampMenuElementWithinContainer(
  el: HTMLElement,
  preferredX: number,
  preferredY: number,
  container: ContainerSize,
  pad = DEFAULT_PAD,
): { x: number; y: number } {
  const width = el.offsetWidth || el.getBoundingClientRect().width
  const height = el.offsetHeight || el.getBoundingClientRect().height
  return clampPointToContainer(preferredX, preferredY, width, height, container, pad)
}
