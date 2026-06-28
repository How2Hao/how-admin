import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { jobTemplate, reminderTemplate, taskTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '10') || 10, 1), 50)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const numParam = (k: string) => {
    const v = url.searchParams.get(k)
    return v ? (Number(v) || null) : null
  }
  const taskTemplateIdFilter = numParam('taskTemplateId')

  const kw = `%${keyword}%`
  const whereClause = and(
    keyword ? or(like(jobTemplate.title, kw), like(taskTemplate.title, kw)) : undefined,
    taskTemplateIdFilter ? eq(jobTemplate.taskTemplateId, taskTemplateIdFilter) : undefined,
  )

  const [totalResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(jobTemplate)
    .leftJoin(taskTemplate, eq(jobTemplate.taskTemplateId, taskTemplate.id))
    .where(whereClause)

  const rows = await db
    .select({
      id: jobTemplate.id,
      title: jobTemplate.title,
      description: jobTemplate.description,
      repeatType: jobTemplate.repeatType,
      date: jobTemplate.date,
      startDate: jobTemplate.startDate,
      endDate: jobTemplate.endDate,
      daysOfWeek: jobTemplate.daysOfWeek,
      daysOfMonth: jobTemplate.daysOfMonth,
      yearlyMonths: jobTemplate.yearlyMonths,
      yearlyDaysOfMonth: jobTemplate.yearlyDaysOfMonth,
      tiers: jobTemplate.tiers,
      taskTemplateId: jobTemplate.taskTemplateId,
      taskTemplateTitle: taskTemplate.title,
      reminderTemplateId: jobTemplate.reminderTemplateId,
      reminderTemplateTitle: reminderTemplate.title,
      reminderTemplateKind: reminderTemplate.kind,
      rewardWindowRule: jobTemplate.rewardWindowRule,
      rewardDescription: jobTemplate.rewardDescription,
      bankId: jobTemplate.bankId,
      bankCardTemplateId: jobTemplate.bankCardTemplateId,
      regionCode: jobTemplate.regionCode,
      regionMatchStrategy: jobTemplate.regionMatchStrategy,
      isVisible: jobTemplate.isVisible,
      updatedAt: jobTemplate.updatedAt,
    })
    .from(jobTemplate)
    .leftJoin(taskTemplate, eq(jobTemplate.taskTemplateId, taskTemplate.id))
    .leftJoin(reminderTemplate, eq(jobTemplate.reminderTemplateId, reminderTemplate.id))
    .where(whereClause)
    .orderBy(desc(jobTemplate.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows.map(row => ({
      ...row,
      taskTemplateTitle: row.taskTemplateTitle ?? null,
      reminderTemplateTitle: row.reminderTemplateTitle ?? null,
      reminderTemplateKind: row.reminderTemplateKind ?? null,
      regionCode: row.regionCode ?? null,
      regionMatchStrategy: row.regionMatchStrategy ?? null,
      tiers: Array.isArray(row.tiers) ? row.tiers : [],
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt.slice(0, 16) : row.updatedAt,
    })),
    total: Number(totalResult?.total ?? 0),
    page,
    pageSize,
    keyword,
  }
})
