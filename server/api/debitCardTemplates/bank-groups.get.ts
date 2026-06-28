import { eq, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, bankCard, bankCardTemplate } from '../../../../drizzle/schema'

export default defineHandler(async () => {
  const rows = await db
    .select({
      bankId: bankCardTemplate.bankId,
      bankName: bank.name,
      bankLogo: bank.logo,
      bankColor: bank.themeColor,
      total: sql<number>`COUNT(*)`,
      // 最低 ID 即默认模板
      defaultId: sql<number>`MIN(${bankCardTemplate.id})`,
      // 默认模板是否已有封面（取 MIN(id) 对应行的 cover）
      defaultCover: sql<string | null>`MAX(CASE WHEN ${bankCardTemplate.id} = (
        SELECT MIN(t2.id) FROM bank_card_template t2
        WHERE t2.bank_id = ${bankCardTemplate.bankId} AND t2.card_type = 'DEBIT'
      ) THEN ${bankCardTemplate.cover} ELSE NULL END)`,
      // 所有模板中用户关联卡总数
      totalRelated: sql<number>`SUM(${bankCardTemplate.relatedCount})`,
    })
    .from(bankCardTemplate)
    .leftJoin(bank, sql`${bank.id} = CAST(${bankCardTemplate.bankId} AS UNSIGNED)`)
    .where(eq(bankCardTemplate.cardType, 'DEBIT'))
    .groupBy(bankCardTemplate.bankId, bank.name, bank.logo, bank.themeColor)
    .orderBy(bank.name)

  return {
    list: rows.map(r => ({
      bankId: r.bankId,
      bankName: r.bankName ?? `银行 ${r.bankId}`,
      bankLogo: r.bankLogo ?? null,
      bankColor: r.bankColor ?? null,
      total: Number(r.total ?? 0),
      defaultId: Number(r.defaultId),
      hasCover: !!r.defaultCover,
      totalRelated: Number(r.totalRelated ?? 0),
    })),
  }
})
