import { Buffer } from 'node:buffer'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { runAgent } from '~~/agent'
import { uploadPasteImage } from '~~/utils/ossClient'
import { parserWebByURL } from '~~/utils/paserweb'

interface Payload {
  url?: string
  // 客户端传 data URL（"data:image/png;base64,..."）数组；server 内部转 OSS 临时 URL 用于 OCR。
  // 用户视角：前端只调一次 parse，不再有单独 upload 请求。
  imageBase64s?: string[]
  text?: string
}

const MAX_IMG_BYTES = 10 * 1024 * 1024  // 10 MB 上限（OCR 用，比模板正式入库的 5MB 宽松）

function decodeDataUrl(dataUrl: string): { buf: Buffer, ext: string } | null {
  const m = /^data:image\/(\w+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  const buf = Buffer.from(m[2], 'base64')
  if (buf.byteLength === 0 || buf.byteLength > MAX_IMG_BYTES) return null
  return { buf, ext }
}

export default defineHandler(async (event) => {
  const body = await readBody<Payload>(event)
  const url = body?.url?.trim() ?? ''
  const imageBase64s = (body?.imageBase64s ?? []).filter(Boolean)
  const text = body?.text?.trim() ?? ''

  if (!url && imageBase64s.length === 0 && !text)
    throw createError({ statusCode: 400, statusMessage: 'url / imageBase64s / text 至少要有一个' })

  const markdownChunks: string[] = []
  const allImageUrls: string[] = []

  // base64 → 临时 OSS URL（仅供 OCR 用，OCR 服务硬约束需要 HTTP URL）
  for (const dataUrl of imageBase64s) {
    const decoded = decodeDataUrl(dataUrl)
    if (!decoded) {
      console.warn('[parse] skip invalid base64 image')
      continue
    }
    try {
      const ossUrl = await uploadPasteImage(decoded.buf, decoded.ext)
      allImageUrls.push(ossUrl)
    }
    catch (e: any) {
      console.warn('[parse] uploadPasteImage failed:', e?.message ?? e)
    }
  }

  if (url) {
    try {
      const parsed = await parserWebByURL(url)
      if (parsed.markdown)
        markdownChunks.push(`## 网页正文\n\n${parsed.markdown}`)
      if (parsed.imageUrls?.length)
        allImageUrls.push(...parsed.imageUrls)
    }
    catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: `解析 URL 失败：${e?.message ?? e}` })
    }
  }

  if (text)
    markdownChunks.push(`## 用户补充文本\n\n${text}`)

  const aggregateMarkdown = markdownChunks.join('\n\n---\n\n')
  const dedupedImageUrls = Array.from(new Set(allImageUrls))

  try {
    // runAgent 仍接受 imageUrls（指 OCR 用 URL 列表）；前端的 base64 已转成临时 URL 在上面
    const result = await runAgent({ markdown: aggregateMarkdown, imageUrls: dedupedImageUrls })
    return result
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `agent 解析失败：${e?.message ?? e}` })
  }
})
