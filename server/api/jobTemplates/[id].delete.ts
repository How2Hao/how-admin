import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { parseJobTemplateId } from '~~/utils/jobTemplate'
import { jobTemplate, taskTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseJobTemplateId(event.context.params?.id)
  const [row] = await db.select({ id: jobTemplate.id })
    .from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '任务模板不存在' })
  }
  await db.update(taskTemplate)
    .set({
      jobTemplateId: null,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(taskTemplate.jobTemplateId, id))
  await db.delete(jobTemplate).where(eq(jobTemplate.id, id))
  return { id, success: true }
})
