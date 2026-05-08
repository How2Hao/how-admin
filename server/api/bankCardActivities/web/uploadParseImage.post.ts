import { Buffer } from 'node:buffer'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { uploadPasteImage } from '~~/utils/ossClient'

interface Payload {
  base64?: string
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)
  const dataUrl = body?.base64?.trim()
  if (!dataUrl)
    throw createError({ statusCode: 400, statusMessage: 'base64 不能为空' })
  const m = /^data:image\/([a-z0-9+]+);base64,(.+)$/i.exec(dataUrl)
  if (!m)
    throw createError({ statusCode: 400, statusMessage: 'base64 格式不合法（需 data URL）' })
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  const buf = Buffer.from(m[2], 'base64')
  if (buf.byteLength === 0)
    throw createError({ statusCode: 400, statusMessage: '解析后内容为空' })
  if (buf.byteLength > 20 * 1024 * 1024)
    throw createError({ statusCode: 413, statusMessage: '图片过大 (>20MB)' })

  try {
    const url = await uploadPasteImage(buf, ext)
    return { url }
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `上传 OSS 失败：${e?.message ?? e}` })
  }
})
