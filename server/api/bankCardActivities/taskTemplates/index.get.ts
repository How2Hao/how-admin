import { desc, eq, like, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, taskTemplate } from '../../../../drizzle/schema'
import { formatTimestamp } from '../../../utils/taskTemplate'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '10') || 10, 1), 50)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const whereClause = keyword ? like(taskTemplate.title, `%${keyword}%`) : undefined

  const [totalResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(taskTemplate)
    .where(whereClause)

  const rows = await db
    .select({
      id: taskTemplate.id,
      title: taskTemplate.title,
      bankId: taskTemplate.bankId,
      bankName: bank.name,
      bankCardType: taskTemplate.bankCardType,
      repeatType: taskTemplate.repeatType,
      startDate: taskTemplate.startDate,
      endDate: taskTemplate.endDate,
      updatedAt: taskTemplate.updatedAt,
    })
    .from(taskTemplate)
    .leftJoin(bank, eq(taskTemplate.bankId, bank.id))
    .where(whereClause)
    .orderBy(desc(taskTemplate.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows.map(row => ({
      id: row.id,
      title: row.title,
      bankId: row.bankId,
      bankName: row.bankName,
      bankCardType: row.bankCardType,
      repeatType: row.repeatType,
      startDate: formatTimestamp(row.startDate),
      endDate: formatTimestamp(row.endDate),
      updatedAt: row.updatedAt,
    })),
    total: Number(totalResult?.total ?? 0),
    page,
    pageSize,
    keyword,
  }
})
