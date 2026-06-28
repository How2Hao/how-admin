import { desc, eq, like, or } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { reminderTemplate, taskTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const q = url.searchParams.get('q')?.trim() ?? ''
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
    .where(keywordClause)
    .orderBy(desc(reminderTemplate.id))
    .limit(30)

  return {
    options: rows.map((row) => {
      const meta = [row.kind, row.repeatType, row.reminderTime, row.taskTemplateTitle ? `活动：${row.taskTemplateTitle}` : null]
        .filter(Boolean)
        .join(' · ')
      return {
        label: `${row.title}${meta ? ` · ${meta}` : ''}`,
        value: row.id,
        kind: row.kind,
        repeatType: row.repeatType,
        reminderTime: row.reminderTime ?? null,
        taskTemplateId: row.taskTemplateId,
        taskTemplateTitle: row.taskTemplateTitle ?? null,
      }
    }),
  }
})
