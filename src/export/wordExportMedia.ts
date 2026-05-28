export type WordImagePayload = {
  data: Uint8Array
  type: 'png' | 'jpg' | 'gif'
  width: number
  height: number
}

const MAX_IMAGE_WIDTH = 520

function parseDataUrl(dataUrl: string): WordImagePayload | null {
  const match = /^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/iu.exec(dataUrl.trim())
  if (!match) return null
  const [, fmt, b64] = match
  const binary = atob(b64)
  const data = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) data[i] = binary.charCodeAt(i)
  const type = fmt.toLowerCase() === 'jpeg' || fmt.toLowerCase() === 'jpg' ? 'jpg' : (fmt.toLowerCase() as 'png' | 'gif')
  return { data, type, width: MAX_IMAGE_WIDTH, height: Math.round(MAX_IMAGE_WIDTH * 0.6) }
}

async function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const naturalW = img.naturalWidth || 320
      const naturalH = img.naturalHeight || 180
      const width = Math.min(naturalW, MAX_IMAGE_WIDTH)
      const height = Math.max(1, Math.round((naturalH * width) / Math.max(naturalW, 1)))
      resolve({ width, height })
    }
    img.onerror = () => resolve({ width: MAX_IMAGE_WIDTH, height: Math.round(MAX_IMAGE_WIDTH * 0.6) })
    img.src = src
  })
}

export async function loadImageForWord(src: string): Promise<WordImagePayload | null> {
  const raw = src.trim()
  if (!raw) return null
  if (raw.startsWith('data:')) {
    const parsed = parseDataUrl(raw)
    if (!parsed) return null
    const size = await measureImage(raw)
    return { ...parsed, ...size }
  }
  try {
    const res = await fetch(raw)
    if (!res.ok) return null
    const blob = await res.blob()
    const data = new Uint8Array(await blob.arrayBuffer())
    const mime = blob.type.toLowerCase()
    let type: 'png' | 'jpg' | 'gif' = 'png'
    if (mime.includes('jpeg') || mime.includes('jpg')) type = 'jpg'
    else if (mime.includes('gif')) type = 'gif'
    const objectUrl = URL.createObjectURL(blob)
    try {
      const size = await measureImage(objectUrl)
      return { data, type, ...size }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

export async function svgElementToWordImage(svg: SVGSVGElement): Promise<WordImagePayload | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const serialized = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg render failed'))
      img.src = url
    })
    const viewBox = svg.viewBox?.baseVal
    const naturalW = viewBox?.width || svg.width?.baseVal?.value || img.naturalWidth || 640
    const naturalH = viewBox?.height || svg.height?.baseVal?.value || img.naturalHeight || 360
    const width = Math.min(Math.max(1, Math.round(naturalW)), MAX_IMAGE_WIDTH)
    const height = Math.max(1, Math.round((naturalH * width) / Math.max(naturalW, 1)))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/png')
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) return null
    return { ...parsed, width, height }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
