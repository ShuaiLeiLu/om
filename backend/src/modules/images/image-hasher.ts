import { createHash } from 'node:crypto'

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

export function sha256Hex(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function extForContentType(contentType: string) {
  return EXT_BY_MIME[normalizeImageContentType(contentType)] || 'bin'
}

export function normalizeImageContentType(contentType: string) {
  const lower = contentType.toLowerCase()
  return lower === 'image/jpg' ? 'image/jpeg' : lower
}

export function objectKeyForHash(hash: string, contentType: string) {
  return `sha256/${hash.slice(0, 2)}/${hash}.${extForContentType(contentType)}`
}

export function sniffImageContentType(buffer: Buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (buffer.length >= 6) {
    const header = buffer.toString('ascii', 0, 6)
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif'
  }
  return ''
}
