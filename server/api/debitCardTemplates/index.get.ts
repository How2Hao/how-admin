import { and, eq, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, bankCard, bankCardTemplate } from '../../../drizzle/schema'

// 返回某家银行的所有借记卡模板列表（带已同步封面计数）
// 不传 bankId 时返回全部（给旧客户端保持兼容）
export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const bankId = url.searchParams.get('bankId')?.trim() || null

  const conditions = [eq(bankCardTemplate.cardType, 'DEBIT')]
  if (bankId) conditions.push(eq(bankCardTemplate.bankId, bankId))

  const rows = await db
    .select({
      id: bankCardTemplate.id,
      bankId: bankCardTemplate.bankId,
      bankName: bank.name,
      bankLogo: bank.logo,
      cardName: bankCardTemplate.cardName,
      cover: bankCardTemplate.cover,
      isVisible: bankCardTemplate.isVisible,
      relatedCount: bankCardTemplate.relatedCount,
      updatedAt: bankCardTemplate.updatedAt,
      syncedCount: sql<number>`
        COUNT(CASE WHEN ${bankCard.cover} IS NOT NULL THEN 1 END)
      `,
    })
    .from(bankCardTemplate)
    .leftJoin(bank, sql`${bank.id} = CAST(${bankCardTemplate.bankId} AS UNSIGNED)`)
    .leftJoin(bankCard, eq(bankCard.templateId, bankCardTemplate.id))
    .where(and(...conditions))
    .groupBy(bankCardTemplate.id, bank.id)
    .orderBy(bankCardTemplate.id)

  // 每家银行中 id 最小的即默认模板
  const minIdPerBank: Record<string, number> = {}
  for (const r of rows) {
    if (!(r.bankId in minIdPerBank) || r.id < minIdPerBank[r.bankId])
      minIdPerBank[r.bankId] = r.id
  }

  return rows.map(r => ({
    id: r.id,
    bankId: r.bankId,
    bankName: r.bankName ?? r.bankId,
    bankLogo: r.bankLogo ?? null,
    cardName: r.cardName,
    cover: r.cover ?? null,
    isVisible: r.isVisible,
    relatedCount: r.relatedCount,
    syncedCount: Number(r.syncedCount ?? 0),
    updatedAt: r.updatedAt ?? null,
    isDefault: minIdPerBank[r.bankId] === r.id,
  }))
})
