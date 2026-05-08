import { Buffer } from 'node:buffer'
import sharp from 'sharp'

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

export async function downloadImage(rawUrl: string): Promise<Buffer> {
  let url: URL
  try {
    url = new URL(rawUrl)
  }
  catch {
    throw new Error(`非法 URL: ${rawUrl}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`只允许 http/https 协议，得到: ${url.protocol}`)
  }
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost'
    || host.startsWith('127.')
    || host.startsWith('10.')
    || host.startsWith('192.168.')
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error(`禁止下载内网地址: ${host}`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(rawUrl, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok)
      throw new Error(`下载失败 HTTP ${res.status}`)
    const contentLength = Number(res.headers.get('content-length') ?? '0')
    if (contentLength > MAX_DOWNLOAD_BYTES)
      throw new Error(`图片过大 (${(contentLength / 1024 / 1024).toFixed(2)} MB)`)
    const arrayBuf = await res.arrayBuffer()
    if (arrayBuf.byteLength > MAX_DOWNLOAD_BYTES)
      throw new Error(`图片过大 (${(arrayBuf.byteLength / 1024 / 1024).toFixed(2)} MB)`)
    return Buffer.from(arrayBuf)
  }
  finally {
    clearTimeout(timer)
  }
}

export interface EnhanceResult {
  buffer: Buffer
  width: number
  height: number
  sizeBytes: number
}

export async function enhanceImage(input: Buffer): Promise<EnhanceResult> {
  const meta = await sharp(input).metadata()
  if (!meta.width || !meta.height)
    throw new Error('无法读取图片尺寸')

  const targetWidth = meta.width * 2
  const targetHeight = meta.height * 2

  const out = await sharp(input)
    .resize(targetWidth, targetHeight, { kernel: sharp.kernel.lanczos3, withoutEnlargement: false })
    .median(1)
    .sharpen({ sigma: 1, m1: 0.5, m2: 2.0 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

  return {
    buffer: out,
    width: targetWidth,
    height: targetHeight,
    sizeBytes: out.byteLength,
  }
}
