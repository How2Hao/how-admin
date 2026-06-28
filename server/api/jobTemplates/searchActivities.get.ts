import { eq, like, or } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, taskTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const q = url.searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return { options: [] }
  }

  const kw = `%${q}%`
  const rows = await db
    .select({
      id: taskTemplate.id,
      title: taskTemplate.title,
      bankName: bank.name,
    })
    .from(taskTemplate)
    .leftJoin(bank, eq(taskTemplate.bankId, bank.id))
    .where(or(like(taskTemplate.title, kw), like(bank.name, kw)))
    .limit(10)

  return {
    options: rows.map(r => ({
      label: r.title,
      value: r.id,
      bankName: r.bankName ?? null,
    })),
  }
})
