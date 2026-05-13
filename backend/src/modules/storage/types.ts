import { Readable } from 'node:stream'

export type PutObjectInput = {
  key: string
  body: Buffer | Uint8Array | Readable
  contentType: string
  metadata?: Record<string, string>
  ifNotExists?: boolean
}

export type StoredObjectInfo = {
  key: string
  contentType: string
  bytes: number
  metadata: Record<string, string>
}

export type PresignGetOptions = {
  ttlSeconds: number
  responseContentType?: string
  responseDisposition?: string
}
