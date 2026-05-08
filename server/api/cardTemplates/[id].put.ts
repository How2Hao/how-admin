import { eq } from 'drizzle-orm'
import { createError, readBody } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bankCardTemplate } from '../../../drizzle/schema'

interface UpdatePayload {
  bankId?: string | number
  cardName?: string
  cardType?: string
  // 前端传 int id（来自 options 下拉），后端转字符串存入 varchar
  cardLevelId?: number | null
  cardOrganizationId?: number | null
  cover?: string | null
  alias?: string | null
  tags?: string | null
  annualFeeType?: string | null
  rigidFeeAmount?: number | null
  waiverMethod?: string | null
  waiverValue?: number | null
  feeMonth?: number | null
  feeDay?: number | null
}

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })
  }
  const body = await readBody<UpdatePayload>(event)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: '请求体为空' })
  }

  const update: Record<string, unknown> = {
    updatedAt: Date.now(),
  }

  // 直接透传的字段（白名单）
  const passthrough: (keyof UpdatePayload)[] = ['cardName', 'cardType', 'cover', 'alias', 'tags', 'annualFeeType', 'rigidFeeAmount', 'waiverMethod', 'waiverValue', 'feeMonth', 'feeDay']
  for (const key of passthrough) {
    if (key in body) update[key] = body[key]
  }

  // bankId: 前端传 int 或 string，DB 存 varchar
  if ('bankId' in body && body.bankId != null && body.bankId !== '') {
    update.bankId = String(body.bankId)
  }
  // cardOrganizationId / cardLevelId: 前端传 int，DB 存 varchar
  if ('cardOrganizationId' in body) {
    update.cardOrganization = body.cardOrganizationId == null ? null : String(body.cardOrganizationId)
  }
  if ('cardLevelId' in body) {
    update.cardLevel = body.cardLevelId == null ? null : String(body.cardLevelId)
  }

  // card_organization 是 NOT NULL，禁止更新成 null
  if (update.cardOrganization === null) {
    throw createError({ statusCode: 400, statusMessage: '卡组织不可为空' })
  }

  await db.update(bankCardTemplate).set(update).where(eq(bankCardTemplate.id, id))
  return { id, success: true }
})
