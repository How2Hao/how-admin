import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { REMINDER_TEMPLATE_KINDS } from '~~/utils/reminderTemplate'
import { reminderTemplate, taskTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '10') || 10, 1), 50)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const rawKind = url.searchParams.get('kind')?.trim() ?? ''
  const kind = (REMINDER_TEMPLATE_KINDS as readonly string[]).includes(rawKind)
    ? rawKind as typeof REMINDER_TEMPLATE_KINDS[number]
    : ''
  const rawTaskTemplateId = Number(url.searchParams.get('taskTemplateId') ?? '')
  const taskTemplateId = Number.isInteger(rawTaskTemplateId) && rawTaskTemplateId > 0 ? rawTaskTemplateId : null

  const kw = `%${keyword}%`
  const keywordId = Number(keyword)
  const idClause = Number.isInteger(keywordId) && keywordId > 0 ? eq(reminderTemplate.id, keywordId) : undefined
  const keywordClause = keyword
    ? idClause
      ? or(like(reminderTemplate.title, kw), like(taskTemplate.title, kw), idClause)
      : or(like(reminderTemplate.title, kw), like(taskTemplate.title, kw))
    : undefined
  const whereClause = and(
    keywordClause,
    kind ? eq(reminderTemplate.kind, kind) : undefined,
    taskTemplateId ? eq(reminderTemplate.taskTemplateId, taskTemplateId) : undefined,
  )

  const [totalResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(reminderTemplate)
    .leftJoin(taskTemplate, eq(reminderTemplate.taskTemplateId, taskTemplate.id))
    .where(whereClause)

  const rows = await db
    .select({
      id: reminderTemplate.id,
      taskTemplateId: reminderTemplate.taskTemplateId,
      taskTemplateTitle: taskTemplate.title,
      title: reminderTemplate.title,
      description: reminderTemplate.description,
      kind: reminderTemplate.kind,
      repeatType: reminderTemplate.repeatType,
      date: reminderTemplate.date,
      startDate: reminderTemplate.startDate,
      endDate: reminderTemplate.endDate,
      daysOfWeek: reminderTemplate.daysOfWeek,
      daysOfMonth: reminderTemplate.daysOfMonth,
      yearlyMonths: reminderTemplate.yearlyMonths,
      yearlyDaysOfMonth: reminderTemplate.yearlyDaysOfMonth,
      reminderTime: reminderTemplate.reminderTime,
      advanceReminderMinutes: reminderTemplate.advanceReminderMinutes,
      isVisible: reminderTemplate.isVisible,
      createdAt: reminderTemplate.createdAt,
      updatedAt: reminderTemplate.updatedAt,
    })
    .from(reminderTemplate)
    .leftJoin(taskTemplate, eq(reminderTemplate.taskTemplateId, taskTemplate.id))
    .where(whereClause)
    .orderBy(desc(reminderTemplate.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    list: rows.map(row => ({
      ...row,
      taskTemplateTitle: row.taskTemplateTitle ?? null,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt.slice(0, 16) : row.updatedAt,
    })),
    total: Number(totalResult?.total ?? 0),
    page,
    pageSize,
    keyword,
    kind,
  }
})
