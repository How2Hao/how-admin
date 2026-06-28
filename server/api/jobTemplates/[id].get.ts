import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { parseJobTemplateId } from '~~/utils/jobTemplate'
import { jobTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseJobTemplateId(event.context.params?.id)
  const [row] = await db.select().from(jobTemplate).where(eq(jobTemplate.id, id)).limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '任务模板不存在' })
  }
  return row
})
