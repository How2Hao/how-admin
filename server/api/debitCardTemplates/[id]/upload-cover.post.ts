import { Buffer } from 'node:buffer'
import { and, eq, isNull } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { downloadImage } from '~~/utils/imageEnhance'
import { uploadCardCover } from '~~/utils/ossClient'
import { bankCard, bankCardTemplate } from '../../../../drizzle/schema'

interface Payload {
  enhancedBase64?: string
  sourceUrl?: string
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })

  const body = await readBody<Payload>(event)
  const dataUrl = body?.enhancedBase64?.trim()
  const sourceUrl = body?.sourceUrl?.trim()
  if (!dataUrl && !sourceUrl)
    throw createError({ statusCode: 400, statusMessage: 'enhancedBase64 与 sourceUrl 至少要传一个' })

  const [row] = await db
    .select({ id: bankCardTemplate.id, bankId: bankCardTemplate.bankId, cardType: bankCardTemplate.cardType })
    .from(bankCardTemplate)
    .where(eq(bankCardTemplate.id, id))
    .limit(1)
  if (!row)
    throw createError({ statusCode: 404, statusMessage: '模板不存在' })
  if (row.cardType !== 'DEBIT')
    throw createError({ statusCode: 422, statusMessage: '该接口仅用于借记卡模板' })
  if (!row.bankId)
    throw createError({ statusCode: 422, statusMessage: '模板缺少 bankId，无法生成上传路径' })

  let buf: Buffer
  if (sourceUrl) {
    try {
      buf = await downloadImage(sourceUrl)
    }
    catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: `下载原图失败：${e?.message ?? e}` })
    }
  }
  else {
    const m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl!)
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'enhancedBase64 不是合法 data URL' })
    buf = Buffer.from(m[1], 'base64')
    if (buf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: '解析后内容为空' })
  }
  if (buf.byteLength > 30 * 1024 * 1024)
    throw createError({ statusCode: 413, statusMessage: '图片过大 (>30MB)' })

  let url: string
  try {
    url = await uploadCardCover(row.bankId, id, buf)
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `上传 OSS 失败：${e?.message ?? e}` })
  }

  const now = Date.now()

  // 更新模板封面
  await db
    .update(bankCardTemplate)
    .set({ cover: url, updatedAt: now })
    .where(eq(bankCardTemplate.id, id))

  // 同步到所有 cover 为 NULL 的关联用户卡
  const syncResult = await db
    .update(bankCard)
    .set({ cover: url, updatedAt: now })
    .where(and(eq(bankCard.templateId, id), isNull(bankCard.cover)))

  return { url, syncedCount: syncResult[0].affectedRows ?? 0 }
})
