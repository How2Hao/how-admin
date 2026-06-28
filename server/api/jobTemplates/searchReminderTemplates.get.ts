import { and, desc, eq, like, or } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { reminderTemplate, taskTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const q = url.searchParams.get('q')?.trim() ?? ''
  const rawTaskTemplateId = Number(url.searchParams.get('taskTemplateId') ?? '')
  const taskTemplateId = Number.isInteger(rawTaskTemplateId) && rawTaskTemplateId > 0 ? rawTaskTemplateId : null

  const kw = `%${q}%`
  const qId = Number(q)
  const idClause = Number.isInteger(qId) && qId > 0 ? eq(reminderTemplate.id, qId) : undefined
  const keywordClause = q
    ? idClause
      ? or(like(reminderTemplate.title, kw), like(taskTemplate.title, kw), idClause)
      : or(like(reminderTemplate.title, kw), like(taskTemplate.title, kw))
    : undefined
  const rows = await db
    .select({
      id: reminderTemplate.id,
      title: reminderTemplate.title,
      kind: reminderTemplate.kind,
      repeatType: reminderTemplate.repeatType,
      reminderTime: reminderTemplate.reminderTime,
      taskTemplateId: reminderTemplate.taskTemplateId,
      taskTemplateTitle: taskTemplate.title,
    })
    .from(reminderTemplate)
    .leftJoin(taskTemplate, eq(reminderTemplate.taskTemplateId, taskTemplate.id))
    .where(and(
      taskTemplateId ? eq(reminderTemplate.taskTemplateId, taskTemplateId) : undefined,
      keywordClause,
    ))
    .orderBy(desc(reminderTemplate.id))
    .limit(30)

  return {
    options: rows.map(r => ({
      label: `${r.title} · ${r.kind} · ${r.repeatType}${r.reminderTime ? ` ${r.reminderTime}` : ''}`,
      value: r.id,
      kind: r.kind,
      repeatType: r.repeatType,
      taskTemplateId: r.taskTemplateId,
      taskTemplateTitle: r.taskTemplateTitle ?? null,
    })),
  }
})
