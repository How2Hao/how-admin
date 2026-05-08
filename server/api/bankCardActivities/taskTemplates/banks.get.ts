import { eq, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async () => {
  const [totalResult, rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(taskTemplate),
    db
      .select({
        id: bank.id,
        name: bank.name,
        logo: bank.logo,
        count: sql<number>`count(*)`,
      })
      .from(taskTemplate)
      .innerJoin(bank, eq(taskTemplate.bankId, bank.id))
      .groupBy(bank.id, bank.name, bank.logo)
      .orderBy(bank.name),
  ])

  return {
    banks: rows.map(r => ({ ...r, count: Number(r.count) })),
    total: Number(totalResult[0]?.total ?? 0),
  }
})
