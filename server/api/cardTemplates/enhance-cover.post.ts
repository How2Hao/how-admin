import type { Buffer } from 'node:buffer'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { downloadImage, enhanceImage } from '~~/utils/imageEnhance'

interface Payload {
  sourceUrl?: string
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)
  const sourceUrl = body?.sourceUrl?.trim()
  if (!sourceUrl)
    throw createError({ statusCode: 400, statusMessage: 'sourceUrl 不能为空' })

  let originalBuf: Buffer
  try {
    originalBuf = await downloadImage(sourceUrl)
  }
  catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: `下载原图失败：${e?.message ?? e}` })
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
