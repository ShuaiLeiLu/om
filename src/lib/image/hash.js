// SHA-256 hashing for image deduplication.
// Accepts Blob | ArrayBuffer | base64 data URL string and returns lowercase hex.

export async function sha256Hex(input) {
  const buffer = await toArrayBuffer(input)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return bufferToHex(digest)
}

async function toArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input
  if (input?.buffer instanceof ArrayBuffer) return input.buffer
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return await input.arrayBuffer()
  }
  if (typeof input === 'string') {
    // base64 data URL or raw base64
    const base64 = input.includes(',') ? input.split(',')[1] : input
    const bin = atob(base64)
    const len = bin.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
    return bytes.buffer
  }
  throw new Error('Unsupported input for sha256Hex')
}

function bufferToHex(buffer) {
  const view = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, '0')
  }
  return out
}
