import { desc, eq, inArray, like, or } from 'drizzle-orm'
import { getQuery } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, taskTemplate } from '../../../../drizzle/schema'

export default defineHandler(async (event) => {
  const q = getQuery(event)
  const keyword = String(q.keyword ?? '').trim()
  const idsRaw = String(q.ids ?? '').trim()
  const limit = Math.min(50, Math.max(1, Number(q.limit ?? 20)))

  const ids = idsRaw ? idsRaw.split(',').map(s => Number(s)).filter(n => Number.isFinite(n) && n > 0) : []

  if (ids.length > 0) {
    const rows = await db
      .select({ id: taskTemplate.id, title: taskTemplate.title, bankName: bank.name })
      .from(taskTemplate)
      .leftJoin(bank, eq(taskTemplate.bankId, bank.id))
      .where(inArray(taskTemplate.id, ids))
    return { list: rows }
  }

  if (!keyword) {
    const rows = await db
      .select({ id: taskTemplate.id, title: taskTemplate.title, bankName: bank.name })
      .from(taskTemplate)
      .leftJoin(bank, eq(taskTemplate.bankId, bank.id))
      .orderBy(desc(taskTemplate.id))
      .limit(limit)
    return { list: rows }
  }

  const kw = `%${keyword}%`
  const rows = await db
    .select({ id: taskTemplate.id, title: taskTemplate.title, bankName: bank.name })
    .from(taskTemplate)
    .leftJoin(bank, eq(taskTemplate.bankId, bank.id))
    .where(or(like(taskTemplate.title, kw), like(bank.name, kw)))
    .orderBy(desc(taskTemplate.id))
    .limit(limit)
  return { list: rows }
})
