import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { uploadCardCover } from '~~/utils/ossClient'
import { bankCardTemplate } from '../../../../drizzle/schema'

interface Payload {
  enhancedBase64?: string
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })

  const body = await readBody<Payload>(event)
  const dataUrl = body?.enhancedBase64?.trim()
  if (!dataUrl)
    throw createError({ statusCode: 400, statusMessage: 'enhancedBase64 不能为空' })

  const m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl)
  if (!m)
    throw createError({ statusCode: 400, statusMessage: 'enhancedBase64 不是合法 data URL' })
  const buf = Buffer.from(m[1], 'base64')
  if (buf.byteLength === 0)
    throw createError({ statusCode: 400, statusMessage: '解析后内容为空' })
  if (buf.byteLength > 30 * 1024 * 1024)
    throw createError({ statusCode: 413, statusMessage: '图片过大 (>30MB)' })

  const [row] = await db
    .select({ id: bankCardTemplate.id, bankId: bankCardTemplate.bankId })
    .from(bankCardTemplate)
    .where(eq(bankCardTemplate.id, id))
    .limit(1)
  if (!row)
    throw createError({ statusCode: 404, statusMessage: '模板不存在' })
  if (!row.bankId)
    throw createError({ statusCode: 422, statusMessage: '模板缺少 bankId，无法生成上传路径' })

  let url: string
  try {
    url = await uploadCardCover(row.bankId, id, buf)
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `上传 OSS 失败：${e?.message ?? e}` })
  }
  return { url, key: `card_template_cover/${row.bankId}/${id}.png` }
})
