/**
 * Visual Anchor Calibration: `coordsAtPos` gives the geometric rectangle (subject box,
 * padding, sub-pixel alignment, decorative widget influence), and there is a systematic deviation between the "user-perceived cursor vertical line";
 * Use the computed line-height / paddingTop of the content surface element for DOM-level compensation, and then combine it with the viewport 0.35 anchor point
 * (The scroll anchor uses the cursor row center `(top+bottom)/2` viewport Y after this correction).
 */
export function getVisualCorrection(el: Element): number {
  if (!(el instanceof HTMLElement) || !el.isConnected) return 0
  const style = getComputedStyle(el)
  const lh = parseFloat(style.lineHeight)
  const lhPart = Number.isFinite(lh) ? lh * 0.15 : 0
  const padTop = parseFloat(style.paddingTop || '0')
  const padPart = Number.isFinite(padTop) ? padTop : 0
  return lhPart + padPart - 2
}
