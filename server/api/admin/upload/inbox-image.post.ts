import { Buffer } from 'node:buffer'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { uploadInboxImage } from '~~/utils/ossClient'

interface Payload {
  /** data URL 或纯 base64 */
  imageBase64?: string
}

const MAX_BYTES = 5 * 1024 * 1024

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)
  const raw = body?.imageBase64?.trim()
  if (!raw) throw createError({ statusCode: 400, statusMessage: 'imageBase64 不能为空' })

  const m = /^(?:data:image\/([a-zA-Z0-9]+);base64,)?(.+)$/.exec(raw)
  if (!m) throw createError({ statusCode: 400, statusMessage: '图片格式不合法' })
  const ext = (m[1] ?? 'png').toLowerCase()
  const buf = Buffer.from(m[2], 'base64')
  if (buf.byteLength === 0) throw createError({ statusCode: 400, statusMessage: '图片内容为空' })
  if (buf.byteLength > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: `图片过大 (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB)` })

  try {
    const url = await uploadInboxImage(buf, ext)
    return { url, sizeKb: Math.round(buf.byteLength / 1024) }
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `上传失败：${e?.message ?? e}` })
  }
})
