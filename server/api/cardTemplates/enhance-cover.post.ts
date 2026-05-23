import { Buffer } from 'node:buffer'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { downloadImage, enhanceImage } from '~~/utils/imageEnhance'

interface Payload {
  sourceUrl?: string
  /** data URL 或纯 base64；本地上传图片走这条路（不入 OSS） */
  sourceBase64?: string
}

const MAX_LOCAL_BYTES = 20 * 1024 * 1024

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)
  const sourceUrl = body?.sourceUrl?.trim()
  const sourceBase64 = body?.sourceBase64?.trim()
  if (!sourceUrl && !sourceBase64)
    throw createError({ statusCode: 400, statusMessage: 'sourceUrl 与 sourceBase64 至少要传一个' })

  let originalBuf: Buffer
  if (sourceBase64) {
    const m = /^(?:data:[^;]+;base64,)?(.+)$/.exec(sourceBase64)
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'sourceBase64 不是合法 base64' })
    try {
      originalBuf = Buffer.from(m[1], 'base64')
    }
    catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: `base64 解码失败：${e?.message ?? e}` })
    }
    if (originalBuf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: '解码后内容为空' })
    if (originalBuf.byteLength > MAX_LOCAL_BYTES)
      throw createError({ statusCode: 413, statusMessage: `图片过大 (${(originalBuf.byteLength / 1024 / 1024).toFixed(2)} MB)` })
  }
  else {
    try {
      originalBuf = await downloadImage(sourceUrl!)
    }
    catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: `下载原图失败：${e?.message ?? e}` })
    }
  }

  let enhanced: Awaited<ReturnType<typeof enhanceImage>>
  try {
    enhanced = await enhanceImage(originalBuf)
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `高清化失败：${e?.message ?? e}` })
  }

  return {
    originalBase64: `data:image/*;base64,${originalBuf.toString('base64')}`,
    enhancedBase64: `data:image/png;base64,${enhanced.buffer.toString('base64')}`,
    originalKb: Math.round(originalBuf.byteLength / 1024),
    enhancedKb: Math.round(enhanced.sizeBytes / 1024),
    width: enhanced.width,
    height: enhanced.height,
  }
})
