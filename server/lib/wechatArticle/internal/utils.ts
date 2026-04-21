import type { Buffer } from 'node:buffer'

import type { DownloadTarget } from '../types'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DEFAULT_TIMEOUT_MS, MAX_PAGE_SIZE, MP_ALLOWED_HOSTS } from '../constants'
import { WechatArticleError } from '../errors'

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function createSid() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

export function writeQrCodeFile(sid: string, buffer: Buffer) {
  const path = join(tmpdir(), `wechat-article-qrcode-${sid}.png`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buffer)
  return path
}

export function bufferToDataUrl(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

export function assertPositiveInteger(name: string, value: number, fallback?: number) {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : fallback
  if (normalized === undefined || normalized < 0) {
    throw new WechatArticleError('INVALID_ARGUMENT', `${name} must be a non-negative integer`)
  }
  return normalized
}

export function assertPageSize(name: string, value: number, fallback: number) {
  const normalized = assertPositiveInteger(name, value, fallback)
  if (normalized === 0 || normalized > MAX_PAGE_SIZE) {
    throw new WechatArticleError('INVALID_ARGUMENT', `${name} must be between 1 and ${MAX_PAGE_SIZE}`)
  }
  return normalized
}

export function getTimeout(timeoutMs?: number) {
  return timeoutMs ?? DEFAULT_TIMEOUT_MS
}

export function isAllowedMpUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' && MP_ALLOWED_HOSTS.has(url.hostname)
  }
  catch {
    return false
  }
}

export function assertAllowedMpUrl(rawUrl: string) {
  if (!isAllowedMpUrl(rawUrl)) {
    throw new WechatArticleError(
      'INVALID_ARGUMENT',
      'Only https://mp.weixin.qq.com or https://weixin.qq.com article URLs are supported',
    )
  }
}

export function resolveDownloadUrl(target: DownloadTarget) {
  const url = typeof target === 'string' ? target : target.link
  assertAllowedMpUrl(url)
  return url
}

export function resolveDownloadTitle(target: DownloadTarget): string | null {
  if (typeof target === 'string') {
    return null
  }
  return target.title || null
}

export function toQueryValue(record: Record<string, string | number | undefined>) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  )
}

export function toFormValue(record: Record<string, string | number | undefined>) {
  return new URLSearchParams(toQueryValue(record))
}

export function safeJsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
