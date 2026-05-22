import { BadGatewayException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'

export type StreamUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export type ImageGenerationResponse = {
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>
  usage?: StreamUsage
}

export function writeSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export function extractUpstreamRequestId(res: globalThis.Response) {
  for (const header of ['x-request-id', 'x-sub2api-request-id', 'openai-request-id']) {
    const value = res.headers.get(header)
    if (value) return value
  }
  return ''
}

export async function readJsonBody(res: globalThis.Response) {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function gatewayKeyForRequest(
  config: ConfigService,
  requestId: string,
  options: { image?: boolean } = {}
) {
  const configuredKeys = options.image
    ? config.get<string>('SUB2API_IMAGE_GATEWAY_API_KEYS') ||
      config.get<string>('SUB2API_IMAGE_GATEWAY_API_KEY') ||
      config.get<string>('SUB2API_GATEWAY_API_KEY') ||
      config.get<string>('SUB2API_GATEWAY_API_KEYS') ||
      ''
    : config.get<string>('SUB2API_GATEWAY_API_KEYS') || ''
  const keys = configuredKeys
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
  const fallback = options.image
    ? config.get<string>('SUB2API_IMAGE_GATEWAY_API_KEY') ||
      config.get<string>('SUB2API_GATEWAY_API_KEY')
    : config.get<string>('SUB2API_GATEWAY_API_KEY')
  if (fallback) keys.push(fallback)
  if (keys.length === 0) return ''

  // Keep selection deterministic per request so retries use the same upstream key.
  const index = [...requestId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % keys.length
  return keys[index]
}

export function upstreamErrorMessage(data: unknown, status: number) {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const error = obj.error
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message
      if (typeof message === 'string' && message) return message
    }
    const message = obj.message
    if (typeof message === 'string' && message) return message
  }
  return `sub2api_http_${status}`
}

export function chatUpstreamErrorMessage(data: unknown, status: number) {
  const detail = upstreamErrorMessage(data, status)
  if (status === 503) return '上游模型服务暂时不可用或繁忙，请稍后重试'
  if (status === 502) return '上游模型网关返回错误，请稍后重试'
  if (status === 504) return '上游模型响应超时，请稍后重试'
  if (status === 429) return '上游模型请求过多，请稍后重试'
  if (detail && !detail.startsWith('sub2api_http_')) return detail
  return `上游模型请求失败（HTTP ${status}）`
}

export function imageUpstreamException(data: unknown, status: number) {
  const message = upstreamErrorMessage(data, status)
  const normalized = message.toLowerCase()
  if (
    normalized.includes('image generation is not enabled') ||
    normalized.includes('not enabled for this group')
  ) {
    return new BadRequestException({ message: 'image_generation_not_enabled', detail: message })
  }
  return new BadGatewayException({ message: 'upstream_error', detail: message, status })
}

export function asImageGenerationResponse(data: unknown): ImageGenerationResponse {
  if (data && typeof data === 'object') return data as ImageGenerationResponse
  return {}
}
