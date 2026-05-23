import { Buffer } from 'node:buffer'
import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { uploadCardCover } from '~~/utils/ossClient'
import { bankCardTemplate } from '../../../drizzle/schema'

interface CreatePayload {
  bankId: number | string
  cardName: string
  cardType?: string
  cardOrganizationId: number
  cardLevelId?: number | null
  alias?: string | null
  tags?: string | null
  annualFeeType?: string | null
  rigidFeeAmount?: number | null
  /** 直接给一个外部 URL（不走 OSS 上传） */
  coverUrl?: string | null
  /** data URL 形式的图片（已高清化或原图）；存在时确认创建后再上传到 OSS */
  enhancedBase64?: string | null
}

const MAX_LOCAL_BYTES = 30 * 1024 * 1024

export default defineHandler(async (event) => {
  const body = await readBody<CreatePayload>(event)
  if (!body)
    throw createError({ statusCode: 400, statusMessage: '请求体为空' })

  const cardName = body.cardName?.trim()
  if (!cardName)
    throw createError({ statusCode: 400, statusMessage: '卡名不能为空' })

  if (body.bankId == null || body.bankId === '')
    throw createError({ statusCode: 400, statusMessage: 'bankId 不能为空' })
  const bankIdStr = String(body.bankId)

  if (body.cardOrganizationId == null)
    throw createError({ statusCode: 400, statusMessage: '卡组织不能为空' })

  // 解析 base64（如有）— 先校验合法再 INSERT，避免插库后才发现图片坏掉
  let coverBuf: Buffer | null = null
  if (body.enhancedBase64 && body.enhancedBase64.trim()) {
    const m = /^(?:data:[^;]+;base64,)?(.+)$/.exec(body.enhancedBase64.trim())
    if (!m)
      throw createError({ statusCode: 400, statusMessage: 'enhancedBase64 不是合法 base64' })
    try {
      coverBuf = Buffer.from(m[1], 'base64')
    }
    catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: `enhancedBase64 解码失败：${e?.message ?? e}` })
    }
    if (coverBuf.byteLength === 0)
      throw createError({ statusCode: 400, statusMessage: '图片内容为空' })
    if (coverBuf.byteLength > MAX_LOCAL_BYTES)
      throw createError({ statusCode: 413, statusMessage: `图片过大 (${(coverBuf.byteLength / 1024 / 1024).toFixed(2)} MB)` })
  }

  const now = Date.now()
  const insertValues = {
    bankId: bankIdStr,
    cardName,
    cardType: body.cardType?.trim() || '1',
    cardOrganization: String(body.cardOrganizationId),
    cardLevel: body.cardLevelId == null ? null : String(body.cardLevelId),
    cover: body.coverUrl?.trim() || null, // 若有 enhancedBase64，先留 null，上传成功再回填
    alias: body.alias?.trim() || null,
    tags: body.tags?.trim() || null,
    annualFeeType: body.annualFeeType?.trim() || null,
    rigidFeeAmount: body.rigidFeeAmount ?? null,
    isVisible: 1,
    dataSource: 'self',
    relatedCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  let newId: number
  try {
    const [res] = await db.insert(bankCardTemplate).values(insertValues as any)
    newId = (res as any)?.insertId as number
    if (!Number.isInteger(newId) || newId <= 0)
      throw new Error('insert 未返回 id')
  }
  catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `创建失败：${e?.message ?? e}` })
  }

  // 有 base64 → 确认创建后才上传 OSS，再回填 cover
  let coverUrl: string | null = insertValues.cover
  if (coverBuf) {
    try {
      coverUrl = await uploadCardCover(bankIdStr, newId, coverBuf)
      await db
        .update(bankCardTemplate)
        .set({ cover: coverUrl, updatedAt: Date.now() })
        .where(eq(bankCardTemplate.id, newId))
    }
    catch (e: any) {
      // 上传失败：删掉刚 INSERT 的脏数据，让前端可以重试整个操作
      try {
        await db.delete(bankCardTemplate).where(eq(bankCardTemplate.id, newId))
      }
      catch {}
      throw createError({ statusCode: 500, statusMessage: `上传 OSS 失败：${e?.message ?? e}` })
    }
  }

  return { id: newId, cover: coverUrl, success: true }
})
