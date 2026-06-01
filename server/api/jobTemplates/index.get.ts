import { and, desc, eq, like, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank, jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '10') || 10, 1), 50)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const numParam = (k: string) => {
    const v = url.searchParams.get(k)
    return v ? (Number(v) || null) : null
  }
  const bankIdFilter = numParam('bankId')
  const taskTemplateIdFilter = numParam('taskTemplateId')
  const bankCardTemplateIdFilter = numParam('bankCardTemplateId')

  const whereClause = and(
    keyword ? like(jobTemplate.title, `%${keyword}%`) : undefined,
    bankIdFilter ? eq(jobTemplate.bankId, bankIdFilter) : undefined,
    taskTemplateIdFilter ? eq(jobTemplate.taskTemplateId, taskTemplateIdFilter) : undefined,
    bankCardTemplateIdFilter ? eq(jobTemplate.bankCardTemplateId, bankCardTemplateIdFilter) : undefined,
  )

  const [totalResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(jobTemplate)
    .where(whereClause)

  const rows = await db
    .select({
      id: jobTemplate.id,
      title: jobTemplate.title,
      repeatType: jobTemplate.repeatType,
      startDate: jobTemplate.startDate,
      endDate: jobTemplate.endDate,
      tiers: jobTemplate.tiers,
      taskTemplateId: jobTemplate.taskTemplateId,
      bankId: jobTemplate.bankId,
      bankName: bank.name,
      bankCardTemplateId: jobTemplate.bankCardTemplateId,
      isVisible: jobTemplate.isVisible,
      updatedAt: jobTemplate.updatedAt,
    })
    .from(jobTemplate)
    .leftJoin(bank, eq(jobTemplate.bankId, bank.id))
    .where(whereClause)
    .orderBy(desc(jobTemplate.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows.map(row => ({
      ...row,
      bankName: row.bankName ?? null,
      tiers: Array.isArray(row.tiers) ? row.tiers : [],
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt.slice(0, 16) : row.updatedAt,
    })),
    total: Number(totalResult?.total ?? 0),
    page,
    pageSize,
    keyword,
  }
})
