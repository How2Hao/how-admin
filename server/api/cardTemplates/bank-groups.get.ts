import { eq, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, bankCardTemplate } from '../../../drizzle/schema'

// 左侧银行分组：每家银行的信用卡总数 + 来源拆分（flyert / 51credit / self）
// 不带 is_visible 过滤 —— admin 看的是全量，不论是否对外展示
export default defineHandler(async () => {
  const rows = await db
    .select({
      bankId: bankCardTemplate.bankId,
      bankName: bank.name,
      bankLogo: bank.logo,
      bankColor: bank.themeColor,
      total: sql<number>`COUNT(*)`,
      flyertCount: sql<number>`SUM(CASE WHEN ${bankCardTemplate.dataSource} = 'flyert' THEN 1 ELSE 0 END)`,
      credit51Count: sql<number>`SUM(CASE WHEN ${bankCardTemplate.dataSource} = '51credit' THEN 1 ELSE 0 END)`,
      selfCount: sql<number>`SUM(CASE WHEN ${bankCardTemplate.dataSource} = 'self' THEN 1 ELSE 0 END)`,
    })
    .from(bankCardTemplate)
    .leftJoin(bank, sql`${bank.id} = CAST(${bankCardTemplate.bankId} AS UNSIGNED)`)
    .where(eq(bankCardTemplate.cardType, '1'))
    .groupBy(bankCardTemplate.bankId, bank.name, bank.logo, bank.themeColor)
    .orderBy(sql`COUNT(*) DESC`)

  return {
    list: rows.map(r => ({
      bankId: r.bankId,
      bankName: r.bankName ?? `(未匹配 bank.id=${r.bankId})`,
      bankLogo: r.bankLogo ?? null,
      bankColor: r.bankColor ?? null,
      total: Number(r.total ?? 0),
      sourceCounts: {
        flyert: Number(r.flyertCount ?? 0),
        '51credit': Number(r.credit51Count ?? 0),
        self: Number(r.selfCount ?? 0),
      },
    })),
  }
})
