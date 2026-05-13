import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable } from 'node:stream'
import { PresignGetOptions, PutObjectInput, StoredObjectInfo } from './types'

@Injectable()
export class MinioService {
  private s3?: S3Client
  private publicS3?: S3Client

  constructor(private readonly config: ConfigService) {}

  bucket() {
    return this.required('MINIO_BUCKET')
  }

  async checkBucket() {
    try {
      await this.client().send(new HeadBucketCommand({ Bucket: this.bucket() }))
      return { ok: true }
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) }
    }
  }

  async putObject(input: PutObjectInput) {
    if (input.ifNotExists) {
      const existing = await this.headObject(input.key)
      if (existing) return { etag: '', bytes: existing.bytes, skipped: true }
    }

    const result = await this.client().send(new PutObjectCommand({
      Bucket: this.bucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: input.metadata
    }))

    return {
      etag: result.ETag || '',
      bytes: Buffer.isBuffer(input.body) || input.body instanceof Uint8Array ? input.body.length : 0,
      skipped: false
    }
  }

  async headObject(key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await this.client().send(new HeadObjectCommand({ Bucket: this.bucket(), Key: key }))
      return {
        key,
        contentType: result.ContentType || 'application/octet-stream',
        bytes: Number(result.ContentLength || 0),
        metadata: result.Metadata || {}
      }
    } catch (error) {
      if (this.isNotFound(error)) return null
      throw this.wrapStorageError(error)
    }
  }

  async getObject(key: string) {
    try {
      const result = await this.client().send(new GetObjectCommand({ Bucket: this.bucket(), Key: key }))
      return {
        body: result.Body as Readable,
        contentType: result.ContentType || 'application/octet-stream',
        bytes: Number(result.ContentLength || 0)
      }
    } catch (error) {
      throw this.wrapStorageError(error)
    }
  }

  async deleteObject(key: string) {
    try {
      await this.client().send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }))
    } catch (error) {
      throw this.wrapStorageError(error)
    }
  }

  async presignGet(key: string, options: PresignGetOptions) {
    const command = new GetObjectCommand({
      Bucket: this.bucket(),
      Key: key,
      ResponseContentType: options.responseContentType,
      ResponseContentDisposition: options.responseDisposition
    })
    return getSignedUrl(this.presignClient(), command, { expiresIn: options.ttlSeconds })
  }

  async *listByPrefix(prefix: string, limit = 1000) {
    let continuationToken: string | undefined
    do {
      const page = await this.client().send(new ListObjectsV2Command({
        Bucket: this.bucket(),
        Prefix: prefix,
        MaxKeys: limit,
        ContinuationToken: continuationToken
      }))
      for (const item of page.Contents || []) {
        if (!item.Key) continue
        yield {
          key: item.Key,
          size: Number(item.Size || 0),
          lastModified: item.LastModified || new Date(0)
        }
      }
      continuationToken = page.NextContinuationToken
    } while (continuationToken)
  }

  private required(name: string) {
    const value = this.config.get<string>(name)
    if (!value) throw new ServiceUnavailableException(`${name.toLowerCase()}_missing`)
    return value
  }

  private presignClient() {
    if (this.publicS3) return this.publicS3
    this.publicS3 = this.createClient(this.config.get<string>('MINIO_PUBLIC_ENDPOINT') || this.required('MINIO_ENDPOINT'))
    return this.publicS3
  }

  private client() {
    if (this.s3) return this.s3
    this.s3 = this.createClient(this.required('MINIO_ENDPOINT'))
    return this.s3
  }

  private createClient(endpoint: string) {
    const accessKeyId = this.required('MINIO_ACCESS_KEY')
    const secretAccessKey = this.required('MINIO_SECRET_KEY')

    // Keep the S3 client hidden behind this boundary so upper layers can move
    // between MinIO, S3, OSS, or R2 by changing configuration rather than imports.
    return new S3Client({
      endpoint,
      region: this.config.get<string>('MINIO_REGION') || 'us-east-1',
      forcePathStyle: this.config.get<string>('MINIO_FORCE_PATH_STYLE') !== 'false',
      credentials: { accessKeyId, secretAccessKey }
    })
  }

  private isNotFound(error: unknown) {
    return error instanceof S3ServiceException && (error.$metadata.httpStatusCode === 404 || error.name === 'NotFound')
  }

  private wrapStorageError(error: unknown) {
    return new ServiceUnavailableException(this.errorMessage(error))
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    return 'storage_unavailable'
  }
}
