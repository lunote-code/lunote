function readUInt16LE(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8)
}

function readUInt32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset]! |
    (data[offset + 1]! << 8) |
    (data[offset + 2]! << 16) |
    (data[offset + 3]! << 24)
  ) >>> 0
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

async function inflateRawDeflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is unavailable in this browser')
  }
  const ds = new DecompressionStream('deflate-raw')
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  const out = await new Response(new Blob([copy.buffer]).stream().pipeThrough(ds)).arrayBuffer()
  return new Uint8Array(out)
}

/** Minimal ZIP reader for DOCX (local headers only). */
export async function extractZipEntry(zip: Uint8Array, entryName: string): Promise<Uint8Array | null> {
  const decoder = new TextDecoder()
  let offset = 0
  while (offset + 30 <= zip.length) {
    if (zip[offset] !== 0x50 || zip[offset + 1] !== 0x4b || zip[offset + 2] !== 0x03 || zip[offset + 3] !== 0x04) {
      break
    }
    const compMethod = readUInt16LE(zip, offset + 8)
    const compSize = readUInt32LE(zip, offset + 18)
    const nameLen = readUInt16LE(zip, offset + 26)
    const extraLen = readUInt16LE(zip, offset + 28)
    const name = decoder.decode(zip.subarray(offset + 30, offset + 30 + nameLen))
    const dataStart = offset + 30 + nameLen + extraLen
    if (name === entryName) {
      const payload = zip.subarray(dataStart, dataStart + compSize)
      if (compMethod === 0) return payload
      if (compMethod === 8) return inflateRawDeflate(payload)
      throw new Error(`Unsupported ZIP compression method: ${compMethod}`)
    }
    offset = dataStart + compSize
  }
  return null
}

export type DocxAnalysis = {
  isZip: boolean
  byteLength: number
  documentXml: string
  hasHeadingText: boolean
  hasBoldMarkup: boolean
  hasTableMarkup: boolean
  hasCalloutShading: boolean
  hasCalloutLabel: boolean
}

export async function analyzeDocxBase64(base64: string): Promise<DocxAnalysis> {
  const bytes = base64ToBytes(base64)
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!isZip) {
    return {
      isZip: false,
      byteLength: bytes.length,
      documentXml: '',
      hasHeadingText: false,
      hasBoldMarkup: false,
      hasTableMarkup: false,
      hasCalloutShading: false,
      hasCalloutLabel: false,
    }
  }

  const entry = await extractZipEntry(bytes, 'word/document.xml')
  const documentXml = entry ? new TextDecoder().decode(entry) : ''
  return {
    isZip: true,
    byteLength: bytes.length,
    documentXml,
    hasHeadingText: documentXml.includes('Export Style QA'),
    hasBoldMarkup: documentXml.includes('<w:b') || documentXml.includes('<w:b/>'),
    hasTableMarkup: documentXml.includes('<w:tbl'),
    hasCalloutShading: documentXml.includes('<w:shd') && documentXml.includes('E7F5FF'),
    hasCalloutLabel: documentXml.includes('NOTE:') || documentXml.includes('NOTE'),
  }
}

export type PngAnalysis = {
  isPng: boolean
  width: number
  height: number
  byteLength: number
}

export function analyzePngBase64(base64: string): PngAnalysis {
  const bytes = base64ToBytes(base64)
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  if (!isPng || bytes.length < 24) {
    return { isPng, width: 0, height: 0, byteLength: bytes.length }
  }
  return {
    isPng: true,
    width: readUInt32LE(bytes, 16),
    height: readUInt32LE(bytes, 20),
    byteLength: bytes.length,
  }
}

function loadImageFromBase64Png(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode PNG export'))
    img.src = `data:image/png;base64,${base64}`
  })
}

/** Sample rendered PNG pixels to verify content contrast and background tone. */
export async function samplePngPixels(
  base64: string,
): Promise<{ hasVisibleContent: boolean; hasLightBackground: boolean; hasDarkBackground: boolean }> {
  const img = await loadImageFromBase64Png(base64)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D unavailable')
  }
  ctx.drawImage(img, 0, 0)
  const { width, height } = canvas
  const corners = [
    ctx.getImageData(2, 2, 1, 1).data,
    ctx.getImageData(width - 3, 2, 1, 1).data,
    ctx.getImageData(2, height - 3, 1, 1).data,
  ]
  const samples = [
    ctx.getImageData(Math.floor(width / 2), Math.floor(height / 4), 1, 1).data,
    ctx.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data,
    ctx.getImageData(Math.floor(width / 2), Math.floor((height * 2) / 3), 1, 1).data,
  ]

  const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
  const cornerLums = corners.map(([r, g, b]) => luminance(r, g, b))
  const avgCornerLum = cornerLums.reduce((a, b) => a + b, 0) / cornerLums.length
  const contentContrast = Math.max(
    ...samples.map(([r, g, b]) => Math.abs(luminance(r, g, b) - avgCornerLum)),
  )

  return {
    hasVisibleContent: contentContrast > 15,
    hasLightBackground: avgCornerLum > 200,
    hasDarkBackground: avgCornerLum < 60,
  }
}
