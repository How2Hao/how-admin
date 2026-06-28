import { desc, eq, like, or } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { jobTemplate, taskTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const q = url.searchParams.get('q')?.trim() ?? ''
  const kw = `%${q}%`
  const qId = Number(q)
  const idClause = Number.isInteger(qId) && qId > 0 ? eq(jobTemplate.id, qId) : undefined
  const keywordClause = q
    ? idClause
      ? or(like(jobTemplate.title, kw), like(taskTemplate.title, kw), idClause)
      : or(like(jobTemplate.title, kw), like(taskTemplate.title, kw))
    : undefined

  const rows = await db
    .select({
      id: jobTemplate.id,
      title: jobTemplate.title,
      repeatType: jobTemplate.repeatType,
      taskTemplateId: jobTemplate.taskTemplateId,
      taskTemplateTitle: taskTemplate.title,
      rewardDescription: jobTemplate.rewardDescription,
    })
    .from(jobTemplate)
    .leftJoin(taskTemplate, eq(jobTemplate.taskTemplateId, taskTemplate.id))
    .where(keywordClause)
    .orderBy(desc(jobTemplate.id))
    .limit(30)

  return {
    options: rows.map((row) => {
      const meta = [row.repeatType, row.rewardDescription, row.taskTemplateTitle ? `活动：${row.taskTemplateTitle}` : null]
        .filter(Boolean)
        .join(' · ')
      return {
        label: `${row.title}${meta ? ` · ${meta}` : ''}`,
        value: row.id,
        repeatType: row.repeatType,
        taskTemplateId: row.taskTemplateId ?? null,
        taskTemplateTitle: row.taskTemplateTitle ?? null,
        rewardDescription: row.rewardDescription ?? null,
      }
    }),
  }
})
