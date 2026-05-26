import { desc, eq, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, taskTemplate } from '../../../../drizzle/schema'

/** 选择活动用：返回"有活动的银行 + 活动数"，供前端按银行分组折叠展示 */
export default defineHandler(async () => {
  const rows = await db
    .select({
      bankId: taskTemplate.bankId,
      bankName: bank.name,
      count: sql<number>`count(*)`,
    })
    .from(taskTemplate)
    .leftJoin(bank, eq(taskTemplate.bankId, bank.id))
    .groupBy(taskTemplate.bankId, bank.name)
    .orderBy(desc(sql`count(*)`))
  return {
    list: rows.map(r => ({ bankId: r.bankId, bankName: r.bankName ?? null, count: Number(r.count) })),
  }
})
