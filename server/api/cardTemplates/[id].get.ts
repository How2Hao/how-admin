import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bankCardTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '模板 ID 不合法' })
  }
  const [row] = await db
    .select({
      id: bankCardTemplate.id,
      bankId: bankCardTemplate.bankId,
      cardName: bankCardTemplate.cardName,
      cardType: bankCardTemplate.cardType,
      cardLevel: bankCardTemplate.cardLevel,
      cardOrganization: bankCardTemplate.cardOrganization,
      cover: bankCardTemplate.cover,
      isVisible: bankCardTemplate.isVisible,
      alias: bankCardTemplate.alias,
      tags: bankCardTemplate.tags,
      dataSource: bankCardTemplate.dataSource,
      relatedCount: bankCardTemplate.relatedCount,
      annualFeeType: bankCardTemplate.annualFeeType,
      rigidFeeAmount: bankCardTemplate.rigidFeeAmount,
      waiverMethod: bankCardTemplate.waiverMethod,
      waiverValue: bankCardTemplate.waiverValue,
      feeMonth: bankCardTemplate.feeMonth,
      feeDay: bankCardTemplate.feeDay,
      createdAt: bankCardTemplate.createdAt,
      updatedAt: bankCardTemplate.updatedAt,
    })
    .from(bankCardTemplate)
    .where(eq(bankCardTemplate.id, id))
    .limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '模板不存在' })
  }
  return row
})
