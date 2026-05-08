import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bankCardTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })
  }

  const [existing] = await db
    .select({
      id: bankCardTemplate.id,
      cardName: bankCardTemplate.cardName,
      cardType: bankCardTemplate.cardType,
      cardLevel: bankCardTemplate.cardLevel,
      cardOrganization: bankCardTemplate.cardOrganization,
      cover: bankCardTemplate.cover,
      bankId: bankCardTemplate.bankId,
      dataSource: bankCardTemplate.dataSource,
    })
    .from(bankCardTemplate)
    .where(eq(bankCardTemplate.id, id))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '模板不存在' })
  }
  if (existing.dataSource !== '51credit') {
    throw createError({ statusCode: 409, statusMessage: '只有 51credit 状态的模板可以审核通过' })
  }

  // 审核通过前关键字段必填校验
  const required: { key: keyof typeof existing, label: string }[] = [
    { key: 'bankId', label: '所属银行' },
    { key: 'cardName', label: '卡名' },
    { key: 'cardType', label: '卡类型' },
    { key: 'cardOrganization', label: '卡组织' },
    { key: 'cardLevel', label: '卡等级' },
    { key: 'cover', label: '卡面图' },
  ]
  const missing = required.filter(({ key }) => existing[key] == null || existing[key] === '')
  if (missing.length) {
    throw createError({
      statusCode: 422,
      statusMessage: `请先补全字段：${missing.map(m => m.label).join('、')}`,
    })
  }

  await db
    .update(bankCardTemplate)
    .set({ dataSource: 'flyert', updatedAt: Date.now() })
    .where(and(eq(bankCardTemplate.id, id), eq(bankCardTemplate.dataSource, '51credit')))

  return { id, success: true }
})
