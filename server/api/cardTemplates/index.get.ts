import { and, desc, eq, like, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, bankCardTemplate, cardLevel, cardOrganization } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '20') || 20, 1), 500)
  const dataSource = url.searchParams.get('dataSource')?.trim() ?? ''
  const bankIdParam = url.searchParams.get('bankId')?.trim() ?? ''
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''

  // bank_card_template.bank_id 是 varchar，存的是 bank.id 的字符串形式（如 '295'）
  const conditions = [
    eq(bankCardTemplate.cardType, '1'), // 信用卡页专用 hardcode
    dataSource ? eq(bankCardTemplate.dataSource, dataSource) : undefined,
    bankIdParam ? eq(bankCardTemplate.bankId, bankIdParam) : undefined,
    keyword ? like(bankCardTemplate.cardName, `%${keyword}%`) : undefined,
  ].filter(Boolean)
  const whereClause = conditions.length ? and(...conditions as any[]) : undefined

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(bankCardTemplate)
    .where(whereClause)

  // card_organization / card_level 字段类型是 varchar 但值是 int id 字符串，JOIN 需 CAST
  const rows = await db
    .select({
      id: bankCardTemplate.id,
      bankId: bankCardTemplate.bankId,
      bankName: bank.name,
      cardName: bankCardTemplate.cardName,
      cardType: bankCardTemplate.cardType,
      cardLevel: bankCardTemplate.cardLevel,
      cardLevelName: cardLevel.name,
      cardOrganization: bankCardTemplate.cardOrganization,
      cardOrganizationName: cardOrganization.name,
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
    .leftJoin(bank, sql`${bank.id} = CAST(${bankCardTemplate.bankId} AS UNSIGNED)`)
    .leftJoin(cardOrganization, sql`${cardOrganization.id} = CAST(${bankCardTemplate.cardOrganization} AS UNSIGNED)`)
    .leftJoin(cardLevel, sql`${cardLevel.id} = CAST(${bankCardTemplate.cardLevel} AS UNSIGNED)`)
    .where(whereClause)
    // flyert 按最近更新优先（在「待处理」里编辑/审核后能立刻在「用户可见」首屏 check）；
    // 51credit 保留 id 倒序，队列稳定不让中途编辑跳序
    .orderBy(...(dataSource === 'flyert'
      ? [desc(bankCardTemplate.updatedAt), desc(bankCardTemplate.id)]
      : [desc(bankCardTemplate.id)]))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows,
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    dataSource,
    bankId: bankIdParam,
    keyword,
  }
})
