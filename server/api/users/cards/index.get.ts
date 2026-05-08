import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, bankCard, region, users } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '20') || 20, 1), 100)
  const bankIdParam = url.searchParams.get('bankId')?.trim() ?? ''
  const cityCode = url.searchParams.get('cityCode')?.trim() ?? ''
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''

  // cityCode 命中：本身 OR 子区（子的 parent_code 等于 cityCode）
  // 这样 click 市级（杭州市）只命中本市；click 省级则把省下所有市的卡片都拉出来
  const cityWhere = cityCode
    ? sql`(bank_card.region_code = ${cityCode} OR EXISTS (SELECT 1 FROM region r2 WHERE r2.region_code = bank_card.region_code AND r2.parent_code = ${cityCode}))`
    : undefined

  const conditions = [
    bankIdParam ? eq(bankCard.bankId, bankIdParam) : undefined,
    cityWhere,
    keyword ? or(like(bankCard.cardName, `%${keyword}%`), like(bankCard.cardLastFour, `%${keyword}%`)) : undefined,
  ].filter(Boolean)
  const whereClause = conditions.length ? and(...conditions as any[]) : undefined

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(bankCard)
    .where(whereClause)

  const rows = await db
    .select({
      id: bankCard.id,
      userId: bankCard.userId,
      username: users.username,
      uid6: users.uid6,
      avatar: users.avatar,
      bankId: bankCard.bankId,
      bankName: bank.name,
      cardName: bankCard.cardName,
      cardLevel: bankCard.cardLevel,
      cardType: bankCard.cardType,
      cardOrganization: bankCard.cardOrganization,
      cover: bankCard.cover,
      cardLastFour: bankCard.cardLastFour,
      regionCode: bankCard.regionCode,
      regionName: region.regionName,
      createdAt: bankCard.createdAt,
    })
    .from(bankCard)
    .leftJoin(users, eq(users.id, bankCard.userId))
    .leftJoin(bank, sql`${bank.id} = CAST(${bankCard.bankId} AS UNSIGNED)`)
    .leftJoin(region, eq(region.regionCode, bankCard.regionCode))
    .where(whereClause)
    .orderBy(desc(bankCard.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows,
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    bankId: bankIdParam,
    cityCode,
    keyword,
  }
})
